'use strict';

const { readProjectText } = require('../core/fs-utils');
const { resolvePageRouteTrace } = require('../route-resolvers/registry');
const {
  domContextDebugSummary,
  plannerDomInput,
} = require('../dom');
const { runDomLocatorAgent } = require('./dom-agent/agents/dom-locator-agent');

function projectFile(project, filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\.?\//, '');
  return (project.files || []).find(file => file.path === normalized) || null;
}

function textAroundLine(project, filePath, line, textCache, radius = 18) {
  const file = projectFile(project, filePath);
  if (!file) return '';
  const text = readProjectText(project, file, textCache);
  const lines = text.split(/\r?\n/);
  const target = Math.max(1, Number(line || 1));
  const start = Math.max(1, target - radius);
  const end = Math.min(lines.length, target + radius);
  return lines.slice(start - 1, end).join('\n');
}

function firstUsefulSnippet(project, filePath, textCache) {
  const file = projectFile(project, filePath);
  if (!file) return '';
  const text = readProjectText(project, file, textCache);
  return text.split(/\r?\n/).slice(0, 80).join('\n');
}

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

function normalizeDecisionFiles(files) {
  return (Array.isArray(files) ? files : [])
    .map((item, index) => ({
      file: String(item?.file || item?.path || '').replace(/\\/g, '/').replace(/^\.?\//, ''),
      role: String(item?.role || (index === 0 ? 'render' : 'related')),
      confidence: Number(item?.confidence || item?.score || 0),
      reason: String(item?.reason || ''),
      line: Number(item?.line || 0),
      column: Number(item?.column || 0),
      anchor: String(item?.anchor || ''),
      snippet: String(item?.snippet || item?.codeSnippet || ''),
    }))
    .filter(item => item.file);
}

function buildSearchResult(project, body, routeResult, decision, rawText, textCache, debug = {}) {
  const validFiles = normalizeDecisionFiles(decision.files)
    .map(item => ({ ...item, exists: !!projectFile(project, item.file) }))
    .filter(item => item.exists);
  const enriched = validFiles.map((item, index) => {
    const snippet = item.snippet
      || (item.line ? textAroundLine(project, item.file, item.line, textCache) : firstUsefulSnippet(project, item.file, textCache));
    return {
      file: item.file,
      score: item.confidence || Math.max(100, 1000 - index * 60),
      stage: debug.stage || 'dom-agent',
      role: item.role,
      sourceRole: item.role,
      line: item.line || 0,
      column: item.column || 0,
      anchor: item.anchor || '',
      reasons: [
        item.reason || '',
        decision.reason || decision.stopReason || '',
      ].filter(Boolean),
      preciseEvidence: item.role === 'render',
      snippet,
      preciseSnippet: snippet,
      modelCodeSnippet: snippet,
      modelLocateLevel: item.line ? 'exact' : 'direction',
      modelSnippetVerified: Boolean(snippet),
    };
  });
  const render = enriched.find(item => item.role === 'render' || item.role === 'main-render') || enriched[0] || null;
  const composite = render
    ? {
        render: {
          file: render.file,
          role: 'render',
          score: render.score,
          line: render.line || 0,
          column: render.column || 0,
          anchor: render.anchor || '',
        },
        children: enriched
          .filter(item => item.file !== render.file && item.role === 'child')
          .map(item => ({ file: item.file, anchor: item.anchor || item.reason || '' })),
        coRenders: enriched
          .filter(item => item.file !== render.file && /render/.test(item.role) && item.role !== 'child')
          .map(item => ({ file: item.file, role: item.role, score: item.score, line: item.line || 0 })),
        bridgeFiles: enriched
          .filter(item => !/render|child/.test(item.role))
          .map(item => ({ file: item.file, role: item.role })),
        relations: (decision.relations || []).map(relation => ({
          from: relation.from,
          to: relation.to,
          type: relation.type,
          evidence: relation.evidence,
        })),
      }
    : null;
  const needMoreDom = !enriched.length && Boolean(decision.needMoreDom || decision.status === 'need-more-context');
  return {
    hits: enriched,
    composite,
    routeResolver: routeResult.trace,
    agent: {
      enabled: true,
      runtime: 'langchain-staged',
      status: decision.status || (enriched.length ? 'resolved' : 'need-more-context'),
      needMoreDom,
      files: validFiles,
      rawText,
      domContext: domContextDebugSummary(body),
      ...debug,
    },
    needMoreDom,
    needsMoreEvidence: needMoreDom,
  };
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
