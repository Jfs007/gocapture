'use strict';

const { readProjectText } = require('../core/fs-utils');
const { createMiddleware, tool, ToolMessage } = require('langchain');
const { z } = require('zod');
const { DEFAULT_AGENT_CONFIG_ACTION, filterToolsByConfigAction } = require('../agent-host/capabilities');
const { runAgentTask } = require('../agent-host/llm-adapter');
const { executeAgentTool, listAgentTools } = require('../agent-host/tools/registry');
const {
  createBudget,
  createFinalizationMiddleware,
  composeToolGuards,
  createForceFinishGuard,
} = require('../agent-host/agent-finalization');
const {
  changePlanToText,
  normalizePlanningResult,
  planningResultSchema,
  toLegacyChangePlan,
} = require('./change-plan');

const MAX_SOURCE_CHARS_PER_FILE = 30000;
const MAX_SOURCE_CHARS_TOTAL = 60000;
const PLANNING_EXPERIENCE_TOOLS = new Set(['recon_inspect', 'recon_search']);
// responseFormat(toolStrategy) 的合成"交计划"工具名 = change-plan.js schema 的 meta.title。
// 它是 planning 的收尾机制，绝不能被门控隐藏或被收尾清掉，否则模型无法输出计划。
const STRUCTURED_OUTPUT_TOOL = 'magnus_change_plan';

// "研究/广度"类工具：找相似实现、跨文件检索、项目知识。默认(local)关闭，避免琐碎改动过度研究；
// 仅当需求明确需要跨文件一致性(project-wide)时才放开。读取已定位文件的精确工具(read_file/
// read_closed_blocks/inspect_symbol_occurrences)不在此列，始终可用。
const PLANNING_RESEARCH_TOOLS = new Set([
  'search_text', 'search_source_evidence', 'find_files', 'find_symbol',
  'find_imports', 'find_importers', 'trace_file_evidence_flow',
  'find_related_examples', 'consult_project_knowledge', 'recon_inspect', 'recon_search',
]);

// 改动范围不用关键词预判、也不预设能力分类：默认只给"精读已定位文件 + skills"，
// 研究检索类工具和 MCP/动态工具默认隐藏；模型 expand_scope(reason) 后一次性全部放开。
// escalation = { expanded }。skills（在 builtinToolNames 内、非研究工具）始终常开。
function isToolGated(name, { escalation, researchTools, builtinToolNames }) {
  if (name === 'expand_scope') return false; // 升级入口，始终可用
  if (name === STRUCTURED_OUTPUT_TOOL) return false; // 结构化收尾工具，始终可用（否则模型没法交计划）
  if (escalation.expanded) return false; // 升级后全部放开
  if (researchTools.has(name)) return true; // 研究/检索类，默认隐藏
  if (!builtinToolNames.has(name)) return true; // 非内建 = MCP/动态工具，默认隐藏
  return false; // 精读已定位文件的内建工具 + skills，始终可用
}

// expand_scope 工具：模型确需超出"已定位文件"去调查时显式申请（带理由），一次性放开其余能力。
function createExpandScopeTool(escalation, log = () => {}) {
  return tool(
    async ({ reason }) => {
      escalation.expanded = true;
      log(`Planning Agent 范围升级：${String(reason || '').slice(0, 160)}`);
      return JSON.stringify({ ok: true, expanded: true });
    },
    {
      name: 'expand_scope',
      description: '当基于已定位源码无法形成计划、确需超出已定位文件去调查时调用（例如需核实项目里是否有需同步修改的相似实现，或需要检索、外部库/文档等其它能力）。必须给出具体 reason。局部/机械改动不要调用。',
      schema: z.object({ reason: z.string() }),
    }
  );
}

// 范围门控中间件：wrapModelCall 隐藏被门控工具（广告层），wrapToolCall 拦其执行（执行层）。
// 全部走 LangChain 原生钩子，不再手搓 toolGuard 穿层。
function createScopeGateMiddleware(escalation, { researchTools, builtinToolNames }) {
  const gated = name => isToolGated(name, { escalation, researchTools, builtinToolNames });
  return createMiddleware({
    name: 'PlanningScopeGate',
    wrapModelCall: async (request, handler) =>
      handler({ ...request, tools: (request.tools || []).filter(toolItem => !gated(toolItem?.name || '')) }),
    wrapToolCall: async (request, handler) => {
      const name = request.tool?.name || '';
      if (gated(name)) {
        return new ToolMessage({
          content: JSON.stringify({
            blocked: true,
            note: `工具 ${name} 属于扩大范围能力，需先调用 expand_scope(reason) 申请。局部改动请直接基于已定位源码产出计划。`,
          }),
          tool_call_id: request.toolCall?.id || '',
        });
      }
      return handler(request);
    },
  });
}

