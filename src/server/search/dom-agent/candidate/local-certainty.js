'use strict';

const { executeSearchPlan } = require('./search-executor');
const { inspectCandidates } = require('./candidate-inspector');
const {
  isRenderCandidate,
  compactInspectionForModel,
  buildComposite,
} = require('./candidate-relations');

function anchorKindToEvidenceKind(kind) {
  if (kind === 'class') return 'class';
  if (kind === 'attr') return 'other';
  return 'text';
}

function anchorKindToKeywordType(kind) {
  if (kind === 'class') return 'class-token';
  return '';
}

function buildLocalCertaintyPlan(locatorDecision) {
  const weakAnchors = Array.isArray(locatorDecision?.weakAnchors)
    ? locatorDecision.weakAnchors
    : [];
  const keywords = weakAnchors.map(anchor => String(anchor?.value || '').trim()).filter(Boolean);
  if (!keywords.length) return null;
  return {
    searches: [{
      keywords,
      mode: keywords.length > 1 ? 'all' : 'any',
      range: 'same-file',
      priority: 1,
      layer: 'render',
      reason: 'Planner 请求扩区前，使用 Planner weakAnchors 做严格唯一性验证',
      evidenceKinds: Object.fromEntries(weakAnchors.map(anchor => [
        anchor.value,
        anchorKindToEvidenceKind(anchor.kind),
      ])),
      keywordTypes: Object.fromEntries(weakAnchors
        .map(anchor => [anchor.value, anchorKindToKeywordType(anchor.kind)])
        .filter(([, type]) => type)),
    }],
    needMoreDom: false,
  };
}

function hasRealWeakAnchorHit(candidate, keywords) {
  const allowed = new Set(keywords);
  return (candidate?.keywordFacts || []).some(fact => {
    return allowed.has(fact.keyword)
      && fact.codeCount > 0
      && !fact.structureMismatch;
  });
}

function resolveLocalCertainty(project, body, textCache, options = {}) {
  const plan = buildLocalCertaintyPlan(options.locatorDecision);
  if (!plan) return null;
  const log = typeof options.log === 'function' ? options.log : () => {};
  log(`DOM Agent 扩区前本地唯一性验证计划：${JSON.stringify(plan)}`);
  const candidates = executeSearchPlan(project, plan, textCache);
  log(`DOM Agent 扩区前本地唯一性验证召回：${JSON.stringify({
    candidateCount: candidates.length,
    files: candidates.map(candidate => ({
      file: candidate.file,
      score: candidate.score,
      matchedGroups: (candidate.matchedGroups || []).map(group => group.keywords),
    })),
  }, null, 2)}`);
  if (!candidates.length) return null;
  const inspection = inspectCandidates(project, candidates, plan, textCache, body);
  log(`DOM Agent 扩区前本地唯一性验证检查：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);
  const keywords = plan.searches[0].keywords;
  const renderCandidates = (inspection.candidates || [])
    .filter(candidate => isRenderCandidate(candidate) && hasRealWeakAnchorHit(candidate, keywords));
  if (renderCandidates.length !== 1) {
    log(`DOM Agent 扩区前本地唯一性验证未收敛：可渲染候选 ${renderCandidates.length} 个`);
    return null;
  }
  const selected = renderCandidates[0];
  return {
    plan,
    inspection,
    selected,
    hits: [{
      file: selected.file,
      score: selected.score,
      stage: 'local-certainty-before-expand',
      preciseEvidence: true,
      sourceRole: 'render',
      reasons: ['Planner 请求扩区前，weakAnchors 已唯一命中可渲染源码'],
    }],
    composite: buildComposite(inspection, [], selected.file),
  };
}

module.exports = {
  buildLocalCertaintyPlan,
  resolveLocalCertainty,
};
