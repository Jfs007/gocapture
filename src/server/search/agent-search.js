'use strict';

// 定位阶段入口（HTTP 边界）：整备路由事实 + 选区事实，跑 DOM Locator，再把裁决适配成 SearchResult。
// 编排薄；DOM 解析在 dom/，agent 装配在 agents/locator/，结果适配在 agents/locator/result。
const { runDomLocatorAgent } = require('../agents/locator');
const { buildSearchResult } = require('../agents/locator/result');
const { buildLocatorEvidencePackage } = require('./locator-evidence');

async function runAgentSearch(project, body, options = {}) {
  if (!project) throw new Error('No project selected.');
  if (!body?.adapter && !options.langchainModel) {
    throw new Error('DOM Agent requires an API model adapter.');
  }
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  const signal = options.signal;
  onLog('DOM Agent runtime: LangChain tool-driven locator');

  const {
    evidence,
    routeResult,
    textCache,
  } = buildLocatorEvidencePackage(project, body, { onLog });

  const decision = await runDomLocatorAgent(project, {
    body,
    userPrompt: body?.prompt || body?.message || body?.userPrompt || '',
    routeFacts: evidence.route,
    domSelections: evidence.selections,
  }, {
    adapter: body.adapter,
    signal,
    langchainModel: options.langchainModel,
    textCache,
    onLog,
  });
  return buildSearchResult(project, body, routeResult, decision, decision.rawText || '', textCache, {
    stage: decision.status === 'resolved' ? 'dom-locator' : 'expand-boundary',
    locator: decision,
  });
}

module.exports = {
  runAgentSearch,
};
