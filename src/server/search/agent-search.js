'use strict';

// 定位阶段入口（HTTP 边界）：整备路由事实 + 选区事实，跑 DOM Locator，再把裁决适配成 SearchResult。
// 编排薄；DOM 解析在 dom/，agent 装配在 agents/locator/，结果适配在 agents/locator/result。
const { resolvePageRouteTrace } = require('../route-resolvers/registry');
const { plannerDomInput } = require('../dom');
const { runDomLocatorAgent } = require('../agents/locator');
const { buildSearchResult } = require('../agents/locator/result');

function routeFactsFromResult(body, routeResult) {
  return {
    pagePath: body?.pagePath || body?.url || '',
    matched: !!routeResult.trace?.matched,
    bestPageFile: routeResult.trace?.bestPageFile || '',
    hits: (routeResult.hits || []).slice(0, 8).map(hit => ({
      file: hit.file,
      routePath: hit.routePath,
      reasons: hit.reasons || [],
    })),
  };
}

function searchSelections(domSelections) {
  return domSelections.map(item => ({
    index: item.index,
    tag: item.tag,
    selector: item.selector,
    className: item.className,
    directText: item.directText || item.text || '',
    text: item.text || '',
    markup: item.markup,
    rawMarkupLength: item.rawMarkupLength,
    compressedMarkupLength: item.compressedMarkupLength,
  }));
}

async function runAgentSearch(project, body, options = {}) {
  if (!project) throw new Error('No project selected.');
  if (!body?.adapter && !options.langchainModel) {
    throw new Error('DOM Agent requires an API model adapter.');
  }
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  const signal = options.signal;
  const textCache = new Map();
  onLog('DOM Agent runtime: LangChain tool-driven locator');

  onLog('本地调用：resolvePageRouteTrace(project, body)');
  const routeResult = resolvePageRouteTrace(project, body, textCache);
  const routeFacts = routeFactsFromResult(body, routeResult);
  onLog(`本地输出：${JSON.stringify({
    matched: routeFacts.matched,
    bestPageFile: routeFacts.bestPageFile,
    hits: routeFacts.hits.slice(0, 6).map(hit => hit.file),
  }, null, 2)}`);

  const domSelections = plannerDomInput(body);
  const domFacts = searchSelections(domSelections);
  onLog('本地调用：compressDomMarkup(selection DOM)');
  onLog(`本地输出：${JSON.stringify({
    selections: domSelections.map(item => ({
      index: item.index,
      tag: item.tag,
      rawMarkupLength: item.rawMarkupLength,
      compressedMarkupLength: item.compressedMarkupLength,
      repeatedGroupCount: item.compression?.repeatedGroupCount || 0,
    })),
  }, null, 2)}`);

  const decision = await runDomLocatorAgent(project, {
    body,
    userPrompt: body?.prompt || body?.message || body?.userPrompt || '',
    routeFacts,
    domSelections: domFacts,
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
