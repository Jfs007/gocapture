const { isTextFile, readProjectText } = require('../core/fs-utils');
const {
  buildSearchEvidence,
  findNeedleIndex,
  maskCommentsPreserveLength,
  scoreFileText,
  scoreRefinementLayerText,
} = require('./evidence');
const { reverseComponentUsages } = require('./component-trace');
const { traceApiReferences } = require('./api-trace');
const { buildFileMap, importedFiles, traceImportChainHits } = require('./import-trace');
const { resolvePageRouteTrace } = require('../route-resolvers/registry');
const { makeSnippet, uniq } = require('../utils');

const MAX_CLASS_BASIS_FILES = 8;
const WEAK_CONTEXT_TOKENS = new Set([
  'role',
  'menu',
  'flex',
  'grid',
  'block',
  'inline',
  'inline-flex',
  'inline-grid',
  'table',
  'relative',
  'static',
  'absolute',
  'fixed',
  'sticky',
  'auto',
  'none',
  'normal',
  'rgb',
  'rgba',
  'transparent',
]);

function boundedLimit(value, fallback = 10) {
  return Math.max(1, Math.min(Number(value || fallback), 30));
}

function isApiStage(stage) {
  return stage === 'api-endpoint' || stage === 'api-usage' || stage === 'api-upstream';
}

function hasMeaningfulKeywordEvidence(scored) {
  if (!scored) return false;
  if (scored.structuredEvidence) return true;
  const contextReasons = scored.contextReasons || [];
  const hasResourceContext = contextReasons.some(reason => /资源线索/.test(reason));
  const hasTextContext = contextReasons.some(reason => /文案|修改要求/.test(reason));
  const hasUsefulAttributeOrStyle = contextReasons.some(reasonHasUsefulAttributeOrStyle);
  const hasSpecificContext = hasTextContext || hasResourceContext || hasUsefulAttributeOrStyle;
  if (scored.classBasisEvidence) return true;
  if (scored.preciseEvidence) return true;
  if ((scored.exactMatchCount || 0) > 0) return true;
  if (scored.uniqueMatchText) return true;
  if ((scored.contextScore || 0) >= 34 && hasResourceContext) return true;
  if ((scored.contextScore || 0) >= 52 && hasUsefulAttributeOrStyle && (scored.contextStrongMatchCount || 0) >= 2) return true;
  return scored.contextScope === 'self'
    && (scored.contextScore || 0) >= 42
    && (scored.contextStrongMatchCount || 0) >= 2
    && hasSpecificContext;
}

