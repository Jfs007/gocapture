'use strict';

const fs = require('fs');
const path = require('path');
const { runAgentTask } = require('../../../agent-host/llm-adapter');
const { filterToolsByConfigAction } = require('../../../agent-host/capabilities');
const { loadLangChainRuntime } = require('../../../agent-host/langchain/runtime');
const {
  executeAgentTool,
  listAgentTools,
} = require('../../../agent-host/tools/registry');
const { parseJsonResult } = require('../anchor/dom-utils');

const DOM_LOCATOR_TOOLS = [
  'search_source_evidence',
  'search_text',
  'find_files',
  'find_symbol',
  'read_file',
  'read_closed_blocks',
  'find_imports',
  'find_importers',
  'trace_file_evidence_flow',
];

const MAX_STRUCTURE_CHARS = 24000;
const MAX_FALLBACK_PATHS = 500;

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
}

function readProjectStructure(project) {
  const structurePath = path.join(project.path, '.magnus', 'Structure.md');
  try {
    const text = fs.readFileSync(structurePath, 'utf8').trim();
    if (text) return text.slice(0, MAX_STRUCTURE_CHARS);
  } catch (error) {
  }
  return (project.files || [])
    .slice(0, MAX_FALLBACK_PATHS)
    .map(file => file.path)
    .join('\n');
}

function buildDomLocatorObjective(input = {}) {
  return [
    '定位当前 DOM 选区对应的真实源码，并解释多个文件如何共同生成该 DOM。',
    '',
    '调查方式：',
    '1. 先理解用户需求、DOM 结构、页面事实和项目结构，再选择当前最可能有效的工具调用。',
    '2. 工具结果只是事实，不是结论。命中次数、路径邻近、文件后缀或单个文案都不能直接证明渲染归属。',
    '3. 每轮根据新证据修正假设。可以更换检索词、读取候选局部、追踪符号或文件引用。',
    '4. 一个 DOM 区域可能由外框、动态子组件、公共组件、配置或数据源共同生成。保留能够解释不同 DOM 子区域的互补文件。',
    '5. 如果候选只解释部分 DOM，继续寻找剩余部分及文件之间的真实关系，不要强行挑一个最高分文件。',
    '6. 如果遇到动态组件、配置映射、状态中转或其他间接关系，使用工具读取实际源码证据；不要凭框架惯例补全。',
    '7. 只有重要 DOM 区域均被解释、必要文件关系已由源码证据闭合时，才提交 resolved。',
    '8. 如果现有 DOM 无法提出有价值的下一步验证，提交 need-more-context 并申请扩区。只要仍有可验证假设，就继续调用工具。',
    '9. 不编造文件、符号、代码、关系或行号。',
    '10. 不得重复完全相同的工具调用。读取截断文件时，使用 read_file.around 指定符号、文案或行区间继续下钻。',
    '11. 已解释用户关注的 DOM 区域和必要文件关系后立即结束；不要追查与定位目标无关的数据或业务逻辑。',
    '12. 调查结束必须调用 finish_dom_location；不要用普通文本结束。',
    '',
    `用户需求:\n${input.userPrompt || ''}`,
    '',
    `页面与路由事实:\n${JSON.stringify(input.routeFacts || {}, null, 2)}`,
    '',
    `当前 DOM 选区:\n${JSON.stringify(input.domSelections || [], null, 2)}`,
    '',
    `真实项目结构:\n${input.projectStructure || ''}`,
  ].join('\n');
}

function createFinishTool() {
  const runtime = loadLangChainRuntime();
  if (!runtime.available) throw new Error(`LangChain runtime missing: ${runtime.missing.join(', ')}`);
  const z = runtime.z;
  return runtime.tool(
    async input => JSON.stringify(input),
    {
      name: 'finish_dom_location',
      description: 'Finish DOM source investigation. Use resolved only after source evidence explains the DOM and required cross-file relations; otherwise request more DOM context.',
      returnDirect: true,
      schema: z.object({
        status: z.enum(['resolved', 'need-more-context', 'unresolved']),
        files: z.array(z.object({
          file: z.string(),
          role: z.enum(['render', 'main-render', 'co-render', 'child', 'assembly', 'definition', 'data-source', 'related']),
          confidence: z.number().min(0).max(100),
          line: z.number().optional(),
          anchor: z.string().optional(),
          reason: z.string(),
          snippet: z.string().optional(),
        })).max(12),
        relations: z.array(z.object({
          from: z.string(),
          to: z.string(),
          type: z.string(),
          evidence: z.string(),
        })).max(16),
        coveredDom: z.array(z.string()).max(16),
        missingEvidence: z.array(z.string()).max(12),
        needMoreDom: z.boolean(),
        reason: z.string(),
      }),
    }
  );
}

function createFinalizationMiddleware(maxModelCalls = 12) {
  const runtime = loadLangChainRuntime();
  if (!runtime.available || typeof runtime.createMiddleware !== 'function') return null;
  let modelCalls = 0;
  return runtime.createMiddleware({
    name: 'DomLocatorFinalizationBudget',
    wrapModelCall: async (request, handler) => {
      modelCalls += 1;
      if (modelCalls < maxModelCalls) return handler(request);
      return handler({
        ...request,
        tools: (request.tools || []).filter(tool => tool?.name === 'finish_dom_location'),
        systemPrompt: [
          request.systemPrompt || '',
          '本轮已到调查预算上限。只能调用 finish_dom_location：证据充分则 resolved；DOM 证据不足则 need-more-context；仍缺源码关系则 unresolved。不要继续检索，不要用普通文本结束。',
        ].filter(Boolean).join('\n'),
      });
    },
  });
}

