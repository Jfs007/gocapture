const { isTextFile, readProjectText } = require('../core/fs-utils');
const {
  buildSearchEvidence,
  findClassTokenIndex,
  findNeedleIndex,
  maskCommentsPreserveLength,
  scoreFileText,
  scoreRefinementLayerText,
} = require('./evidence');
const { traceApiReferences } = require('./api-trace');
const { traceI18nReferences } = require('./i18n-trace');
const { traceDefinitionReferences } = require('./definition-trace');
const { buildFileMap, importedFiles } = require('./import-trace');
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
const WEAK_EXACT_TEXTS = new Set([
  '详情',
  '更多',
  '编辑',
  '删除',
  '复制',
  '保存',
  '取消',
  '确认',
  '提交',
  '关闭',
  '返回',
  '查询',
  '重置',
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
  const hasTextContext = contextReasons.some(reason => /文案|修改要求/.test(reason));
  const hasClassContext = contextReasons.some(reason => /className|class/.test(reason));
  const hasSpecificContext = hasTextContext || hasClassContext;
  if (scored.classBasisEvidence) return true;
  if (scored.preciseEvidence) return true;
  if ((scored.exactMatchCount || 0) > 0) return true;
  if (scored.uniqueMatchText) return true;
  return scored.contextScope === 'self'
    && (scored.contextScore || 0) >= 42
    && (scored.contextStrongMatchCount || 0) >= 2
    && hasSpecificContext;
}

function shouldSearchEvidence(ev) {
  if (!ev || !ev.value) return false;
  const value = String(ev.value || '').trim();
  if (ev.kind === 'text' && value.length < 2) return false;
  if (ev.kind !== 'text' && ev.kind !== 'class' && ev.kind !== 'icon') return false;
  if (ev.docFreq > 40) return false;
  if (ev.tier === 'C') return false;
  return !!ev.strong;
}

function isLikelyFrameworkFile(filePath) {
  return /(^|\/)(node_modules|dist|build|vendor)\//i.test(filePath)
    || /(^|\/)(components?\/(?:base|common|ui)|ui|icons?)\//i.test(filePath);
}

function isNonRuntimeSourceFile(filePath) {
  return /(^|\/)(public|static|assets?)\/.*\.html$/i.test(filePath)
    || /(^|\/)__tests__\//i.test(filePath)
    || /\.(test|spec)\.(js|jsx|ts|tsx)$/i.test(filePath);
}

function isViewOrComponentFile(filePath) {
  if (isNonRuntimeSourceFile(filePath)) return false;
  return /(^|\/)(src\/)?(views?|pages?|components?|layouts?)\//i.test(filePath)
    || /\.(vue|jsx|tsx|svelte|astro)$/i.test(filePath)
    || /(^|\/)src\/.*\.html$/i.test(filePath);
}

function isUiSourceFile(filePath) {
  if (isNonRuntimeSourceFile(filePath)) return false;
  return isViewOrComponentFile(filePath)
    || /(^|\/)src\/(?:views?|pages?|components?|layouts?|layout)\//i.test(filePath);
}

function isStyleSourceFile(filePath) {
  return /(^|\/)src\/.*\.(css|less|scss|sass|styl)$/i.test(filePath);
}

function isUiOrStyleSourceFile(filePath) {
  return isUiSourceFile(filePath) || isStyleSourceFile(filePath);
}

function isRouteFile(filePath) {
  return /(^|\/)(router|routes|route|config\/routes)[/.]/i.test(filePath)
    || /(^|\/)(router|routes)\//i.test(filePath);
}

function findEvidenceIndex(text, ev) {
  const lowerText = String(text || '').toLowerCase();
  const value = String(ev?.value || '').trim();
  if (!lowerText || !value) return -1;
  if (ev?.kind === 'class' || ev?.kind === 'icon') {
    return findClassTokenIndex(text, value);
  }
  const exact = findNeedleIndex(lowerText, value.toLowerCase());
  if (exact !== -1) return exact;

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
  const multiStrongSignals = ['class=', 'class:', 'title', 'label']
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
    if (['class', 'text'].every(kind => kinds.has(kind))) score += 60;
    if (kinds.has('icon') && kinds.has('text')) score += 30;
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

function pascalCaseToken(value) {
  const parts = String(value || '')
    .split(/[^a-zA-Z0-9]+/)
    .map(item => item.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  return parts.map(part => `${part[0].toUpperCase()}${part.slice(1)}`).join('');
}

function valueSearchVariants(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const variants = [raw];
  const pascal = pascalCaseToken(raw);
  if (pascal && pascal !== raw) variants.push(pascal);
  const compact = raw.replace(/[^a-zA-Z0-9_$]/g, '');
  if (compact && compact !== raw && compact !== pascal) variants.push(compact);
  return uniq(variants).filter(item => item.length >= 2);
}

function findDomGroupValueIndex(searchableText, rawText, value, options = {}) {
  const raw = String(value || '').trim();
  if (!raw) return -1;
  if (options.classToken) {
    const classIndex = findClassTokenIndex(searchableText, raw);
    return classIndex;
  }
  const lowerText = String(searchableText || '').toLowerCase();
  for (const variant of valueSearchVariants(raw)) {
    const lower = variant.toLowerCase();
    const exact = findNeedleIndex(lowerText, lower);
    if (exact !== -1) return exact;
    if (/^[a-zA-Z_$][\w$]*$/.test(variant) && variant.length >= 4) {
      const regex = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[A-Za-z0-9_$]*\\b`, 'i');
      const match = regex.exec(String(rawText || ''));
      if (match) return match.index;
    }
  }
  return -1;
}

function scoreDomGroupCoverageForText(text, evidence) {
  const groups = Array.isArray(evidence?.selectionGroups) ? evidence.selectionGroups : [];
  if (!groups.length) return null;
  const rawText = String(text || '');
  const searchableText = maskCommentsPreserveLength(rawText);
  const matchedGroups = [];
  let score = 0;
  let bestSnippet = '';

  for (const group of groups) {
    const matched = [];
    const values = [
      ...(group.classTokens || []).map(value => ({ value, kind: 'class', weight: 42 })),
      ...(group.textPhrases || []).map(value => ({ value, kind: 'text', weight: 58 })),
      ...(group.attrTokens || []).map(value => ({ value, kind: 'attr', weight: 48 })),
      ...(group.resourceTokens || []).map(value => ({ value, kind: 'resource', weight: 34 })),
      ...(group.styleTokens || []).map(value => ({ value, kind: 'style', weight: 18 })),
    ];
    let groupScore = 0;
    let firstIndex = -1;
    let coreMatched = false;
    for (const item of values) {
      const index = findDomGroupValueIndex(searchableText, rawText, item.value, {
        classToken: item.kind === 'class',
      });
      if (index === -1) continue;
      matched.push(`${item.kind}:${item.value}`);
      groupScore += item.weight;
      if (item.kind !== 'style') coreMatched = true;
      if (firstIndex === -1 || index < firstIndex) firstIndex = index;
    }
    if (!matched.length || !coreMatched) continue;
    const capped = Math.min(120, groupScore);
    score += capped;
    matchedGroups.push({
      id: group.id,
      label: group.label,
      score: capped,
      matched: uniq(matched).slice(0, 8),
    });
    if (!bestSnippet && firstIndex !== -1) {
      bestSnippet = makeSnippet(rawText, firstIndex, 80);
    }
  }

  if (!matchedGroups.length) return null;
  const coverageBonus = matchedGroups.length * 68 + (matchedGroups.length >= 2 ? 128 : 0);
  return {
    score: score + coverageBonus,
    matchedGroups,
    snippet: bestSnippet,
  };
}

function domGroupCoverageHits(project, evidence, textCache, scopeFiles, options = {}) {
  if (!Array.isArray(evidence?.selectionGroups) || !evidence.selectionGroups.length) return [];
  const hits = [];
  for (const file of project.files || []) {
    if (scopeFiles && !scopeFiles.has(file.path)) continue;
    if (!isTextFile(file.path)) continue;
    if (typeof options.fileFilter === 'function' && !options.fileFilter(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    const coverage = scoreDomGroupCoverageForText(text, evidence);
    if (!coverage || coverage.matchedGroups.length < 2) continue;
    const reason = coverage.matchedGroups
      .slice(0, 5)
      .map(group => `${group.label} => ${group.matched.join('、')}`);
    hits.push({
      file: file.path,
      score: 120 + Math.min(360, coverage.score) + coverage.matchedGroups.length * 92,
      stage: 'dom-group',
      stages: ['dom-group'],
      apiEvidence: false,
      apiEvidenceReasons: [],
      apiEvidenceFrom: [],
      from: '',
      reasons: uniq([
        `DOM 子树分组覆盖：命中 ${coverage.matchedGroups.length} 个局部组`,
        ...reason,
      ]).slice(0, 12),
      snippet: coverage.snippet,
      contextScore: Math.min(240, coverage.score),
      contextReasons: reason.slice(0, 8),
      contextSelectionIndex: coverage.matchedGroups[0]?.selectionIndex || 0,
      contextScope: 'subtree-groups',
      contextLayerDepth: 0,
      contextStrongMatchCount: coverage.matchedGroups.length,
      preciseEvidence: coverage.matchedGroups.length >= 3,
      preciseSnippet: coverage.snippet,
      domGroupCoverage: coverage.matchedGroups.length,
      domGroupMatches: coverage.matchedGroups,
    });
  }
  return hits.sort((a, b) => b.score - a.score);
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
  const exactHits = hits
    .filter(hasExactTextEvidence)
    .filter(hit => {
      const text = String(hit.exactMatchText || '').replace(/\s+/g, ' ').trim();
      if (!text) return false;
      if (WEAK_EXACT_TEXTS.has(text)) return false;
      if (text.length < 4) return false;
      return true;
    });
  const files = uniq(exactHits.map(hit => hit.file));
  if (files.length !== 1) return false;
  const best = exactHits.sort((a, b) => b.score - a.score)[0];
  if (!best) return false;
  if (best.preciseEvidence) return true;
  if ((best.uniqueMatchCount || 0) >= 1) return true;
  return String(best.exactMatchText || '').length >= 6 && (best.exactMatchCount || 0) <= 2;
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
    if (isNonRuntimeSourceFile(file.path)) continue;
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
      i18nEvidence: !!(old?.i18nEvidence || hit.i18nEvidence),
      i18nKey: hit.i18nKey || old?.i18nKey || '',
      i18nText: hit.i18nText || old?.i18nText || '',
      i18nDefinitionFile: hit.i18nDefinitionFile || old?.i18nDefinitionFile || '',
      definitionEvidence: !!(old?.definitionEvidence || hit.definitionEvidence),
      definitionFile: hit.definitionFile || old?.definitionFile || '',
      definitionSymbol: hit.definitionSymbol || old?.definitionSymbol || '',
      definitionKeyPath: hit.definitionKeyPath || old?.definitionKeyPath || '',
      definitionText: hit.definitionText || old?.definitionText || '',
      domGroupCoverage: Math.max(old?.domGroupCoverage || 0, hit.domGroupCoverage || 0),
      domGroupMatches: [
        ...(old?.domGroupMatches || []),
        ...(hit.domGroupMatches || []),
      ].slice(0, 12),
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
  const isUsableClassToken = value => {
    const text = String(value || '').trim();
    if (!text) return false;
    return !/^((n|el|ant|ivu|van|arco|semi|q|v)-|router-link-)/.test(text)
      && !/(--active|--selected|--disabled|--focus|--hover|is-active|is-selected|active|selected|disabled)$/i.test(text);
  };
  const structured = (evidence.structuredEvidences || [])
    .filter(item => {
      if (!item.strong || (item.kind !== 'class' && item.kind !== 'icon') || !item.value) return false;
      if (allowedScopes && !allowedScopes.has(item.scope || '')) return false;
      if (item.kind === 'class' && !isUsableClassToken(item.value)) return false;
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
      if (!isUsableClassToken(value)) continue;
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
  return findClassTokenIndex(text, token);
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

function evidenceForScopes(evidence, scopes) {
  const allowedScopes = new Set(scopes || ['self']);
  const tokens = [];
  const phrases = [];
  const addToken = (token, weight, label) => {
    const value = String(token || '').trim();
    if (value.length >= 2) tokens.push({ token: value, weight, label });
  };
  const addPhrase = (text, weight, label) => {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length >= 2) phrases.push({ text: value, weight, label });
  };

  const selectionSignals = [];
  for (const signal of evidence.selectionSignals || []) {
    const scopedLayers = (signal.layers || []).filter(layer => allowedScopes.has(layer.scope || ''));
    if (!scopedLayers.length) continue;
    for (const layer of scopedLayers) {
      for (const cls of layer.ownClassOrderTokens || layer.ownClassTokens || []) addToken(cls, 58, 'className');
      for (const text of layer.ownTextPhrases || []) addPhrase(text, 104, '选区文案');
      for (const token of layer.ownTextTokens || []) addToken(token, 28, '选区文案');
    }
    selectionSignals.push({
      ...signal,
      layers: scopedLayers,
    });
  }

  const tokenMap = new Map();
  for (const item of tokens) {
    const key = item.token.toLowerCase();
    const old = tokenMap.get(key);
    if (!old || old.weight < item.weight) tokenMap.set(key, item);
  }
  const phraseMap = new Map();
  for (const item of phrases) {
    const key = item.text.toLowerCase();
    const old = phraseMap.get(key);
    if (!old || old.weight < item.weight) phraseMap.set(key, item);
  }

  return {
    tokens: Array.from(tokenMap.values()).slice(0, 80),
    phrases: Array.from(phraseMap.values()).slice(0, 40),
    selectionSignals,
    structuredEvidences: (evidence.structuredEvidences || [])
      .filter(item => allowedScopes.has(item.scope || '') && (item.kind === 'text' || item.kind === 'class' || item.kind === 'icon')),
  };
}

function selfOnlyEvidence(evidence) {
  return evidenceForScopes(evidence, ['self']);
}

function hasInitialSelectionEvidence(scored) {
  if (!scored) return false;
  if (scored.preciseEvidence || scored.uniqueMatchText || hasExactTextEvidence(scored)) return true;
  if (scored.contextScope !== 'self') return false;
  if ((scored.contextStrongMatchCount || 0) <= 0 || (scored.contextScore || 0) < 18) return false;
  const reasons = scored.contextReasons || [];
  if (reasons.some(reason => /文案/.test(reason))) return true;
  const classText = reasons
    .filter(reason => /className|class/.test(reason))
    .join('、');
  if (!classText) return false;
  const classes = classText
    .split(/[：:、,\s]+/)
    .map(item => item.trim())
    .filter(item => /^[a-zA-Z0-9_-]{2,}$/.test(item))
    .filter(item => !/^(class|classname|当前选区|同文件命中)$/i.test(item));
  return classes.some(cls => !/^((n|el|ant|ivu|van|arco|semi|q|v)-|router-link-)/.test(cls));
}

function searchInitialHitsWithEvidence(project, scopedEvidence, textCache, scopeFiles, stage, reason, options = {}) {
  const fileFilter = typeof options.fileFilter === 'function' ? options.fileFilter : () => true;
  const textHits = scanScoredSelectionHits(project, scopedEvidence, textCache, scopeFiles, {
    stage,
    reason,
    filter: (scored, file) => fileFilter(file.path) && hasInitialSelectionEvidence(scored),
    score: scored => scored.score + (scored.exactMatchCount ? 46 : 0),
  });
  const classHits = findOrderedClassBasisHits(project, scopedEvidence, textCache, scopeFiles, {
    allowedScopes: options.allowedScopes || ['self'],
  })
    .filter(hit => fileFilter(hit.file))
    .map(hit => ({
      ...hit,
      stage: hit.stage || stage,
      stages: mergeList(hit.stages || hit.stage, stage),
      reasons: uniq([
        reason,
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));

  return mergeHits([...textHits, ...classHits])
    .filter(hasMeaningfulKeywordEvidence)
    .sort((a, b) => b.score - a.score);
}

function searchInitialSelectionHits(project, evidence, textCache, scopeFiles, stage, reason, options = {}) {
  const fileFilter = options.fileFilter || isUiSourceFile;
  const selfHits = searchInitialHitsWithEvidence(project, selfOnlyEvidence(evidence), textCache, scopeFiles, stage, reason, {
    allowedScopes: ['self'],
    fileFilter,
  });
  if (selfHits.length || !options.allowAncestorFallback) return selfHits;

  const ancestorEvidence = evidenceForScopes(evidence, ['ancestor', 'asset']);
  return searchInitialHitsWithEvidence(project, ancestorEvidence, textCache, scopeFiles, stage, `${reason}；当前节点无命中，启用父级扩区初始命中`, {
    allowedScopes: ['ancestor', 'asset'],
    fileFilter,
  }).map(hit => ({
    ...hit,
    score: Math.round(hit.score * 0.88),
    reasons: uniq([
      '当前节点源码证据不足，使用父级扩区 class/文案定位公共组件',
      ...(hit.reasons || []),
    ]).slice(0, 12),
  }));
}

function buildImportGraph(project, textCache) {
  const fileMap = buildFileMap(project);
  const children = new Map();
  const parents = new Map();
  for (const filePath of fileMap.keys()) {
    const imported = importedFiles(project, filePath, fileMap, textCache);
    children.set(filePath, imported);
    for (const child of imported) {
      const list = parents.get(child.file) || [];
      list.push({ file: filePath, specifier: child.specifier });
      parents.set(child.file, list);
    }
  }
  return { fileMap, children, parents };
}

function findImportPath(graph, startFile, targetFile, maxDepth = 10) {
  if (!startFile || !targetFile || !graph?.children?.has(startFile)) return [];
  if (startFile === targetFile) return [startFile];
  const queue = [{ file: startFile, chain: [startFile], depth: 0 }];
  const visited = new Set([startFile]);
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const child of graph.children.get(current.file) || []) {
      if (visited.has(child.file)) continue;
      const chain = [...current.chain, child.file];
      if (child.file === targetFile) return chain;
      visited.add(child.file);
      queue.push({ file: child.file, chain, depth: current.depth + 1 });
    }
  }
  return [];
}

function relationKind(filePath, hitFile, chain, parentFiles, siblingFiles, localFiles) {
  if (filePath === hitFile) return 'initial';
  if (chain.includes(filePath)) return 'chain';
  if (parentFiles.has(filePath)) return 'parent';
  if (siblingFiles.has(filePath)) return 'sibling';
  if (localFiles.has(filePath)) return 'local-import';
  return 'related';
}

function relatedFilesForInitialHit(project, hitFile, routeEntry, graph, scopeFiles) {
  const allowed = scopeFiles || fileSetFromProject(project);
  const chain = routeEntry ? findImportPath(graph, routeEntry, hitFile, 12) : [];
  const parents = (graph.parents.get(hitFile) || [])
    .map(item => item.file)
    .filter(file => allowed.has(file));
  const parentFiles = new Set(parents);
  const siblingFiles = new Set();
  for (const parent of parents) {
    for (const child of graph.children.get(parent) || []) {
      if (allowed.has(child.file)) siblingFiles.add(child.file);
    }
  }
  const localFiles = new Set((graph.children.get(hitFile) || [])
    .map(item => item.file)
    .filter(file => allowed.has(file)));
  const related = uniq([
    hitFile,
    ...chain,
    ...parents,
    ...siblingFiles,
    ...localFiles,
  ]).filter(file => allowed.has(file));
  return {
    chain: chain.length ? chain : [hitFile],
    parentFiles,
    siblingFiles,
    localFiles,
    related,
  };
}

function relationBoost(kind) {
  if (kind === 'initial') return 86;
  if (kind === 'parent') return 62;
  if (kind === 'chain') return 44;
  if (kind === 'sibling') return 46;
  if (kind === 'local-import') return 36;
  return 24;
}

function relationLabel(kind) {
  if (kind === 'initial') return '初始文件';
  if (kind === 'chain') return '页面引用链';
  if (kind === 'parent') return '父组件/引用方';
  if (kind === 'sibling') return '兄弟依赖';
  if (kind === 'local-import') return '子依赖';
  return '相关文件';
}

function firstMatchedValueInText(text, values) {
  const lowerText = String(text || '').toLowerCase();
  for (const value of values || []) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    const index = findNeedleIndex(lowerText, raw.toLowerCase());
    if (index !== -1) return { index, value: raw };
  }
  return null;
}

function bundleInitialHits(project, hits, evidence, textCache, routeEntry, scopeFiles, graph) {
  if (!hits.length) return [];
  const initialHits = mergeHits(hits);
  const initialFileSet = new Set(initialHits.map(hit => hit.file));
  let bundles = initialHits.map(hit => {
    const relation = relatedFilesForInitialHit(project, hit.file, routeEntry, graph, scopeFiles);
    let bestGroupCoverage = null;
    for (const filePath of relation.related) {
      const file = (project.files || []).find(item => item.path === filePath);
      if (!file || !isTextFile(file.path)) continue;
      const text = readProjectText(project, file, textCache);
      const coverage = scoreDomGroupCoverageForText(text, evidence);
      if (!coverage) continue;
      const kind = relationKind(
        filePath,
        hit.file,
        relation.chain,
        relation.parentFiles,
        relation.siblingFiles,
        relation.localFiles
      );
      const score = coverage.score + relationBoost(kind);
      if (!bestGroupCoverage || score > bestGroupCoverage.score) {
        bestGroupCoverage = {
          file: filePath,
          kind,
          score,
          coverage,
        };
      }
    }
    return {
      hit,
      relation,
      promotedFile: bestGroupCoverage && bestGroupCoverage.file !== hit.file ? bestGroupCoverage.file : hit.file,
      promotedSnippet: bestGroupCoverage?.coverage?.snippet || '',
      layerMatched: !!bestGroupCoverage,
      layerScore: bestGroupCoverage ? Math.min(420, bestGroupCoverage.score) : 0,
      layerReasons: bestGroupCoverage ? [
        `DOM 分组链路确认：${bestGroupCoverage.coverage.matchedGroups.length} 个局部组命中${relationLabel(bestGroupCoverage.kind)} ${bestGroupCoverage.file}`,
        ...bestGroupCoverage.coverage.matchedGroups.slice(0, 4).map(group => `${group.label} => ${group.matched.join('、')}`),
      ] : [],
      domGroupMatches: bestGroupCoverage?.coverage?.matchedGroups || [],
    };
  });

  for (const layer of refinementLayers(evidence).slice(0, 4)) {
    if (bundles.length <= 1) break;
    const matchedBundles = [];
    for (const bundle of bundles) {
      let best = null;
      for (const filePath of bundle.relation.related) {
        const file = (project.files || []).find(item => item.path === filePath);
        if (!file || !isTextFile(file.path)) continue;
        const text = readProjectText(project, file, textCache);
        const layerScore = scoreRefinementLayerText(text, layer);
        if (!layerScore.matched) continue;
        const kind = relationKind(
          filePath,
          bundle.hit.file,
          bundle.relation.chain,
          bundle.relation.parentFiles,
          bundle.relation.siblingFiles,
          bundle.relation.localFiles
        );
        const score = relationBoost(kind) + Math.min(128, layerScore.score);
        if (!best || score > best.score) {
          const source = firstLayerSnippetSource(text, layer);
          best = {
            file: filePath,
            kind,
            score,
            snippet: source
              ? makeSnippet(text, source.index, source.value.length)
              : bundle.hit.snippet,
            reasons: layerScore.reasons,
          };
        }
      }
      if (!best) continue;
      matchedBundles.push({
        ...bundle,
        layerMatched: true,
        layerScore: bundle.layerScore + best.score,
        promotedFile: best.kind === 'initial' || initialFileSet.has(best.file) ? bundle.promotedFile : best.file,
        promotedSnippet: best.snippet || bundle.promotedSnippet,
        layerReasons: uniq([
          ...(bundle.layerReasons || []),
          `扩区链路确认：${layer.label} 命中${relationLabel(best.kind)} ${best.file}`,
          ...best.reasons,
        ]).slice(0, 10),
      });
    }
    if (matchedBundles.length > 0 && matchedBundles.length < bundles.length) {
      bundles = matchedBundles;
    } else if (matchedBundles.length) {
      const byFile = new Map(matchedBundles.map(item => [item.hit.file, item]));
      bundles = bundles.map(item => byFile.get(item.hit.file) || item);
    }
  }

  return bundles.map(bundle => {
    const promote = bundle.promotedFile && bundle.promotedFile !== bundle.hit.file;
    const chainDepthPenalty = Math.min(128, Math.max(0, (bundle.relation.chain.length || 1) - 3) * 24);
    return {
      ...bundle.hit,
      file: promote ? bundle.promotedFile : bundle.hit.file,
      score: bundle.hit.score + bundle.layerScore + (bundle.relation.chain.length > 1 ? 28 : 0) - chainDepthPenalty,
      stage: bundle.hit.stage || 'local-bundle',
      stages: mergeList(bundle.hit.stages || bundle.hit.stage, 'local-bundle'),
      from: promote ? bundle.hit.file : '',
      snippet: bundle.promotedSnippet || bundle.hit.snippet,
      importChain: bundle.relation.chain.length > 1 ? bundle.relation.chain : bundle.hit.importChain,
      domGroupCoverage: Math.max(bundle.hit.domGroupCoverage || 0, bundle.domGroupMatches?.length || 0),
      domGroupMatches: bundle.domGroupMatches?.length ? bundle.domGroupMatches : bundle.hit.domGroupMatches,
      reasons: uniq([
        promote ? `初始命中：${bundle.hit.file}` : '',
        bundle.relation.chain.length > 1 ? `页面引用链：${bundle.relation.chain.join(' -> ')}` : '',
        chainDepthPenalty ? `降权：页面引用链较深，优先当前组件或父组件关系` : '',
        ...bundle.layerReasons,
        ...(bundle.hit.reasons || []),
      ]).slice(0, 12),
    };
  }).sort((a, b) => b.score - a.score);
}

function firstLayerSnippetSource(text, layer) {
  const textSource = firstMatchedValueInText(text, [
    ...(layer.ownTextPhrases || []),
    ...(layer.ownTextTokens || []),
  ]);
  if (textSource) return textSource;
  for (const token of layer.ownClassTokens || []) {
    const index = findClassTokenIndex(text, token);
    if (index !== -1) return { index, value: token };
  }
  return null;
}

function stableLocalHits(hits) {
  const sorted = hits.slice().sort((a, b) => b.score - a.score);
  const top1 = sorted[0];
  const top2 = sorted[1];
  if (!top1) return false;
  if (sorted.length === 1) return true;
  if (top1.score >= 220 && top1.score - top2.score >= 46) return true;
  if (sorted.length <= 4 && top1.score >= 170) return true;
  return false;
}

function legacyKeywordFallback(project, evidence, textCache) {
  return scanScoredSelectionHits(project, evidence, textCache, null, {
    stage: 'keyword-fallback',
    reason: 'L4 全仓兜底：路由闭包与 Evidence 未形成稳定候选',
    filter: scored => hasMeaningfulKeywordEvidence(scored),
  });
}

function strongestSelectionKind(evidence) {
  return (evidence?.selectionKinds || [])
    .slice()
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0] || null;
}

function isNavLikeSelectionKind(kind) {
  return kind === 'route-link-like' || kind === 'global-nav-like';
}

function hasSharedNavEvidence(evidence) {
  const structured = Array.isArray(evidence?.structuredEvidences) ? evidence.structuredEvidences : [];
  const hasNavClass = structured.some(item =>
    (item.kind === 'class' || item.kind === 'icon')
    && /(nav|menu|submenu|sidebar|sider|topnav|navbar|header|tab|tabs)/i.test(String(item.value || ''))
  );
  if (!hasNavClass) return false;
  const iconCount = structured.filter(item => item.kind === 'icon').length;
  const shortTexts = structured
    .filter(item => item.kind === 'text' && String(item.value || '').trim().length <= 12)
    .map(item => String(item.value || '').trim())
    .filter(Boolean);
  const hasHrefPath = structured.some(item => item.kind === 'text' && /^\/[\w/-]+/.test(String(item.value || '')));
  return uniq(shortTexts).length >= 2 || hasHrefPath || iconCount >= 1;
}

function buildLayeredScopePlan(project, routeHits, evidence, textCache, scopes) {
  const routeEntry = routeHits?.[0]?.file || '';
  const allScope = scopes[scopes.length - 1] || { name: 'fullRepo', files: fileSetFromProject(project) };
  const routeClosureFiles = routeEntry
    ? importClosure(project, [routeEntry], textCache, 8)
    : new Set();
  const navLike = isNavLikeSelectionKind(strongestSelectionKind(evidence)?.kind)
    || hasSharedNavEvidence(evidence);

  if (navLike) {
    return [
      scopes[0] ? { name: 'L0 共享布局 + router 优先', files: scopes[0].files } : null,
      scopes[2] ? { name: 'L1 共享组件兜底', files: scopes[2].files } : null,
      { name: 'L2 全仓类/文案兜底', files: allScope.files },
    ].filter(scope => scope && scope.files && scope.files.size);
  }

  return [
    routeEntry ? { name: 'L0 当前页面模块闭包', files: routeClosureFiles } : null,
    scopes[0] ? { name: 'L1 页面闭包 + 共享入口', files: scopes[0].files } : null,
    scopes[2] ? { name: 'L2 共享组件兜底', files: scopes[2].files } : null,
    { name: 'L3 全仓类/文案兜底', files: allScope.files },
  ].filter(scope => scope && scope.files && scope.files.size);
}

function layeredSelectionHits(project, routeHits, evidence, textCache, scopes) {
  const routeEntry = routeHits?.[0]?.file || '';
  const graph = buildImportGraph(project, textCache);
  const allScope = scopes[scopes.length - 1] || { name: 'fullRepo', files: fileSetFromProject(project) };
  const scopePlan = buildLayeredScopePlan(project, routeHits, evidence, textCache, scopes);

  let last = { hits: [], activeScope: allScope, layer: 'L3' };
  for (const scope of scopePlan) {
    const initialHits = searchInitialSelectionHits(
      project,
      evidence,
      textCache,
      scope.files,
      'local-initial',
      `${scope.name}：仅用当前选区文案/class 初始命中`,
      {
        allowAncestorFallback: true,
        fileFilter: isUiSourceFile,
      }
    );
    const bundledHits = bundleInitialHits(project, initialHits, evidence, textCache, routeEntry, scope.files, graph)
      .map(hit => ({
        ...hit,
        reasons: uniq([
          `检索层级：${scope.name}`,
          ...(hit.reasons || []),
        ]).slice(0, 12),
      }));
    const groupHits = domGroupCoverageHits(project, evidence, textCache, scope.files, {
      fileFilter: isUiOrStyleSourceFile,
    }).map(hit => ({
      ...hit,
      reasons: uniq([
        `检索层级：${scope.name}`,
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));
    const localStructuredHits = mergeHits([
      ...bundledHits,
      ...groupHits,
    ]).sort((a, b) => b.score - a.score);
    if (stableLocalHits(localStructuredHits) || exactTextIsUniqueEnough(localStructuredHits)) {
      return {
        hits: localStructuredHits,
        activeScope: scope,
        layer: scope.name.replace(/：.*$/, ''),
      };
    }
    const recalledHits = recallByStructuredEvidence(project, routeHits, evidence, textCache, {
      scopeFiles: scope.files,
    }).map(hit => ({
      ...hit,
      reasons: uniq([
        `检索层级：${scope.name}`,
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));
    const mergedScopeHits = mergeHits([
      ...localStructuredHits,
      ...recalledHits,
    ]).sort((a, b) => b.score - a.score);
    last = {
      hits: mergedScopeHits,
      activeScope: scope,
      layer: scope.name.replace(/：.*$/, ''),
    };
    if (stableLocalHits(mergedScopeHits)) return last;
    if (exactTextIsUniqueEnough(mergedScopeHits)) return last;
  }
  return last;
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
  const localHits = (layered.hits || [])
    .map(hit => ({
      ...hit,
      reasons: uniq([
        `检索层级：${layered.layer}`,
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));
  const sortedKeywordHits = localHits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const i18nTrace = traceI18nReferences(project, body, evidence, textCache, routeHits);
  const i18nHits = i18nTrace.hits || [];
  const definitionTrace = traceDefinitionReferences(project, body, evidence, textCache);
  const definitionHits = definitionTrace.hits || [];
  const apiHits = traceApiReferences(project, body, evidence, textCache);
  const apiTrace = apiHits.apiTrace || null;

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
    ...sortedKeywordHits,
    ...i18nHits,
    ...definitionHits,
  ])
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    hits,
    routeResolver: routeResult.trace,
    apiTrace,
    i18nTrace,
    definitionTrace,
  };
}

function searchProject(project, body) {
  return searchProjectWithMeta(project, body).hits;
}

module.exports = {
  searchProject,
  searchProjectWithMeta,
};