function reasonHasUsefulAttributeOrStyle(reason) {
  if (!/属性|样式/.test(String(reason || ''))) return false;
  const [, values = ''] = String(reason || '').split('：');
  return values
    .split(/[、,\s]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .some(token => {
      const lower = token.toLowerCase();
      if (WEAK_CONTEXT_TOKENS.has(lower)) return false;
      if (/^\d+(?:\.\d+)?(?:px|rpx|em|rem|%)?$/i.test(lower)) return false;
      if (/^#[0-9a-f]{3,8}$/i.test(lower)) return false;
      return token.length >= 4;
    });
}

function shouldSearchEvidence(ev) {
  if (!ev || !ev.value) return false;
  const value = String(ev.value || '').trim();
  if (ev.kind === 'text' && value.length < 2) return false;
  if (ev.kind === 'style' && (ev.weight || 0) < 25) return false;
  if (ev.docFreq > 40) return false;
  if (ev.tier === 'C') return false;
  if (ev.strong) return true;
  return (ev.kind === 'style' || ev.kind === 'selector') && (ev.weight || 0) >= 25 && (ev.docFreq || 0) <= 12;
}

function isLikelyFrameworkFile(filePath) {
  return /(^|\/)(node_modules|dist|build|vendor)\//i.test(filePath)
    || /(^|\/)(components?\/(?:base|common|ui)|ui|icons?)\//i.test(filePath);
}

function isViewOrComponentFile(filePath) {
  return /(^|\/)(src\/)?(views?|pages?|components?|layouts?)\//i.test(filePath)
    || /\.(vue|jsx|tsx|svelte|astro|html)$/i.test(filePath);
}

function isRouteFile(filePath) {
  return /(^|\/)(router|routes|route|config\/routes)[/.]/i.test(filePath)
    || /(^|\/)(router|routes)\//i.test(filePath);
}

function findEvidenceIndex(text, ev) {
  const lowerText = String(text || '').toLowerCase();
  const value = String(ev?.value || '').trim();
  if (!lowerText || !value) return -1;
  const exact = findNeedleIndex(lowerText, value.toLowerCase());
  if (exact !== -1) return exact;

  if (ev.kind === 'style' && value.includes(':')) {
    const [key, ...rest] = value.split(':');
    const styleValue = rest.join(':').trim();
    const keyIndex = findNeedleIndex(lowerText, key.trim().toLowerCase());
    if (keyIndex === -1) return -1;
    const nearby = lowerText.slice(keyIndex, keyIndex + 160);
    if (!styleValue || nearby.includes(styleValue.toLowerCase())) return keyIndex;
  }

  if (ev.kind === 'attr' && value.includes('=')) {
    const [key, ...rest] = value.split('=');
    const attrValue = rest.join('=').trim();
    const keyIndex = findNeedleIndex(lowerText, key.trim().toLowerCase());
    if (keyIndex === -1) return -1;
    const nearby = lowerText.slice(keyIndex, keyIndex + 220);
    if (!attrValue || nearby.includes(attrValue.toLowerCase())) return keyIndex;
  }

  return -1;
}

function lineInfoAt(text, index, tokenLength) {
  const content = String(text || '');
  const safeIndex = Math.max(0, Math.min(index, content.length));
  const before = content.slice(0, safeIndex);
  const line = before.split('\n').length;
  const lineStart = content.lastIndexOf('\n', safeIndex - 1) + 1;
  let lineEnd = content.indexOf('\n', safeIndex);
  if (lineEnd === -1) lineEnd = content.length;
  const snippetStart = Math.max(lineStart, safeIndex - 180);
  const snippetEnd = Math.min(lineEnd, safeIndex + Math.max(tokenLength, 1) + 240);
  return {
    line,
    snippet: content.slice(snippetStart, snippetEnd).trim(),
  };
}

function scoreEvidenceHit(ev, filePath, snippet) {
  let score = ev.weight || 0;
  if (ev.strong) score += 18;
  if (isViewOrComponentFile(filePath)) score += 10;
  if (isRouteFile(filePath)) score -= 10;
  const lower = String(snippet || '').toLowerCase();
  const multiStrongSignals = ['class=', 'class:', 'title', 'label', 'data-', 'href', 'src', 'style', 'width', 'height']
    .filter(token => lower.includes(token)).length;
  if (multiStrongSignals >= 2) score += 30;
  return score;
}

function upsertRecallCandidate(candidates, file, score, match) {
  const old = candidates.get(file);
  if (!old) {
    candidates.set(file, {
      file,
      score,
      stage: 'evidence-recall',
      stages: ['evidence-recall'],
      matched: [match],
      apiEvidence: false,
      apiEvidenceReasons: [],
      apiEvidenceFrom: [],
      reasons: [`${match.evidence.strong ? '强证据' : '弱证据'}命中(${match.evidence.kind})：${match.evidence.value}`],
      snippet: match.snippet,
      bestWindow: '',
      structuredEvidence: true,
      contextScore: 0,
      contextReasons: [],
      contextSelectionIndex: match.evidence.selectionIndex || 0,
      contextScope: match.evidence.scope || '',
      contextLayerDepth: match.evidence.scope === 'ancestor' || match.evidence.scope === 'asset' ? 1 : 0,
      contextStrongMatchCount: match.evidence.strong ? 1 : 0,
    });
    return;
  }
  old.score += score;
  if ((old.matched || []).length < 24) old.matched.push(match);
  old.contextStrongMatchCount += match.evidence.strong ? 1 : 0;
  old.reasons = uniq([
    ...(old.reasons || []),
    `${match.evidence.strong ? '强证据' : '弱证据'}命中(${match.evidence.kind})：${match.evidence.value}`,
  ]).slice(0, 12);
  if (!old.snippet || score > (old.bestMatchScore || 0)) {
    old.snippet = match.snippet;
    old.bestMatchScore = score;
  }
}

function windowContainsEvidence(windowText, ev) {
  return findEvidenceIndex(windowText, ev) !== -1;
}

function extractContextWindows(text, matched, radius = 40) {
  const lines = String(text || '').split('\n');
  const windows = [];
  for (const item of matched || []) {
    const line = Math.max(1, Number(item.line || 1));
    const start = Math.max(0, line - 1 - Math.floor(radius / 2));
    const end = Math.min(lines.length, line - 1 + Math.ceil(radius / 2));
    const window = lines.slice(start, end).join('\n').trim();
    if (window) windows.push(window);
  }
  return uniq(windows).slice(0, 8);
}

function rescoreByWindowCooccurrence(windows, evidences) {
  let bestScore = -1;
  let bestWindow = '';
  let bestKinds = [];
  for (const windowText of windows || []) {
    let score = 0;
    const kinds = new Set();
    const matchedValues = [];
    for (const ev of evidences || []) {
      if (!windowContainsEvidence(windowText, ev)) continue;
      score += ev.strong ? ev.weight : Math.round((ev.weight || 0) * 0.45);
      kinds.add(ev.kind);
      if (matchedValues.length < 8) matchedValues.push(`${ev.kind}:${ev.value}`);
    }
    if (['class', 'text', 'attr'].every(kind => kinds.has(kind))) score += 60;
    if (['class', 'style'].every(kind => kinds.has(kind))) score += 25;
    if (['icon', 'attr'].some(kind => kinds.has(kind)) && kinds.has('class')) score += 30;
    if (score > bestScore) {
      bestScore = score;
      bestWindow = windowText;
      bestKinds = matchedValues;
    }
  }
  return {
    bonus: Math.max(bestScore, 0),
    bestWindow,
    matchedValues: bestKinds,
  };
}

function onlyMatchedWeakEvidence(candidate) {
  const matched = candidate?.matched || [];
  return matched.length > 0 && matched.every(item => !item.evidence?.strong);
}

function hasStrongBusinessEvidence(candidate) {
  return (candidate?.matched || []).some(item => item.evidence?.strong && item.evidence?.kind !== 'route');
}

function isOnlyRouteHitWithoutLocalEvidence(candidate) {
  const matched = candidate?.matched || [];
  return matched.length > 0 && matched.every(item => item.evidence?.kind === 'route');
}

function fileSetFromProject(project) {
  return new Set((project.files || []).filter(file => isTextFile(file.path)).map(file => file.path));
}

function importClosure(project, seeds, textCache, maxDepth = 4) {
  const fileMap = buildFileMap(project);
  const result = new Set();
  const queue = uniq(seeds).filter(file => fileMap.has(file)).map(file => ({ file, depth: 0 }));
  for (const item of queue) result.add(item.file);
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const child of importedFiles(project, current.file, fileMap, textCache)) {
      if (result.has(child.file)) continue;
      result.add(child.file);
      queue.push({ file: child.file, depth: current.depth + 1 });
    }
  }
  return result;
}

function importedByParents(project, targetFiles, textCache) {
  const fileMap = buildFileMap(project);
  const target = new Set(targetFiles);
  const parents = [];
  for (const file of project.files || []) {
    if (!isTextFile(file.path)) continue;
    const children = importedFiles(project, file.path, fileMap, textCache);
    if (children.some(child => target.has(child.file))) parents.push(file.path);
  }
  const siblings = new Set();
  for (const parent of parents) {
    for (const child of importedFiles(project, parent, fileMap, textCache)) {
      siblings.add(child.file);
    }
  }
  return siblings;
}