function numberedSource(text) {
  return String(text || '').split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n');
}

function hydratePlanningSources(project, input, textCache = new Map()) {
  const files = new Map((project?.files || []).map(file => [file.path, file]));
  let remaining = MAX_SOURCE_CHARS_TOTAL;
  const completeFiles = new Set();
  for (const source of input.locatedSources) {
    const file = files.get(source.file);
    if (!file || remaining <= 0) continue;
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const limit = Math.min(MAX_SOURCE_CHARS_PER_FILE, remaining);
    const excerpt = text.slice(0, limit);
    const complete = excerpt.length === text.length;
    source.sourceContent = {
      complete,
      characters: excerpt.length,
      content: numberedSource(excerpt),
      ...(complete ? {} : { note: '文件超过首轮证据预算，需要更多内容时再调用 read_file 精确读取。' }),
    };
    if (complete) completeFiles.add(source.file);
    remaining -= excerpt.length;
  }
  return { input, completeFiles };
}

function createPlanningExperienceWindowMiddleware(log = () => {}) {
  let modelCalls = 0;
  let closedLogged = false;
  return createMiddleware({
    name: 'PlanningExperienceWindow',
    wrapModelCall: async (request, handler) => {
      modelCalls += 1;
      if (modelCalls === 1) return handler(request);
      const tools = (Array.isArray(request.tools) ? request.tools : [])
        .filter(tool => !PLANNING_EXPERIENCE_TOOLS.has(String(tool?.name || '')));
      if (!closedLogged) {
        closedLogged = true;
        log('Planning Agent 经验窗口已关闭：后续仅消费首轮经验事实，不再调用 Recon/Experience tools');
      }
      return handler({ ...request, tools });
    },
  });
}

function buildPlanningInput(body, modelItems) {
  const payload = body.searchPayload || {};
  const investigations = Array.from(new Map((modelItems || [])
    .map(item => item.sourceInvestigation)
    .filter(Boolean)
    .map(item => [JSON.stringify(item), item])).values());
  return {
    requirement: payload.userPrompt || '',
    page: {
      url: payload.url || body.url || '',
      path: body.pagePath || body.routeResolver?.pagePath || '',
    },
    selections: (Array.isArray(body.originSelections) ? body.originSelections : []).slice(0, 8),
    locatedSources: (modelItems || []).map(item => ({
      file: item.file,
      role: item.sourceRole || 'related',
      locateLevel: item.locateLevel || '',
      codeSnippet: item.codeSnippet || item.rawCodeSnippet || '',
      confidence: Number(item.confidence || 0),
      // 带上 DOM Locator 定位到的精确锚点/行号，兜底计划据此指到真正的目标，而非文件首行。
      anchor: item.anchor || item.locateAnchor || '',
      line: Number(item.line || item.locateLine || 0),
    })),
    investigations,
  };
}

function planningSystemPrompt() {
  return [
    '你是 Magnus Planning Agent。DOM Locator 已完成源码定位，你在已定位证据上完成实施规划。',
    '证据足够时不要调用任何工具，直接提交结构化计划。',
    'locatedSources.sourceContent 是预读源码；complete=true 表示完整文件已给出，不要再 read_file 分页读它。',
    '优先形成最小可执行改动。只在"缺失事实会改变改动文件/代码范围/实现方式"时才调用工具；不要为补背景、找更优方案、找相似示例或解释完整调用链而调查。',
    '所有工具按其 name / description / input schema 理解，不假设固定调用顺序。',
    '不影响核心计划的未知，写进 risks / verification / questions，不要无休止调查。',
    '需由用户决定产品行为时 status=needs_confirmation 并列 questions；否则 ready。按给定结构化格式提交。',
    '不执行代码修改，不编造文件、接口、组件、字段或项目约定。',
  ].join('\n');
}

function planningObjective(input) {
  return [
    '根据以下已定位证据完成修改计划。需要更多真实依据时自行调用可用工具；证据足够后立即结束。',
    JSON.stringify(input, null, 2),
  ].join('\n\n');
}

