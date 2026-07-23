'use strict';

// Magnus Planning Agent —— 装配工程：在 DOM Locator 的定位结果上做实施规划。
// 选 tools（范围门控默认只露精读+skills）+ prompt + 结构化输出(plan schema) + 中间件，交给
// runAgentTask 跑图；跑完归一为计划，撞限/空输出时回退兜底计划。机器全在 agent-host。
const { DEFAULT_AGENT_CONFIG_ACTION, filterToolsByConfigAction } = require('../../agent-host/capabilities');
const { runAgentTask } = require('../../agent-host/llm-adapter');
const { executeAgentTool, listAgentTools } = require('../../agent-host/tools/registry');
const {
  createBudget,
  createFinalizationMiddleware,
  composeToolGuards,
  createForceFinishGuard,
} = require('../../agent-host/agent-finalization');
const {
  buildPlanningInput,
  hydratePlanningSources,
  planningSystemPrompt,
  planningObjective,
} = require('./prompt');
const {
  PLANNING_EXPERIENCE_TOOLS,
  PLANNING_RESEARCH_TOOLS,
  STRUCTURED_OUTPUT_TOOL,
  isToolGated,
  createExpandScopeTool,
  createScopeGateMiddleware,
  createPlanningExperienceWindowMiddleware,
} = require('./middleware');
const {
  changePlanToText,
  normalizePlanningResult,
  planningResultSchema,
  toLegacyChangePlan,
  buildFallbackPlan,
} = require('./plan');

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
  runPlanningAgent,
  // 供测试/复用的装配件
  buildPlanningInput,
  hydratePlanningSources,
  planningObjective,
  planningSystemPrompt,
  buildFallbackPlan,
  isToolGated,
  createExpandScopeTool,
  createScopeGateMiddleware,
  createPlanningExperienceWindowMiddleware,
};
