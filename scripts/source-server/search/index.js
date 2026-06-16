const { isTextFile, readProjectText } = require('../fs-utils');
const { buildSearchEvidence, scoreFileText } = require('./evidence');
const { reverseComponentUsages } = require('./component-trace');
const { traceApiReferences } = require('./api-trace');
const { traceImportChainHits } = require('./import-trace');
const { resolvePageRouteTrace } = require('../route-resolvers/registry');

function boundedLimit(value, fallback = 10) {
  return Math.max(1, Math.min(Number(value || fallback), 30));
}

function mergeHits(hits) {
  const merged = new Map();
  for (const hit of hits) {
    const old = merged.get(hit.file);
    if (!old || old.score < hit.score) {
      merged.set(hit.file, {
        ...hit,
        uniqueSnippet: hit.uniqueSnippet || old?.uniqueSnippet || '',
        uniqueMatchLabel: hit.uniqueMatchLabel || old?.uniqueMatchLabel || '',
        uniqueMatchText: hit.uniqueMatchText || old?.uniqueMatchText || '',
        uniqueMatchCount: hit.uniqueMatchCount || old?.uniqueMatchCount || 0,
      });
    } else if (hit.uniqueSnippet && !old.uniqueSnippet) {
      merged.set(hit.file, {
        ...old,
        uniqueSnippet: hit.uniqueSnippet,
        uniqueMatchLabel: hit.uniqueMatchLabel || '',
        uniqueMatchText: hit.uniqueMatchText || '',
        uniqueMatchCount: hit.uniqueMatchCount || 1,
      });
    }
  }
  return Array.from(merged.values());
}

function searchProjectWithMeta(project, body) {
  if (!project) throw new Error('No project selected.');
  const evidence = buildSearchEvidence(body);
  const textCache = new Map();
  const limit = boundedLimit(body.limit || 10);
  const routeResult = resolvePageRouteTrace(project, body, textCache);
  const routeHits = routeResult.hits;

  const keywordHits = [];
  for (const file of project.files) {
    if (!isTextFile(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    const scored = scoreFileText(file, text, evidence);

    if (scored.score > 0) {
      keywordHits.push({
        file: file.path,
        score: scored.score,
        stage: 'keyword',
        from: '',
        reasons: scored.reasons.slice(0, 10),
        snippet: scored.snippet,
        uniqueSnippet: scored.uniqueSnippet,
        uniqueMatchLabel: scored.uniqueMatchLabel,
        uniqueMatchText: scored.uniqueMatchText,
        uniqueMatchCount: scored.uniqueMatchCount,
      });
    }
  }

  const sortedKeywordHits = keywordHits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const reverseHits = sortedKeywordHits
    .slice(0, 6)
    .flatMap(hit => reverseComponentUsages(project, hit, textCache));
  const apiHits = traceApiReferences(project, body, evidence, textCache);
  const apiReverseHits = apiHits
    .slice(0, 6)
    .flatMap(hit => reverseComponentUsages(project, hit, textCache));
  const importChainHits = traceImportChainHits(project, [
    ...routeHits,
    ...keywordHits,
  ], [
    ...routeHits,
    ...sortedKeywordHits,
    ...reverseHits,
    ...apiHits,
    ...apiReverseHits,
  ], textCache);

  const hits = mergeHits([
    ...routeHits,
    ...importChainHits,
    ...sortedKeywordHits,
    ...reverseHits,
    ...apiHits,
    ...apiReverseHits,
  ])
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    hits,
    routeResolver: routeResult.trace,
  };
}

function searchProject(project, body) {
  return searchProjectWithMeta(project, body).hits;
}

module.exports = {
  searchProject,
  searchProjectWithMeta,
};