function firstMeaningfulLine(snippet) {
  for (const line of String(snippet || '').split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed.slice(0, 120);
  }
  return '';
}

// 规划预算触发 / 模型未产出结构化计划时的兜底：从已定位证据合成最小可执行计划，绝不硬失败。
function buildFallbackPlan(input) {
  const sources = Array.isArray(input.locatedSources) ? input.locatedSources : [];
  const primary = sources.find(source => /render/.test(String(source.role || '')))
    || sources.slice().sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))[0];
  const targets = primary ? [{
    file: primary.file,
    // 优先用 DOM Locator 定位到的精确锚点/行号；没有才退回代码片段首行。
    anchor: primary.anchor || firstMeaningfulLine(primary.codeSnippet) || String(primary.role || ''),
    line: Number(primary.line) || 0,
    whatToChange: `${input.requirement || '按需求在此处实施改动'}（规划预算触发的兜底方案，改动细节需人工确认）`,
    why: 'DOM Locator 已定位为该选区的直接渲染源',
  }] : [];
  return normalizePlanningResult({
    status: 'needs_confirmation',
    understanding: `规划预算触发，基于 DOM Locator 已定位证据给出的兜底计划。需求：${input.requirement || ''}`,
    summary: primary ? `在 ${primary.file} 实施：${input.requirement || ''}` : (input.requirement || '需人工补充修改计划'),
    targets,
    risks: ['规划未在预算内完成完整调查，本计划为基于定位证据的最小方案，改动细节需人工确认。'],
    confirmedFacts: sources.map(source => `已定位：${source.file}（${source.role || 'related'}）`),
  });
}

