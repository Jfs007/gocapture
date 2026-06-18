const { isTextFile, readProjectText } = require('../fs-utils');
const { buildSearchEvidence, scoreFileText } = require('./evidence');
const { reverseComponentUsages } = require('./component-trace');
const { traceApiReferences } = require('./api-trace');
const { traceImportChainHits } = require('./import-trace');
const { resolvePageRouteTrace } = require('../route-resolvers/registry');
const { uniq } = require('../utils');

function boundedLimit(value, fallback = 10) {
  return Math.max(1, Math.min(Number(value || fallback), 30));
}

function isApiStage(stage) {
  return stage === 'api-endpoint' || stage === 'api-usage' || stage === 'api-upstream';
}

function mergeList(...lists) {
  return uniq(lists.flatMap(list => Array.isArray(list) ? list : [list])).slice(0, 12);
}

function mergeHits(hits) {
  const merged = new Map();
  for (const hit of hits) {
    const old = merged.get(hit.file);
    const mergedStages = mergeList(old?.stages || old?.stage, hit.stages || hit.stage);
    const apiEvidence = !!(old?.apiEvidence || hit.apiEvidence || isApiStage(hit.stage));
    const apiEvidenceReasons = apiEvidence
      ? mergeList(
        old?.apiEvidenceReasons || [],
        hit.apiEvidenceReasons || [],
        isApiStage(hit.stage) ? (hit.reasons || []) : []
      )
      : [];
    const apiEvidenceFrom = apiEvidence
      ? mergeList(
        old?.apiEvidenceFrom || [],
        hit.apiEvidenceFrom || [],
        isApiStage(hit.stage) ? hit.from : ''
      )
      : [];

    if (!old || old.score < hit.score) {
      merged.set(hit.file, {
        ...hit,
        stages: mergedStages,
        apiEvidence,
        apiEvidenceReasons,
        apiEvidenceFrom,
        exactMatchLabel: hit.exactMatchLabel || old?.exactMatchLabel || '',
        exactMatchText: hit.exactMatchText || old?.exactMatchText || '',
        exactMatchCount: hit.exactMatchCount || old?.exactMatchCount || 0,
        exactSnippet: hit.exactSnippet || old?.exactSnippet || '',
        contextScore: Math.max(hit.contextScore || 0, old?.contextScore || 0),
        contextReasons: (hit.contextReasons && hit.contextReasons.length ? hit.contextReasons : old?.contextReasons) || [],
        contextSelectionIndex: hit.contextSelectionIndex || old?.contextSelectionIndex || 0,
        preciseEvidence: !!(hit.preciseEvidence || old?.preciseEvidence),
        preciseSnippet: hit.preciseSnippet || old?.preciseSnippet || '',
        uniqueSnippet: hit.uniqueSnippet || old?.uniqueSnippet || '',
        uniqueMatchLabel: hit.uniqueMatchLabel || old?.uniqueMatchLabel || '',
        uniqueMatchText: hit.uniqueMatchText || old?.uniqueMatchText || '',
        uniqueMatchCount: hit.uniqueMatchCount || old?.uniqueMatchCount || 0,
      });
    } else if (hit.uniqueSnippet && !old.uniqueSnippet) {
      merged.set(hit.file, {
        ...old,
        stages: mergedStages,
        apiEvidence,
        apiEvidenceReasons,
        apiEvidenceFrom,
        exactMatchLabel: hit.exactMatchLabel || old?.exactMatchLabel || '',
        exactMatchText: hit.exactMatchText || old?.exactMatchText || '',
        exactMatchCount: hit.exactMatchCount || old?.exactMatchCount || 0,
        exactSnippet: hit.exactSnippet || old?.exactSnippet || '',
        contextScore: Math.max(hit.contextScore || 0, old?.contextScore || 0),
        contextReasons: (hit.contextReasons && hit.contextReasons.length ? hit.contextReasons : old?.contextReasons) || [],
        contextSelectionIndex: hit.contextSelectionIndex || old?.contextSelectionIndex || 0,
        preciseEvidence: !!(hit.preciseEvidence || old?.preciseEvidence),
        preciseSnippet: hit.preciseSnippet || old?.preciseSnippet || '',
        uniqueSnippet: hit.uniqueSnippet,
        uniqueMatchLabel: hit.uniqueMatchLabel || '',
        uniqueMatchText: hit.uniqueMatchText || '',
        uniqueMatchCount: hit.uniqueMatchCount || 1,
      });
    } else if (hit.preciseEvidence && !old.preciseEvidence) {
      merged.set(hit.file, {
        ...old,
        stages: mergedStages,
        apiEvidence,
        apiEvidenceReasons,
        apiEvidenceFrom,
        exactMatchLabel: hit.exactMatchLabel || old?.exactMatchLabel || '',
        exactMatchText: hit.exactMatchText || old?.exactMatchText || '',
        exactMatchCount: hit.exactMatchCount || old?.exactMatchCount || 0,
        exactSnippet: hit.exactSnippet || old?.exactSnippet || '',
        contextScore: Math.max(hit.contextScore || 0, old?.contextScore || 0),
        contextReasons: (hit.contextReasons && hit.contextReasons.length ? hit.contextReasons : old?.contextReasons) || [],
        contextSelectionIndex: hit.contextSelectionIndex || old?.contextSelectionIndex || 0,
        preciseEvidence: true,
        preciseSnippet: hit.preciseSnippet || old?.preciseSnippet || old?.snippet || '',
      });
    } else if (apiEvidence && (!old.apiEvidence || mergedStages.length !== (old.stages || []).length)) {
      merged.set(hit.file, {
        ...old,
        stages: mergedStages,
        apiEvidence,
        apiEvidenceReasons,
        apiEvidenceFrom,
      });
    } else if (mergedStages.length !== (old?.stages || []).length) {
      merged.set(hit.file, {
        ...old,
        stages: mergedStages,
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
        stages: ['keyword'],
        apiEvidence: false,
        apiEvidenceReasons: [],
        apiEvidenceFrom: [],
        from: '',
        reasons: scored.reasons.slice(0, 10),
        snippet: scored.snippet,
        exactMatchLabel: scored.exactMatchLabel,
        exactMatchText: scored.exactMatchText,
        exactMatchCount: scored.exactMatchCount,
        exactSnippet: scored.exactSnippet,
        contextScore: scored.contextScore,
        contextReasons: scored.contextReasons,
        contextSelectionIndex: scored.contextSelectionIndex,
        preciseEvidence: scored.preciseEvidence,
        preciseSnippet: scored.preciseSnippet,
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