function normalizeLocatorDecision(rawText, project) {
  const parsed = parseJsonResult(rawText) || {};
  const knownFiles = new Set((project.files || []).map(file => file.path));
  const files = (Array.isArray(parsed.files) ? parsed.files : [])
    .map(item => ({
      file: normalizePath(item?.file || item?.path),
      role: String(item?.role || 'related'),
      confidence: Number(item?.confidence || 0),
      line: Number(item?.line || 0),
      anchor: String(item?.anchor || ''),
      reason: String(item?.reason || ''),
      snippet: String(item?.snippet || ''),
    }))
    .filter(item => item.file && knownFiles.has(item.file));
  const relations = (Array.isArray(parsed.relations) ? parsed.relations : [])
    .map(item => ({
      from: normalizePath(item?.from),
      to: normalizePath(item?.to),
      type: String(item?.type || 'related'),
      evidence: String(item?.evidence || ''),
    }))
    .filter(item => item.from && item.to && knownFiles.has(item.from) && knownFiles.has(item.to));
  let status = String(parsed.status || 'unresolved');
  const hasRender = files.some(item => /render/.test(item.role));
  if (status === 'resolved' && (!files.length || !hasRender)) status = 'unresolved';
  const needMoreDom = Boolean(parsed.needMoreDom || status === 'need-more-context');
  return {
    status,
    files,
    relations,
    coveredDom: Array.isArray(parsed.coveredDom) ? parsed.coveredDom.map(String) : [],
    missingEvidence: Array.isArray(parsed.missingEvidence) ? parsed.missingEvidence.map(String) : [],
    needMoreDom,
    reason: String(parsed.reason || ''),
  };
}

function compactEventValue(value, maxChars = 12000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...（已裁剪 ${text.length - maxChars} 字符）`;
}

async function runDomLocatorAgent(project, input = {}, options = {}) {
  const tools = filterToolsByConfigAction(listAgentTools(), {
    configAction: ['builtin'],
    allowedTools: DOM_LOCATOR_TOOLS,
    readOnlyOnly: true,
  });
  const objective = buildDomLocatorObjective({
    ...input,
    projectStructure: readProjectStructure(project),
  });
  options.onLog?.(`DOM Locator Agent 输入（${objective.length} 字符）:\n${objective}`);
  let modelRound = 0;
  const maxTurns = options.maxTurns || 12;
  const finalizationMiddleware = createFinalizationMiddleware(maxTurns);
  const result = await runAgentTask(project, {
    adapter: options.adapter,
    langchainModel: options.langchainModel,
    objective,
    stage: 'dom-locator',
    systemPrompt: [
      '你是 Magnus DOM Source Locator。',
      '你负责理解和推理；本地工具只负责返回真实项目事实。',
      '根据每轮工具观察决定下一步，不使用固定流水线，不按本地分数直接选文件。',
      '必须通过 finish_dom_location 结束调查。',
    ].join('\n'),
    middleware: finalizationMiddleware ? [finalizationMiddleware] : [],
    configAction: ['builtin'],
    readOnlyOnly: true,
    maxTurns,
    signal: options.signal,
    onEvent: event => {
      if (event.type === 'llm.log') options.onLog?.(event.log);
      if (event.type === 'llm.input') {
        modelRound += 1;
        options.onLog?.(`DOM Locator Agent 第 ${modelRound} 轮模型输入：messages=${(event.messages || []).length}；tools=${event.toolCount || 0}`);
      }
      if (event.type === 'llm.output') {
        options.onLog?.(`DOM Locator Agent 第 ${modelRound} 轮模型输出：tool_calls=${(event.toolCalls || []).length}；text=${String(event.rawText || '').length} 字符`);
      }
      if (event.type === 'tool.start') {
        options.onLog?.(`DOM Locator Agent 工具调用：${event.toolCall?.tool} ${compactEventValue(event.toolCall?.input || {})}`);
      }
      if (event.type === 'tool.result') {
        options.onLog?.(`DOM Locator Agent 工具结果：${event.observation?.tool}\n${compactEventValue(event.observation?.result)}`);
      }
      if (event.type === 'tool.error') {
        options.onLog?.(`DOM Locator Agent 工具失败：${event.observation?.tool}；${event.observation?.error || '-'}`);
      }
    },
  }, {
    tools,
    executeTool: executeAgentTool,
    textCache: options.textCache || new Map(),
    langchainTools: [createFinishTool()],
  });
  const decision = normalizeLocatorDecision(result.rawText, project);
  options.onLog?.(`DOM Locator Agent 最终裁决：${JSON.stringify(decision, null, 2)}`);
  return {
    ...decision,
    rawText: result.rawText || '',
    modelRounds: modelRound,
  };
}

module.exports = {
  DOM_LOCATOR_TOOLS,
  buildDomLocatorObjective,
  createFinalizationMiddleware,
  createFinishTool,
  normalizeLocatorDecision,
  readProjectStructure,
  runDomLocatorAgent,
};