async function runPlanningAgent(project, options = {}) {
  const {
    adapter,
    langchainModel,
    body = {},
    modelItems = [],
    textCache = new Map(),
    log = () => {},
    signal,
  } = options;
  const hydrated = hydratePlanningSources(project, buildPlanningInput(body, modelItems), textCache);
  const input = hydrated.input;
  // 范围门控：绑定全部工具（含研究/MCP），但默认只露"精读已定位文件 + skills"；模型 expand_scope 后一次性放开其余。
  const escalation = { expanded: false };
  const tools = filterToolsByConfigAction(listAgentTools(), {
    configAction: DEFAULT_AGENT_CONFIG_ACTION,
    readOnlyOnly: true,
  }).filter(planningTool => planningTool.category !== 'experience' || PLANNING_EXPERIENCE_TOOLS.has(planningTool.name));
  const toolNames = tools.map(planningTool => planningTool.name);
  const builtinToolNames = new Set(toolNames);
  const scopeGateMiddleware = createScopeGateMiddleware(escalation, {
    researchTools: PLANNING_RESEARCH_TOOLS,
    builtinToolNames,
  });
  const expandScopeTool = createExpandScopeTool(escalation, log);
  log(`Planning Agent 启动：已定位文件 ${input.locatedSources.length} 个；默认范围=local（研究/文档工具隐藏，需 expand_scope 升级）；可用 Magnus tools ${tools.length} 个`);
  for (const source of input.locatedSources) {
    if (!source.sourceContent) continue;
    log(`Planning Agent 预读源码：${source.file}；${source.sourceContent.complete ? '完整' : '截断'}；${source.sourceContent.characters} 字符`);
  }
  const maxTurns = 6;
  // 收尾三件套（与 locator 共用）：到点强制收尾。planning 收尾动作=只留"交计划"的结构化工具，
  // 逼模型直接吐结构化计划。绝不能连结构化工具一起清掉（那会导致 0 字符输出→垃圾兜底）。
  const budget = createBudget(maxTurns, { forceFinishOffset: 2 });
  const finalizationMiddleware = createFinalizationMiddleware(budget, {
    name: 'PlanningFinalizationBudget',
    finalizeRequest: request => {
      const allTools = Array.isArray(request.tools) ? request.tools : [];
      const structured = allTools.filter(tool => String(tool?.name || '') === STRUCTURED_OUTPUT_TOOL);
      return {
        ...request,
        // 找得到结构化工具就只留它；找不到（框架另行注入）就别乱删，避免破坏结构化输出。
        tools: structured.length ? structured : allTools,
        systemPrompt: [
          request.systemPrompt || '',
          '本轮已到规划预算上限。不要再调查，基于现有已定位证据与已获取事实立即提交结构化修改计划。',
        ].filter(Boolean).join('\n'),
      };
    },
  });
  const completeFileGuard = (name, toolInput) => {
    if (name !== 'read_file') return null;
    const requested = (Array.isArray(toolInput?.files) ? toolInput.files : []).map(String);
    if (!requested.length || !requested.every(file => hydrated.completeFiles.has(file))) return null;
    return {
      operation: 'read_file',
      skipped: true,
      reason: '请求文件的完整源码已包含在 Planning Agent 首轮输入中，请直接形成计划或调查真正缺失的事实。',
      files: requested,
    };
  };
  const toolGuard = composeToolGuards(
    createForceFinishGuard(budget, {
      isFinishTool: () => false, // planning 靠结构化输出收尾，没有 finish 工具 → 收尾阶段拦一切工具
      note: '规划预算已用尽：不要再调查，立即基于已有证据提交结构化修改计划。',
    }),
    completeFileGuard,
  );
  const result = await runAgentTask(project, {
    adapter,
    langchainModel,
    signal,
    stage: 'planning',
    systemPrompt: planningSystemPrompt(),
    // 工具的"是什么/何时用"由各工具 description 表达（expand_scope 亦然），objective 只给数据，不重述。
    objective: planningObjective(input),
    configAction: DEFAULT_AGENT_CONFIG_ACTION,
    maxTurns,
    responseFormat: planningResultSchema,
    readOnlyOnly: true,
    middleware: [createPlanningExperienceWindowMiddleware(log), scopeGateMiddleware, finalizationMiddleware].filter(Boolean),
    threadId: body.planningThreadId || body.taskId || undefined,
    onEvent: event => {
      if (event.type === 'llm.input') {
        log(`Planning Agent LLM 输入：messages=${(event.messages || []).length}；tools=${event.toolCount ?? 0}`);
      } else if (event.type === 'llm.output') {
        log(`Planning Agent LLM 输出：${String(event.rawText || '').length} 字符；toolCalls=${(event.toolCalls || []).length}`);
        if (!(event.toolCalls || []).length && event.rawText) {
          log(`Planning Agent LLM 最终文本：\n${event.rawText}`);
        }
      } else if (event.type === 'tool.start') {
        log(`Planning Agent Tool → ${event.toolCall?.tool || '-'} ${JSON.stringify(event.toolCall?.input || {})}`);
      } else if (event.type === 'tool.result') {
        log(`Planning Agent Tool ✓ ${event.observation?.tool || '-'}`);
      } else if (event.type === 'tool.error') {
        log(`Planning Agent Tool ✗ ${event.observation?.tool || '-'}：${event.observation?.error || '-'}`);
      } else if (event.type === 'agent.runtime') {
        log(`Planning Agent Runtime：builtin=${event.builtinToolCount || 0}；mcp=${event.mcpToolCount || 0}`);
      }
    },
  }, {
    tools,
    executeTool: async (toolProject, call, context) => executeAgentTool(toolProject, call, {
      ...context,
      textCache,
      allowedTools: toolNames,
    }),
    textCache,
    toolGuard,
    langchainTools: [expandScopeTool],
  });
  // 撞规划预算 / 模型未给出可用结构化计划 → 用兜底计划，绝不硬失败。
  let planning = result.recursionLimitHit || !result.structuredResponse
    ? null
    : normalizePlanningResult(result.structuredResponse);
  let fallback = false;
  if (!planning || (!planning.summary && !planning.targets.length && !planning.questions.length)) {
    planning = buildFallbackPlan(input);
    fallback = true;
    log(`Planning Agent 兜底计划（${result.recursionLimitHit ? '规划预算上限' : '空/缺结构化输出'}）：targets=${planning.targets.length}`);
  }
  const changePlan = toLegacyChangePlan(planning);
  log(`Planning Agent 完成：status=${planning.status}；targets=${planning.targets.length}；questions=${planning.questions.length}${fallback ? '（兜底）' : ''}`);
  return {
    planning,
    changePlan,
    enhancedPrompt: changePlanToText(planning, input.requirement),
    confirmedFacts: planning.confirmedFacts,
    assumptions: planning.assumptions,
    mode: fallback ? 'langchain-planning-agent-fallback' : 'langchain-planning-agent',
  };
}

module.exports = {
  buildFallbackPlan,
  buildPlanningInput,
  createExpandScopeTool,
  createPlanningExperienceWindowMiddleware,
  createScopeGateMiddleware,
  hydratePlanningSources,
  isToolGated,
  planningObjective,
  planningSystemPrompt,
  runPlanningAgent,
};
