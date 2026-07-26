'use strict';

// DOM Source Locator：确定性本地种子作为初始事实，一个 LangChain createAgent/ReAct
// 自主调用只读工具，并通过 finish_dom_location 结构化交卷。
const { runAgentTask } = require('../../agent-host/llm-adapter');
const { filterToolsByConfigAction } = require('../../agent-host/capabilities');
const { executeAgentTool, listAgentTools } = require('../../agent-host/tools/registry');
const { LOCATOR_SYSTEM_PROMPT, readProjectStructure, buildDomLocatorObjective } = require('./prompt');
const { extractSeedAnchors, computeAnchorSeed } = require('./seed');
const { createFinishTool, normalizeLocatorDecision, buildFallbackDecision } = require('./finish');
const {
  createFinalizationMiddleware,
  createDomLocatorContextMiddleware,
  createDomLocatorToolGuard,
} = require('./middleware');
const { createLocatorLogger } = require('./logger');

const DOM_LOCATOR_TOOLS = [
  // 定向工具：返回框架/anchor/搜索范围/Experience 线索。未实现前不在 registry 中，
  // 白名单会自动忽略，属于惰性注册。
  'consult_project_knowledge',
  'search_source_evidence',
  'search_text',
  'find_files',
  'find_symbol',
  'inspect_symbol_occurrences',
  'read_file',
  'read_closed_blocks',
  'find_imports',
  'find_importers',
  'trace_file_evidence_flow',
];

async function runDomLocatorAgent(project, input = {}, options = {}) {
  const tools = filterToolsByConfigAction(listAgentTools(), {
    configAction: ['builtin'],
    allowedTools: DOM_LOCATOR_TOOLS,
    readOnlyOnly: true,
  });
  const hasKnowledgeTool = tools.some(tool => tool?.name === 'consult_project_knowledge');
  const textCache = options.textCache || new Map();

  const anchorSeed = await computeAnchorSeed(project, input.domSelections, textCache, options.onLog);
  if (anchorSeed) {
    options.onLog?.(`DOM Locator Agent 锚点种子：anchors=${anchorSeed.anchors.join('、')}；候选(命中数/稀有度)=${anchorSeed.candidates.map(c => `${c.file}(${c.matchedAnchorCount}/${c.informationScore})`).join(', ') || '无'}`);
  }

  const objective = buildDomLocatorObjective({
    ...input,
    hasKnowledgeTool,
    anchorSeed,
    projectStructure: anchorSeed ? '' : readProjectStructure(project),
  });
  options.onLog?.(`DOM Locator Agent 输入（${objective.length} 字符）:\n${objective}`);

  const maxTurns = options.maxTurns || 12;
  // 逼交卷提前 3 轮开始，给硬拦留 runway；forceFinish 由中间件置位、toolGuard 读取。
  const budget = { modelCalls: 0, forceFinishAt: Math.max(2, maxTurns - 3), forceFinish: false };
  const contextMiddleware = createDomLocatorContextMiddleware();
  if (contextMiddleware) options.onLog?.('DOM Locator Agent 上下文策略：约 28000 tokens 后清理较早工具正文，保留最近 6 条工具结果。');
  const logger = createLocatorLogger(options.onLog);

  const result = await runAgentTask(project, {
    adapter: options.adapter,
    langchainModel: options.langchainModel,
    objective,
    stage: 'dom-locator',
    systemPrompt: LOCATOR_SYSTEM_PROMPT,
    middleware: [contextMiddleware, createFinalizationMiddleware(budget)].filter(Boolean),
    configAction: ['builtin'],
    readOnlyOnly: true,
    maxTurns,
    signal: options.signal,
    onEvent: logger.onEvent,
  }, {
    tools,
    executeTool: (targetProject, toolCall, context = {}) => executeAgentTool(targetProject, toolCall, {
      ...context,
      searchResultPolicy: 'summary-on-truncation',
    }),
    textCache,
    langchainTools: [createFinishTool()],
    toolGuard: createDomLocatorToolGuard(budget),
  });

  let decision = normalizeLocatorDecision(result.rawText, project);
  // 撞递归上限或没有有效交卷时只暴露候选事实，不由本地替模型认定 render。
  if (result.recursionLimitHit || !decision.files.length) {
    const fallback = buildFallbackDecision({
      anchorSeed,
      evidenceCandidates: logger.evidenceCandidates,
      project,
      recursionLimitHit: result.recursionLimitHit,
    });
    if (fallback) {
      options.onLog?.(`DOM Locator Agent 兜底裁决（${result.recursionLimitHit ? '递归上限' : '空结论'}）：${JSON.stringify(fallback, null, 2)}`);
      decision = fallback;
    }
  }
  options.onLog?.(`DOM Locator Agent 最终裁决：${JSON.stringify(decision, null, 2)}`);
  return {
    ...decision,
    rawText: result.rawText || '',
    recursionLimitHit: Boolean(result.recursionLimitHit),
    modelRounds: logger.modelRounds,
  };
}

module.exports = {
  DOM_LOCATOR_TOOLS,
  runDomLocatorAgent,
  // 供测试/复用的装配件
  buildDomLocatorObjective,
  readProjectStructure,
  extractSeedAnchors,
  computeAnchorSeed,
  createFinishTool,
  normalizeLocatorDecision,
  buildFallbackDecision,
  createFinalizationMiddleware,
  createDomLocatorContextMiddleware,
  createDomLocatorToolGuard,
};