function isSharedSeedFile(filePath) {
  return /(^|\/)src\/main\.(js|ts|jsx|tsx)$/i.test(filePath)
    || /(^|\/)src\/app\.(js|ts|jsx|tsx|vue)$/i.test(filePath)
    || /(^|\/)src\/App\.(vue|jsx|tsx)$/i.test(filePath)
    || /(^|\/)src\/layouts?\//i.test(filePath)
    || /(^|\/)src\/layout\//i.test(filePath);
}

function isSharedComponentFile(filePath) {
  return /(^|\/)src\/components?\//i.test(filePath)
    || /(^|\/)src\/layouts?\//i.test(filePath)
    || /(^|\/)src\/layout\//i.test(filePath);
}

function routeRootDir(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const match = normalized.match(/^(.*\/(?:views|pages)\/[^/]+(?:\/[^/]+)*)\/(?:index|page|view)\.(vue|jsx|tsx|js|ts)$/i);
  if (match) return match[1];
  const dir = normalized.replace(/\/[^/]+$/, '');
  return /(^|\/)(views|pages)\//i.test(dir) ? dir : '';
}

function isOtherRoutePrivate(filePath, currentRouteRoot) {
  if (!currentRouteRoot) return false;
  if (!/(^|\/)(views|pages)\//i.test(filePath)) return false;
  return !filePath.startsWith(`${currentRouteRoot}/`) && filePath !== currentRouteRoot;
}

function buildSearchScopes(project, routeHits, textCache) {
  const allText = fileSetFromProject(project);
  const routeEntry = routeHits?.[0]?.file || '';
  const currentRouteRoot = routeRootDir(routeEntry);
  const currentRouteClosure = importClosure(project, routeEntry ? [routeEntry] : [], textCache, 6);
  const sharedSeeds = (project.files || [])
    .map(file => file.path)
    .filter(file => isTextFile(file) && isSharedSeedFile(file));
  const sharedClosure = importClosure(project, sharedSeeds, textCache, 4);
  const routerModules = new Set((project.files || [])
    .map(file => file.path)
    .filter(file => isTextFile(file) && isRouteFile(file)));
  const siblingImports = importedByParents(project, currentRouteClosure, textCache);
  const sharedComponents = new Set((project.files || [])
    .map(file => file.path)
    .filter(file => isTextFile(file) && isSharedComponentFile(file)));

  const scope1 = new Set([...currentRouteClosure, ...sharedClosure, ...routerModules]);
  const scope2 = new Set([...scope1, ...siblingImports]);
  const scope3 = new Set([...scope2, ...sharedComponents]);
  const scope4 = new Set([...allText]);
  const pruneOtherRoutes = scope => new Set([...scope].filter(file => !isOtherRoutePrivate(file, currentRouteRoot) || currentRouteClosure.has(file)));

  return [
    { name: 'currentRouteClosure+sharedModule+routerModule', files: pruneOtherRoutes(scope1) },
    { name: 'sameParentImports', files: pruneOtherRoutes(scope2) },
    { name: 'allSharedComponents', files: pruneOtherRoutes(scope3) },
    { name: 'fullRepo', files: scope4 },
  ].map(scope => ({
    ...scope,
    files: new Set([...scope.files].filter(file => allText.has(file))),
  }));
}

function documentFrequency(project, files, ev, textCache, limit = 60) {
  let count = 0;
  for (const filePath of files || []) {
    const file = (project.files || []).find(item => item.path === filePath);
    if (!file || !isTextFile(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    if (findEvidenceIndex(maskCommentsPreserveLength(text), ev) === -1) continue;
    count++;
    if (count > limit) break;
  }
  return count;
}

function evidenceTier(ev, docFreq) {
  if (ev.kind === 'route') return 'A';
  if (ev.strong && docFreq <= 12) return 'A';
  if (ev.strong && docFreq <= 30) return 'B';
  if ((ev.kind === 'style' || ev.kind === 'selector') && docFreq <= 8) return 'B';
  return 'C';
}

function evidencesWithRarity(project, scopeFiles, evidence, textCache) {
  return (evidence.structuredEvidences || [])
    .map(ev => {
      const docFreq = ev.kind === 'route'
        ? 1
        : documentFrequency(project, scopeFiles, ev, textCache);
      const tier = evidenceTier(ev, docFreq);
      const weight = tier === 'A'
        ? ev.weight
        : tier === 'B'
          ? Math.round((ev.weight || 0) * 0.62)
          : Math.round((ev.weight || 0) * 0.18);
      return { ...ev, docFreq, tier, weight };
    })
    .sort((a, b) => a.tier.localeCompare(b.tier) || a.docFreq - b.docFreq || b.weight - a.weight);
}

function hasStrongCooccurrence(hit) {
  const matched = hit?.matched || [];
  const strongKinds = new Set(matched.filter(item => item.evidence?.strong && item.evidence?.kind !== 'route').map(item => item.evidence.kind));
  return strongKinds.size >= 2 || (hit.reasons || []).some(reason => /同窗口共现/.test(reason) && /class:|text:|attr:|icon:/.test(reason));
}

function scopeIsGoodEnough(hits) {
  const sorted = hits.slice().sort((a, b) => b.score - a.score);
  const top1 = sorted[0];
  const top2 = sorted[1];
  if (!top1) return false;
  if (top1.score >= 180 && (!top2 || top1.score - top2.score >= 40)) return true;
  if (sorted.length <= 5 && sorted.some(hasStrongCooccurrence)) return true;
  return false;
}

function scoredSelectionHit(file, scored, options = {}) {
  return {
    file: file.path,
    score: options.score ?? scored.score,
    stage: options.stage || 'keyword',
    stages: [options.stage || 'keyword'],
    apiEvidence: false,
    apiEvidenceReasons: [],
    apiEvidenceFrom: [],
    from: options.from || '',
    reasons: uniq([
      options.reason || '',
      ...(scored.reasons || []),
    ]).slice(0, 12),
    snippet: scored.snippet,
    exactMatchLabel: scored.exactMatchLabel,
    exactMatchText: scored.exactMatchText,
    exactMatchCount: scored.exactMatchCount,
    exactSnippet: scored.exactSnippet,
    contextScore: scored.contextScore,
    contextReasons: scored.contextReasons,
    contextSelectionIndex: scored.contextSelectionIndex,
    contextScope: scored.contextScope,
    contextLayerDepth: scored.contextLayerDepth,
    contextStrongMatchCount: scored.contextStrongMatchCount,
    preciseEvidence: scored.preciseEvidence,
    preciseSnippet: scored.preciseSnippet,
    uniqueSnippet: scored.uniqueSnippet,
    uniqueMatchLabel: scored.uniqueMatchLabel,
    uniqueMatchText: scored.uniqueMatchText,
    uniqueMatchCount: scored.uniqueMatchCount,
  };
}

function scanScoredSelectionHits(project, evidence, textCache, scopeFiles, options = {}) {
  const hits = [];
  for (const file of project.files || []) {
    if (scopeFiles && !scopeFiles.has(file.path)) continue;
    if (!isTextFile(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    const scored = scoreFileText(file, text, evidence);
    if (typeof options.filter === 'function' && !options.filter(scored, file)) continue;
    const score = typeof options.score === 'function'
      ? options.score(scored, file)
      : (options.score ?? scored.score);
    if (score <= 0) continue;
    hits.push(scoredSelectionHit(file, scored, {
      stage: options.stage,
      reason: options.reason,
      score,
      from: options.from,
    }));
  }
  return hits.sort((a, b) => b.score - a.score);
}

function hasExactTextEvidence(hit) {
  return (hit?.exactMatchCount || 0) > 0 && String(hit.exactMatchText || '').trim().length > 0;
}

function isExpandedOnlyHit(hit) {
  if (!hit) return false;
  if (hit.preciseEvidence || hit.uniqueMatchText || hasExactTextEvidence(hit)) return false;
  return (hit.contextLayerDepth || 0) > 0 && hit.contextScope !== 'self';
}

function currentSelectionSeedFiles(hits) {
  return new Set((hits || [])
    .filter(hit => {
      if (!hit?.file) return false;
      if (hit.preciseEvidence || hit.uniqueMatchText || hasExactTextEvidence(hit)) return true;
      return hit.contextScope === 'self' && (hit.contextStrongMatchCount || 0) > 0;
    })
    .map(hit => hit.file));
}

function isCurrentOrParentComponent(project, filePath, currentFiles, textCache) {
  if (!filePath || !currentFiles?.size) return false;
  if (currentFiles.has(filePath)) return true;
  return !!findImportChainToTargets(project, filePath, currentFiles, textCache, 8);
}

function filterExpandedHitsByComponentRelation(project, hits, currentFiles, textCache) {
  if (!currentFiles?.size) {
    return (hits || []).filter(hit => !isExpandedOnlyHit(hit));
  }
  const skipped = [];
  const filtered = [];
  for (const hit of hits || []) {
    if (!isExpandedOnlyHit(hit)) {
      filtered.push(hit);
      continue;
    }
    if (isCurrentOrParentComponent(project, hit.file, currentFiles, textCache)) {
      filtered.push({
        ...hit,
        reasons: uniq([
          '扩区证据通过：命中文件属于当前组件或父组件链路',
          ...(hit.reasons || []),
        ]).slice(0, 12),
      });
      continue;
    }
    skipped.push(hit.file);
  }
  if (!skipped.length) return filtered;
  return filtered.map(hit => ({
    ...hit,
    reasons: uniq([
      `扩区证据过滤：跳过 ${uniq(skipped).length} 个非当前/父组件文件`,
      ...(hit.reasons || []),
    ]).slice(0, 12),
  }));
}

function exactTextIsUniqueEnough(hits) {
  const exactHits = hits.filter(hasExactTextEvidence);
  if (exactHits.length !== 1) return false;
  return true;
}

function layerScopeName(scope, layer) {
  return `${layer}：${scope?.name || 'unknown'}`;
}

function shouldUseImportChainFallback(hits, layer) {
  if (layer !== 'L4') return false;
  const meaningfulHits = (hits || []).filter(hasMeaningfulKeywordEvidence);
  if (!meaningfulHits.length) return true;
  return !scopeIsGoodEnough(meaningfulHits);
}

function recallByStructuredEvidence(project, routeHits, evidence, textCache, options = {}) {
  const scopeFiles = options.scopeFiles || fileSetFromProject(project);
  const scopedEvidences = options.scopedEvidences || evidencesWithRarity(project, scopeFiles, evidence, textCache);
  const searchableEvidences = scopedEvidences.filter(shouldSearchEvidence);
  const candidates = new Map();

  for (const hit of (routeHits || []).slice(0, 1)) {
    const routeValue = (evidence.structuredEvidences || []).find(item => item.kind === 'route')?.value || '';
    upsertRecallCandidate(candidates, hit.file, 120, {
      evidence: {
        kind: 'route',
        value: routeValue || 'route-hit',
        weight: 120,
        strong: true,
        scope: 'page',
      },
      line: 0,
      snippet: 'route-hit',
    });
  }

  if (!searchableEvidences.length) return Array.from(candidates.values());

  for (const file of project.files || []) {
    if (!scopeFiles.has(file.path)) continue;
    if (!isTextFile(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const searchableText = maskCommentsPreserveLength(text);
    for (const ev of searchableEvidences) {
      if (ev.kind === 'route') continue;
      const index = findEvidenceIndex(searchableText, ev);
      if (index === -1) continue;
      const lineInfo = lineInfoAt(text, index, ev.value.length);
      const score = scoreEvidenceHit(ev, file.path, lineInfo.snippet);
      upsertRecallCandidate(candidates, file.path, score, {
        evidence: ev,
        line: lineInfo.line,
        snippet: lineInfo.snippet,
      });
    }
  }

  for (const candidate of candidates.values()) {
    const file = (project.files || []).find(item => item.path === candidate.file);
    if (!file || !isTextFile(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    const windows = extractContextWindows(text, candidate.matched, 40);
    const rescored = rescoreByWindowCooccurrence(windows, scopedEvidences);
    candidate.score += Math.min(260, rescored.bonus);
    candidate.bestWindow = rescored.bestWindow;
    if (rescored.bestWindow) candidate.snippet = rescored.bestWindow;
    if (rescored.matchedValues.length) {
      candidate.reasons = uniq([
        ...(candidate.reasons || []),
        `同窗口共现：${rescored.matchedValues.join('，')}`,
      ]).slice(0, 12);
    }
    if (onlyMatchedWeakEvidence(candidate)) {
      candidate.score -= 80;
      candidate.reasons.push('降权：仅命中弱证据');
    }
    if (isLikelyFrameworkFile(candidate.file) && !hasStrongBusinessEvidence(candidate)) {
      candidate.score -= 60;
      candidate.reasons.push('降权：框架/公共文件缺少强业务证据');
    }
    if (isOnlyRouteHitWithoutLocalEvidence(candidate)) {
      candidate.score -= 40;
      candidate.reasons.push('降权：只有路由命中，缺少本文件局部证据');
    }
  }

  return Array.from(candidates.values())
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
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
    const mergedShared = {
      stages: mergedStages,
      apiEvidence,
      apiEvidenceReasons,
      apiEvidenceFrom,
      structuredEvidence: !!(old?.structuredEvidence || hit.structuredEvidence),
      matched: [
        ...(old?.matched || []),
        ...(hit.matched || []),
      ].slice(0, 24),
      bestWindow: hit.bestWindow || old?.bestWindow || '',
      classBasisEvidence: !!(old?.classBasisEvidence || hit.classBasisEvidence),
      classBasisToken: hit.classBasisToken || old?.classBasisToken || '',
      classBasisTrace: mergeList(old?.classBasisTrace || [], hit.classBasisTrace || []),
      classBasisSelectionIndex: hit.classBasisSelectionIndex || old?.classBasisSelectionIndex || 0,
    };

    if (!old || old.score < hit.score) {
      merged.set(hit.file, {
        ...hit,
        ...mergedShared,
        reasons: uniq([
          ...(hit.reasons || []),
          ...(old?.reasons || []),
        ]).slice(0, 12),
        exactMatchLabel: hit.exactMatchLabel || old?.exactMatchLabel || '',
        exactMatchText: hit.exactMatchText || old?.exactMatchText || '',
        exactMatchCount: hit.exactMatchCount || old?.exactMatchCount || 0,
        exactSnippet: hit.exactSnippet || old?.exactSnippet || '',
        contextScore: Math.max(hit.contextScore || 0, old?.contextScore || 0),
        contextReasons: (hit.contextReasons && hit.contextReasons.length ? hit.contextReasons : old?.contextReasons) || [],
        contextSelectionIndex: hit.contextSelectionIndex || old?.contextSelectionIndex || 0,
        contextScope: hit.contextScope || old?.contextScope || '',
        contextLayerDepth: Math.max(hit.contextLayerDepth || 0, old?.contextLayerDepth || 0),
        contextStrongMatchCount: Math.max(hit.contextStrongMatchCount || 0, old?.contextStrongMatchCount || 0),
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
        ...mergedShared,
        reasons: uniq([
          ...(hit.reasons || []),
          ...(old?.reasons || []),
        ]).slice(0, 12),
        exactMatchLabel: hit.exactMatchLabel || old?.exactMatchLabel || '',
        exactMatchText: hit.exactMatchText || old?.exactMatchText || '',
        exactMatchCount: hit.exactMatchCount || old?.exactMatchCount || 0,
        exactSnippet: hit.exactSnippet || old?.exactSnippet || '',
        contextScore: Math.max(hit.contextScore || 0, old?.contextScore || 0),
        contextReasons: (hit.contextReasons && hit.contextReasons.length ? hit.contextReasons : old?.contextReasons) || [],
        contextSelectionIndex: hit.contextSelectionIndex || old?.contextSelectionIndex || 0,
        contextScope: hit.contextScope || old?.contextScope || '',
        contextLayerDepth: Math.max(hit.contextLayerDepth || 0, old?.contextLayerDepth || 0),
        contextStrongMatchCount: Math.max(hit.contextStrongMatchCount || 0, old?.contextStrongMatchCount || 0),
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
        ...mergedShared,
        reasons: uniq([
          ...(hit.reasons || []),
          ...(old?.reasons || []),
        ]).slice(0, 12),
        exactMatchLabel: hit.exactMatchLabel || old?.exactMatchLabel || '',
        exactMatchText: hit.exactMatchText || old?.exactMatchText || '',
        exactMatchCount: hit.exactMatchCount || old?.exactMatchCount || 0,
        exactSnippet: hit.exactSnippet || old?.exactSnippet || '',
        contextScore: Math.max(hit.contextScore || 0, old?.contextScore || 0),
        contextReasons: (hit.contextReasons && hit.contextReasons.length ? hit.contextReasons : old?.contextReasons) || [],
        contextSelectionIndex: hit.contextSelectionIndex || old?.contextSelectionIndex || 0,
        contextScope: hit.contextScope || old?.contextScope || '',
        contextLayerDepth: Math.max(hit.contextLayerDepth || 0, old?.contextLayerDepth || 0),
        contextStrongMatchCount: Math.max(hit.contextStrongMatchCount || 0, old?.contextStrongMatchCount || 0),
        preciseEvidence: true,
        preciseSnippet: hit.preciseSnippet || old?.preciseSnippet || old?.snippet || '',
      });
    } else if (apiEvidence && (!old.apiEvidence || mergedStages.length !== (old.stages || []).length)) {
      merged.set(hit.file, {
        ...old,
        ...mergedShared,
        reasons: uniq([
          ...(hit.reasons || []),
          ...(old?.reasons || []),
        ]).slice(0, 12),
      });
    } else if (
      (hit.contextScore || 0) > (old?.contextScore || 0) ||
      (hit.exactMatchCount || 0) > (old?.exactMatchCount || 0) ||
      (hit.uniqueMatchCount || 0) > (old?.uniqueMatchCount || 0) ||
      (hit.snippet && !old?.snippet)
    ) {
      merged.set(hit.file, {
        ...old,
        ...mergedShared,
        reasons: uniq([
          ...(hit.reasons || []),
          ...(old?.reasons || []),
        ]).slice(0, 12),
        snippet: old?.snippet || hit.snippet || '',
        exactMatchLabel: hit.exactMatchLabel || old?.exactMatchLabel || '',
        exactMatchText: hit.exactMatchText || old?.exactMatchText || '',
        exactMatchCount: Math.max(hit.exactMatchCount || 0, old?.exactMatchCount || 0),
        exactSnippet: hit.exactSnippet || old?.exactSnippet || '',
        contextScore: Math.max(hit.contextScore || 0, old?.contextScore || 0),
        contextReasons: (hit.contextReasons && hit.contextReasons.length ? hit.contextReasons : old?.contextReasons) || [],
        contextSelectionIndex: hit.contextSelectionIndex || old?.contextSelectionIndex || 0,
        contextScope: hit.contextScore >= (old?.contextScore || 0) ? (hit.contextScope || old?.contextScope || '') : (old?.contextScope || ''),
        contextLayerDepth: Math.max(hit.contextLayerDepth || 0, old?.contextLayerDepth || 0),
        contextStrongMatchCount: Math.max(hit.contextStrongMatchCount || 0, old?.contextStrongMatchCount || 0),
        preciseEvidence: !!(hit.preciseEvidence || old?.preciseEvidence),
        preciseSnippet: old?.preciseSnippet || hit.preciseSnippet || hit.snippet || '',
        uniqueSnippet: old?.uniqueSnippet || hit.uniqueSnippet || '',
        uniqueMatchLabel: old?.uniqueMatchLabel || hit.uniqueMatchLabel || '',
        uniqueMatchText: old?.uniqueMatchText || hit.uniqueMatchText || '',
        uniqueMatchCount: Math.max(old?.uniqueMatchCount || 0, hit.uniqueMatchCount || 0),
      });
    } else if (mergedStages.length !== (old?.stages || []).length) {
      merged.set(hit.file, {
        ...old,
        ...mergedShared,
        reasons: uniq([
          ...(hit.reasons || []),
          ...(old?.reasons || []),
        ]).slice(0, 12),
      });
    }
  }
  return Array.from(merged.values());
}

function findImportChainToTargets(project, startFile, targetFiles, textCache, maxDepth = 8) {
  if (!startFile || !targetFiles?.size) return null;
  const fileMap = buildFileMap(project);
  const queue = [{
    file: startFile,
    chain: [startFile],
    via: '',
    depth: 0,
  }];
  const visited = new Set([startFile]);

  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const child of importedFiles(project, current.file, fileMap, textCache)) {
      if (visited.has(child.file)) continue;
      const chain = [...current.chain, child.file];
      if (targetFiles.has(child.file)) {
        return {
          file: child.file,
          chain,
          via: child.specifier,
        };
      }
      visited.add(child.file);
      queue.push({
        file: child.file,
        chain,
        via: child.specifier,
        depth: current.depth + 1,
      });
    }
  }
  return null;
}

function bindApiEvidenceToSelectionHits(project, selectionHits, apiHits, textCache) {
  const endpointHits = (apiHits || []).filter(hit => hit?.stage === 'api-endpoint' && hit.file);
  if (!endpointHits.length || !selectionHits.length) return [];
  const endpointByFile = new Map();
  for (const hit of endpointHits) {
    const list = endpointByFile.get(hit.file) || [];
    list.push(hit);
    endpointByFile.set(hit.file, list);
  }
  const targetFiles = new Set(endpointByFile.keys());
  const result = [];

  for (const hit of selectionHits) {
    if (!hit?.file) continue;
    const chain = findImportChainToTargets(project, hit.file, targetFiles, textCache);
    if (!chain) continue;
    const endpoints = endpointByFile.get(chain.file) || [];
    const endpointTexts = uniq(endpoints.map(item => item.from).filter(Boolean));
    const chainText = chain.chain.join(' -> ');
    const apiReasons = [
      endpointTexts.length ? `接口绑定：${endpointTexts.join('，')}` : '',
      `接口实现文件：${chain.file}`,
      `import 证据链：${chainText}`,
    ].filter(Boolean);
    result.push({
      ...hit,
      score: hit.score + 86,
      stage: hit.stage || 'keyword',
      stages: mergeList(hit.stages || hit.stage, 'api-binding'),
      apiEvidence: true,
      apiEvidenceReasons: apiReasons,
      apiEvidenceFrom: [chain.file, ...endpointTexts],
      reasons: uniq([
        ...apiReasons,
        ...(hit.reasons || []),
      ]).slice(0, 12),
      importChain: chain.chain,
    });
  }

  return result;
}

function selectionClassBasisCandidates(evidence, options = {}) {
  const allowedScopes = options.allowedScopes ? new Set(options.allowedScopes) : null;
  const structured = (evidence.structuredEvidences || [])
    .filter(item => {
      if (!item.strong || (item.kind !== 'class' && item.kind !== 'icon') || !item.value) return false;
      if (allowedScopes && !allowedScopes.has(item.scope || '')) return false;
      return true;
    })
    .map(item => ({
      token: item.value,
      selectionIndex: item.selectionIndex || 0,
      scope: item.scope || '',
      layerLabel: item.scope === 'ancestor' ? '父级扩区' : item.scope === 'asset' ? '扩大选区' : '当前选区',
    }));
  if (structured.length) {
    return uniq(structured.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
  }

  const result = [];
  for (const signal of evidence.selectionSignals || []) {
    const layers = Array.isArray(signal.layers) ? signal.layers : [];
    const self = layers.find(layer => layer.scope === 'self') || layers[0];
    const ordered = self?.ownClassOrderTokens || self?.ownClassTokens || [];
    for (const token of ordered) {
      const value = String(token || '').trim();
      if (value.length < 2) continue;
      result.push({
        token: value,
        selectionIndex: signal.index,
        layerLabel: self?.label || '当前选区',
      });
    }
  }
  return uniq(result.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
}

function classTokenIndex(text, token) {
  const lowerText = String(text || '').toLowerCase();
  const lowerToken = String(token || '').trim().toLowerCase();
  if (!lowerText || !lowerToken) return -1;
  return findNeedleIndex(lowerText, lowerToken);
}

function findOrderedClassBasisHits(project, evidence, textCache, scopeFiles = null, options = {}) {
  const candidates = selectionClassBasisCandidates(evidence, options);
  if (!candidates.length) return [];
  const trace = [];

  for (const candidate of candidates) {
    const hits = [];
    for (const file of project.files || []) {
      if (scopeFiles && !scopeFiles.has(file.path)) continue;
      if (!isTextFile(file.path)) continue;
      const text = readProjectText(project, file, textCache);
      const searchableText = maskCommentsPreserveLength(text);
      const index = classTokenIndex(searchableText, candidate.token);
      if (index === -1) continue;
      const scored = scoreFileText(file, text, evidence);
      hits.push({
        file: file.path,
        score: 132 + Math.min(82, scored.contextScore || 0),
        stage: 'class-order',
        stages: ['class-order'],
        apiEvidence: false,
        apiEvidenceReasons: [],
        apiEvidenceFrom: [],
        classBasisEvidence: true,
        classBasisToken: candidate.token,
        classBasisSelectionIndex: candidate.selectionIndex,
        from: candidate.token,
        reasons: uniq([
          `class 顺序命中：${candidate.token}`,
          `class 来源：${candidate.layerLabel} @选区${candidate.selectionIndex || ''}`.trim(),
          ...(scored.contextReasons || []),
          ...(scored.reasons || []),
        ]).slice(0, 12),
        snippet: scored.snippet || makeSnippet(text, index, candidate.token.length),
        exactMatchLabel: scored.exactMatchLabel,
        exactMatchText: scored.exactMatchText,
        exactMatchCount: scored.exactMatchCount,
        exactSnippet: scored.exactSnippet,
        contextScore: scored.contextScore,
        contextReasons: scored.contextReasons,
        contextSelectionIndex: scored.contextSelectionIndex || candidate.selectionIndex,
        contextScope: scored.contextScope,
        contextLayerDepth: scored.contextLayerDepth,
        contextStrongMatchCount: scored.contextStrongMatchCount,
        preciseEvidence: scored.preciseEvidence,
        preciseSnippet: scored.preciseSnippet,
        uniqueSnippet: scored.uniqueSnippet,
        uniqueMatchLabel: scored.uniqueMatchLabel,
        uniqueMatchText: scored.uniqueMatchText,
        uniqueMatchCount: scored.uniqueMatchCount,
      });
    }

    if (hits.length > MAX_CLASS_BASIS_FILES) {
      trace.push(`class 顺序跳过：${candidate.token} 命中文件 ${hits.length} 个，超过 ${MAX_CLASS_BASIS_FILES}`);
      continue;
    }
    if (hits.length > 0) {
      const accepted = `class 顺序采用：${candidate.token} 命中文件 ${hits.length} 个`;
      return hits.map(hit => ({
        ...hit,
        classBasisTrace: [...trace, accepted],
        reasons: uniq([
          accepted,
          ...trace,
          ...(hit.reasons || []),
        ]).slice(0, 12),
      }));
    }

    trace.push(`class 顺序未命中：${candidate.token}`);
  }

  return [];
}

function refinementLayers(evidence) {
  return (evidence.selectionSignals || [])
    .flatMap(signal => (signal.layers || [])
      .filter(layer => layer && layer.depth > 0)
      .map(layer => ({
        ...layer,
        selectionIndex: signal.index,
      })))
    .sort((a, b) => a.depth - b.depth);
}

function refineHitsByExpandedSelection(project, hits, evidence, textCache) {
  let current = hits.slice();
  for (const layer of refinementLayers(evidence)) {
    if (current.length <= 1) break;
    const matched = [];
    for (const hit of current) {
      const file = (project.files || []).find(item => item.path === hit.file);
      if (!file || !isTextFile(file.path)) continue;
      const text = readProjectText(project, file, textCache);
      const layerScore = scoreRefinementLayerText(text, layer);
      if (!layerScore.matched) continue;
      matched.push({
        ...hit,
        score: hit.score + Math.min(64, layerScore.score),
        contextScore: Math.max(hit.contextScore || 0, layerScore.score),
        contextReasons: uniq([
          ...(hit.contextReasons || []),
          ...layerScore.reasons,
        ]).slice(0, 8),
        reasons: uniq([
          `逐层扩大收窄：${layer.label}`,
          ...layerScore.reasons,
          ...(hit.reasons || []),
        ]).slice(0, 12),
        refinementLayer: layer.label,
        refinementSelectionIndex: layer.selectionIndex,
      });
    }
    if (matched.length > 0 && matched.length < current.length) {
      current = matched;
    }
  }
  return current;
}

function legacyKeywordFallback(project, evidence, textCache) {
  return scanScoredSelectionHits(project, evidence, textCache, null, {
    stage: 'keyword-fallback',
    reason: 'L4 全仓兜底：路由闭包与 Evidence 未形成稳定候选',
    filter: scored => hasMeaningfulKeywordEvidence(scored),
  });
}

function layeredSelectionHits(project, routeHits, evidence, textCache, scopes) {
  const routeScope = scopes[0] || { name: 'fullRepo', files: fileSetFromProject(project) };
  const fullScope = scopes[scopes.length - 1] || routeScope;
  let activeScope = routeScope;

  const exactHits = scanScoredSelectionHits(project, evidence, textCache, routeScope.files, {
    stage: 'route-exact-text',
    reason: `L0 路由闭包精确文案：${routeScope.name}`,
    filter: scored => (scored.exactMatchCount || 0) > 0,
    score: scored => 180
      + Math.min(140, scored.score || 0)
      + (scored.preciseEvidence ? 90 : 0)
      + (scored.uniqueMatchCount ? 40 : 0),
  });

  if (exactTextIsUniqueEnough(exactHits)) {
    return {
      hits: exactHits,
      activeScope,
      layer: 'L1',
    };
  }

  const contextHits = scanScoredSelectionHits(project, evidence, textCache, routeScope.files, {
    stage: 'route-light-context',
    reason: `L2 路由闭包轻量上下文：${routeScope.name}`,
    filter: scored => hasMeaningfulKeywordEvidence(scored),
  });
  const classBasisHits = findOrderedClassBasisHits(project, evidence, textCache, routeScope.files, {
    allowedScopes: ['self'],
  })
    .map(hit => ({
      ...hit,
      stage: hit.stage || 'class-order',
      stages: mergeList(hit.stages || hit.stage, 'route-light-context'),
      reasons: uniq([
        `L2 路由闭包 class/选区元素匹配：${routeScope.name}`,
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));
  const currentFiles = currentSelectionSeedFiles([
    ...exactHits,
    ...contextHits,
    ...classBasisHits,
  ]);
  const relationScopedContextHits = filterExpandedHitsByComponentRelation(project, contextHits, currentFiles, textCache);
  const lightContextHits = refineHitsByExpandedSelection(project, mergeHits([
    ...exactHits,
    ...relationScopedContextHits,
    ...classBasisHits,
  ]), evidence, textCache);

  if (scopeIsGoodEnough(lightContextHits)) {
    return {
      hits: lightContextHits,
      activeScope,
      layer: 'L2',
    };
  }

  let evidenceHits = [];
  const evidenceScopes = scopes.slice(0, Math.max(1, scopes.length - 1));
  for (const scope of evidenceScopes) {
    const scopedEvidences = evidencesWithRarity(project, scope.files, evidence, textCache);
    const hits = recallByStructuredEvidence(project, routeHits, evidence, textCache, {
      scopeFiles: scope.files,
      scopedEvidences,
    }).map(hit => ({
      ...hit,
      scopeName: scope.name,
      reasons: uniq([
        layerScopeName(scope, 'L3 Evidence 歧义消解'),
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));
    evidenceHits = filterExpandedHitsByComponentRelation(project, mergeHits([
      ...lightContextHits,
      ...hits,
    ]), currentFiles, textCache);
    activeScope = scope;
    if (scopeIsGoodEnough(evidenceHits)) {
      return {
        hits: evidenceHits,
        activeScope,
        layer: 'L3',
      };
    }
  }

  const fullScopedEvidences = evidencesWithRarity(project, fullScope.files, evidence, textCache);
  const fullEvidenceHits = recallByStructuredEvidence(project, routeHits, evidence, textCache, {
    scopeFiles: fullScope.files,
    scopedEvidences: fullScopedEvidences,
  }).map(hit => ({
    ...hit,
    scopeName: fullScope.name,
    reasons: uniq([
      layerScopeName(fullScope, 'L4 全仓 Evidence'),
      ...(hit.reasons || []),
    ]).slice(0, 12),
  }));
  const fullClassBasisHits = findOrderedClassBasisHits(project, evidence, textCache, fullScope.files, {
    allowedScopes: ['self'],
  })
    .map(hit => ({
      ...hit,
      reasons: uniq([
        layerScopeName(fullScope, 'L4 全仓 class/选区元素匹配'),
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));
  const fallbackHits = filterExpandedHitsByComponentRelation(
    project,
    legacyKeywordFallback(project, evidence, textCache),
    currentFiles,
    textCache
  );
  return {
    hits: filterExpandedHitsByComponentRelation(project, mergeHits([
      ...evidenceHits,
      ...fullEvidenceHits,
      ...fullClassBasisHits,
      ...fallbackHits,
    ]), currentFiles, textCache),
    activeScope: fullScope,
    layer: 'L4',
  };
}

function searchProjectWithMeta(project, body) {
  if (!project) throw new Error('No project selected.');
  const evidence = buildSearchEvidence(body);
  const textCache = new Map();
  const limit = boundedLimit(body.limit || 10);
  const routeResult = resolvePageRouteTrace(project, body, textCache);
  const routeHits = routeResult.hits;

  const scopes = buildSearchScopes(project, routeHits, textCache);
  const layered = layeredSelectionHits(project, routeHits, evidence, textCache, scopes);
  const activeScope = layered.activeScope || scopes[scopes.length - 1];
  const refinedKeywordHits = refineHitsByExpandedSelection(project, layered.hits, evidence, textCache)
    .map(hit => ({
      ...hit,
      reasons: uniq([
        `检索层级：${layered.layer}`,
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));
  const sortedKeywordHits = refinedKeywordHits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const reverseHits = sortedKeywordHits
    .slice(0, 6)
    .flatMap(hit => reverseComponentUsages(project, hit, textCache))
    .filter(hit => hasMeaningfulKeywordEvidence(hit));
  const apiHits = traceApiReferences(project, body, evidence, textCache);
  const apiTrace = apiHits.apiTrace || null;
  const apiBindingHits = bindApiEvidenceToSelectionHits(project, refinedKeywordHits, apiHits, textCache);
  const importChainHits = shouldUseImportChainFallback(refinedKeywordHits, layered.layer)
    ? traceImportChainHits(project, [
      ...routeHits.slice(0, 1),
      ...refinedKeywordHits,
    ], [
      ...routeHits,
      ...sortedKeywordHits,
      ...reverseHits,
      ...apiBindingHits,
    ], textCache).map(hit => ({
      ...hit,
      reasons: uniq([
        '检索层级：L5 引用链兜底',
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }))
    : [];

  const routeDisplayHits = routeHits.slice(0, 1).map(hit => ({
    ...hit,
    score: Math.min(hit.score || 120, 120),
    reasons: uniq([
      ...(hit.reasons || []),
      '路由只作为入口基础分；最终优先看本文件局部证据',
    ]).slice(0, 12),
  }));
  const hits = mergeHits([
    ...routeDisplayHits,
    ...importChainHits,
    ...sortedKeywordHits,
    ...reverseHits,
    ...apiBindingHits,
  ])
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    hits,
    routeResolver: routeResult.trace,
    apiTrace,
  };
}

function searchProject(project, body) {
  return searchProjectWithMeta(project, body).hits;
}

module.exports = {
  searchProject,
  searchProjectWithMeta,
};
