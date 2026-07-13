const path = require('path');
const { isTextFile, readProjectText } = require('../../core/fs-utils');
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
const { buildFileMap, importedFiles } = require('../import-trace');
const { resolvePageRouteTrace } = require('../../route-resolvers/registry');
const { escapeRegExp, kebabCase, makeSnippet, posixPath, uniq } = require('../../utils');

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

function countMatches(text, pattern) {
  const content = String(text || '');
  if (!content) return 0;
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  let count = 0;
  while (regex.exec(content)) count++;
  return count;
}

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

function isLikelyGlobalStyleOverrideFile(filePath, text) {
  if (!isStyleSourceFile(filePath)) return false;
  let score = 0;
  const normalizedPath = String(filePath || '').replace(/\\/g, '/');
  if (/(^|\/)(styles?|theme|themes|design|tokens?|vars?|reset|common|global)\//i.test(normalizedPath)) score += 24;
  if (/(^|\/)(design|theme|global|common|reset|var|vars|token)\.(css|less|scss|sass|styl)$/i.test(normalizedPath)) score += 18;

  // 覆写第三方控件/子组件「内部结构」的信号，框架无关（不点名任何 UI 库前缀，含自研设计体系皆成立）：
  //  · 样式穿透进别的组件内部 DOM（:deep/::v-deep/>>>//deep/）——组件给自己写样式无需穿透；
  //  · 大量「扁平的深层结构类选择器」（.block__el / .block--mod）——针对的是控件库/子组件内部完整类名，
  //    而非本组件自身的语义类（后者在 SFC 里多以 & 嵌套书写，不会是扁平全名选择器）。
  const penetrationCount = countMatches(text, /:deep\s*\(|::v-deep|:v-deep|>>>|\/deep\//g);
  const flatInternalSelectorCount = countMatches(text, /(?:^|[\s,{])\.[a-z][\w-]*(?:__|--)[\w-]+/gi);
  const overrideInternalSignal = penetrationCount * 3 + flatInternalSelectorCount;
  if (overrideInternalSignal >= 8) score += 26;
  else if (overrideInternalSignal >= 4) score += 14;

  const cssVarCount = countMatches(text, /--[\w-]+\s*:/g);
  if (cssVarCount >= 8) score += 22;
  else if (cssVarCount >= 4) score += 10;

  const importantCount = countMatches(text, /!important/g);
  if (importantCount >= 3) score += 10;

  const businessSignalCount =
    countMatches(text, /<template[\s>]/g)
    + countMatches(text, /\b(?:onClick|@click|emit\s*\(|dialog\.|message\.|useTable\b|render\s*:)\b/g);
  if (businessSignalCount === 0) score += 12;

  return score >= 54;
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
  if (ev.strong && ev.kind === 'class') score += 12;
  if (isBridgeEvidence(ev)) score += 110;
  if (isViewOrComponentFile(filePath)) score += 10;
  if (isRouteFile(filePath)) score -= 10;
  const lower = String(snippet || '').toLowerCase();
  const multiStrongSignals = ['class=', 'class:', 'title', 'label']
    .filter(token => lower.includes(token)).length;
  if (multiStrongSignals >= 2) score += 30;
  return score;
}

function isBridgeEvidence(ev) {
  return /桥接证据/.test(String(ev?.label || ''));
}

function candidateHasEvidence(candidate, predicate) {
  return (candidate?.matched || []).some(item => predicate(item.evidence || {}));
}

function candidateEvidenceKinds(candidate) {
  return new Set((candidate?.matched || []).map(item => item.evidence?.kind).filter(Boolean));
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

function hitHasBusinessTextSignal(hit) {
  const exactTexts = [
    String(hit?.exactMatchText || '').trim(),
    String(hit?.uniqueMatchText || '').trim(),
  ].filter(Boolean);
  if (exactTexts.some(text => !WEAK_EXACT_TEXTS.has(text) && !isRuntimeScalarText(text))) return true;
  for (const group of hit?.domGroupMatches || []) {
    for (const matched of group?.matched || []) {
      const [kind, ...rest] = String(matched || '').split(':');
      const value = rest.join(':').trim();
      if (kind !== 'text') continue;
      if (!value) continue;
      if (WEAK_EXACT_TEXTS.has(value)) continue;
      if (isRuntimeScalarText(value)) continue;
      return true;
    }
  }
  return false;
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
    const evidenceKinds = candidateEvidenceKinds(candidate);
    const hasRouteEvidence = evidenceKinds.has('route');
    const hasBridgeEvidence = candidateHasEvidence(candidate, isBridgeEvidence);
    const hasOnlyClassLikeEvidence = evidenceKinds.size > 0
      && [...evidenceKinds].every(kind => kind === 'class' || kind === 'icon');
    if (hasRouteEvidence && hasBridgeEvidence) {
      candidate.score += 180;
      candidate.reasons = uniq([
        ...(candidate.reasons || []),
        '提权：当前路由与运行时到源码的桥接证据同时命中',
      ]).slice(0, 12);
    }
    if (hasOnlyClassLikeEvidence) {
      candidate.score -= 96;
      candidate.reasons.push('降权：仅命中 class/icon，缺少文案、桥接或路由证据');
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

function mergeReasonsForHit(hit, old) {
  const runtimeFirst = hit?.stage === 'runtime-source' || old?.stage === 'runtime-source';
  if (runtimeFirst) {
    return uniq([
      ...(old?.stage === 'runtime-source' ? old?.reasons || [] : []),
      ...(hit?.stage === 'runtime-source' ? hit?.reasons || [] : []),
      ...(hit?.stage !== 'runtime-source' ? hit?.reasons || [] : []),
      ...(old?.stage !== 'runtime-source' ? old?.reasons || [] : []),
    ]).slice(0, 12);
  }
  return uniq([
    ...(hit?.reasons || []),
    ...(old?.reasons || []),
  ]).slice(0, 12);
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
        reasons: mergeReasonsForHit(hit, old),
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
        reasons: mergeReasonsForHit(hit, old),
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
        reasons: mergeReasonsForHit(hit, old),
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
        reasons: mergeReasonsForHit(hit, old),
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
        reasons: mergeReasonsForHit(hit, old),
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
        reasons: mergeReasonsForHit(hit, old),
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
      if (item.kind === 'class' && String(item.value || '').trim().length < 2) return false;
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
    selectionGroups: allowedScopes.has('self') ? (evidence.selectionGroups || []) : [],
    selectionKinds: evidence.selectionKinds || [],
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
  return classes.length > 0;
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

function promoteImportingCandidateScores(hits, routeEntry, graph) {
  return mergeHits(hits || []).sort((a, b) => b.score - a.score);
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
  const topStages = new Set(top1.stages || [top1.stage].filter(Boolean));
  if (topStages.has('context-hypothesis-demoted')) return false;
  if (topStages.has('context-hypothesis-related') && !topStages.has('original-selection-verified')) return false;
  if (sorted.length === 1) {
    if (top1.sourceConfidence === 'exact') return true;
    if (top1.preciseEvidence && ((top1.contextStrongMatchCount || 0) >= 2 || top1.exactMatchCount || top1.uniqueMatchText)) return true;
    return (top1.score || 0) >= 700;
  }
  if (top1.score >= 220 && top1.score - top2.score >= 46) return true;
  if (top1.score >= 170 && top1.score - top2.score >= 32) return true;
  return false;
}

function applyStyleThemePenalty(project, hits, textCache) {
  return (hits || []).map(hit => {
    if (!isStyleSourceFile(hit?.file || '')) return hit;
    const file = (project.files || []).find(item => item.path === hit.file);
    if (!file || !isTextFile(file.path)) return hit;
    const text = readProjectText(project, file, textCache);
    if (!isLikelyGlobalStyleOverrideFile(hit.file, text)) return hit;
    if (hitHasBusinessTextSignal(hit)) {
      return {
        ...hit,
        score: Math.round((hit.score || 0) * 0.78),
        reasons: uniq([
          '疑似全局样式覆写文件：已命中业务文本，轻度降权',
          ...(hit.reasons || []),
        ]).slice(0, 12),
      };
    }
    return {
      ...hit,
      score: Math.round((hit.score || 0) * 0.42),
      reasons: uniq([
        '疑似全局样式覆写文件：主要命中组件库通用结构，已降权',
        ...(hit.reasons || []),
      ]).slice(0, 12),
    };
  });
}

function isRuntimeScalarText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return true;
  if (text.length > 40) return false;
  if (!/[\p{L}\p{N}]/u.test(text)) return true;
  if (/^[￥¥$€£]?\s*\d+(?:[.,]\d+)?\s*[%元万亿件个次天时分秒]?$/.test(text)) return true;
  if (/^\d{1,4}[-/.:]\d{1,2}(?:[-/.:]\d{1,2})?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?$/.test(text)) return true;
  if (/^(?:id[:：]?\s*)?[a-z0-9_-]{8,}$/i.test(text)) return true;
  return false;
}

function groupMatchHasStableOriginalSignal(group) {
  const matches = Array.isArray(group?.matched) ? group.matched : [];
  return matches.some(item => {
    const [kind, ...rest] = String(item || '').split(':');
    const value = rest.join(':').trim();
    if (kind === 'class' || kind === 'component/class' || kind === 'attr' || kind === 'resource') return true;
    if (kind === 'text') return !isRuntimeScalarText(value);
    return false;
  });
}

function coverageHasStableOriginalSignal(coverage) {
  return (coverage?.matchedGroups || []).some(groupMatchHasStableOriginalSignal);
}

function originalSelectionVerification(project, filePath, selfEvidence, textCache) {
  const file = (project.files || []).find(item => item.path === filePath);
  if (!file || !isTextFile(file.path)) {
    return {
      accepted: false,
      score: 0,
      reasons: [],
      snippet: '',
    };
  }
  const text = readProjectText(project, file, textCache);
  const scored = scoreFileText(file, text, selfEvidence);
  const coverage = scoreDomGroupCoverageForText(text, selfEvidence);
  const acceptedByText = hasInitialSelectionEvidence(scored);
  const acceptedByGroup = coverage
    && coverageHasStableOriginalSignal(coverage)
    && coverage.matchedGroups.length >= 1
    && (coverage.score || 0) >= 90;
  const reasons = [];
  if (acceptedByText) {
    reasons.push('原始选区回验通过：当前选区文案/class 能在该文件解释');
    reasons.push(...(scored.contextReasons || []).slice(0, 3));
  }
  if (acceptedByGroup) {
    reasons.push(`原始选区局部结构回验：${coverage.matchedGroups.length} 个局部组命中`);
    reasons.push(...coverage.matchedGroups.slice(0, 2).map(group => `${group.label} => ${group.matched.join('、')}`));
  }
  return {
    accepted: !!(acceptedByText || acceptedByGroup),
    score: Math.min(180, Math.max(scored.contextScore || 0, coverage?.score || 0)),
    reasons: uniq(reasons).slice(0, 6),
    snippet: scored.snippet || coverage?.snippet || '',
    scored,
    coverage,
  };
}

function importPathBetween(graph, fromFile, toFile, maxDepth = 8) {
  if (!graph?.children?.has(fromFile) || !toFile) return [];
  if (fromFile === toFile) return [fromFile];
  const queue = [{ file: fromFile, chain: [fromFile], depth: 0 }];
  const visited = new Set([fromFile]);
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const child of graph.children.get(current.file) || []) {
      if (visited.has(child.file)) continue;
      const chain = [...current.chain, child.file];
      if (child.file === toFile) return chain;
      visited.add(child.file);
      queue.push({ file: child.file, chain, depth: current.depth + 1 });
    }
  }
  return [];
}

function hypothesisRelationForFile(filePath, options = {}) {
  const {
    seedFiles,
    routeEntry,
    routeClosure,
    graph,
  } = options;
  if (!filePath) return null;
  if (seedFiles?.has(filePath)) {
    return {
      accepted: true,
      score: 96,
      reason: '候选关系验证：命中文件属于原始选区初始候选',
      chain: [filePath],
    };
  }
  if (routeClosure?.has(filePath)) {
    const chain = routeEntry ? importPathBetween(graph, routeEntry, filePath, 10) : [];
    return {
      accepted: true,
      score: chain.length > 1 ? 74 : 46,
      reason: chain.length > 1
        ? `候选关系验证：处于当前页面 import 闭包 ${chain.join(' -> ')}`
        : '候选关系验证：处于当前页面源码闭包',
      chain,
    };
  }
  for (const seed of seedFiles || []) {
    const seedToFile = importPathBetween(graph, seed, filePath, 8);
    if (seedToFile.length > 1) {
      return {
        accepted: true,
        score: 62,
        reason: `候选关系验证：原始候选引用该文件 ${seedToFile.join(' -> ')}`,
        chain: seedToFile,
      };
    }
    const fileToSeed = importPathBetween(graph, filePath, seed, 8);
    if (fileToSeed.length > 1) {
      return {
        accepted: true,
        score: 68,
        reason: `候选关系验证：该文件是原始候选的引用方 ${fileToSeed.join(' -> ')}`,
        chain: fileToSeed,
      };
    }
  }
  return null;
}

function validateExpandedHypothesisHits(project, hits, evidence, textCache, options = {}) {
  if (!hits?.length) return [];
  const selfEvidence = selfOnlyEvidence(evidence);
  const seedFiles = currentSelectionSeedFiles(options.initialHits || []);
  const routeEntry = options.routeEntry || '';
  const routeClosure = routeEntry ? importClosure(project, [routeEntry], textCache, 8) : new Set();
  const graph = options.graph || buildImportGraph(project, textCache);

  return hits.map(hit => {
    const verification = originalSelectionVerification(project, hit.file, selfEvidence, textCache);
    const relation = hypothesisRelationForFile(hit.file, {
      seedFiles,
      routeEntry,
      routeClosure,
      graph,
    });
    if (verification.accepted) {
      return {
        ...hit,
        score: hit.score + 120 + verification.score,
        stages: mergeList(hit.stages || hit.stage, 'original-selection-verified'),
        preciseEvidence: !!(hit.preciseEvidence || verification.scored?.preciseEvidence),
        preciseSnippet: hit.preciseSnippet || verification.snippet || '',
        snippet: hit.snippet || verification.snippet || '',
        reasons: uniq([
          ...verification.reasons,
          relation?.reason || '',
          ...(hit.reasons || []),
        ]).slice(0, 12),
      };
    }
    return null;
  }).filter(Boolean);
}

function rebalanceAuxiliaryEvidenceHits(project, hits, evidence, textCache, routeHits = []) {
  if (!hits?.length) return [];
  const selfEvidence = selfOnlyEvidence(evidence);
  const routeEntry = routeHits?.[0]?.file || '';
  const routeClosure = routeEntry ? importClosure(project, [routeEntry], textCache, 8) : new Set();
  const graph = buildImportGraph(project, textCache);
  return hits.map(hit => {
    const auxiliary = hit.i18nEvidence || hit.definitionEvidence || isApiStage(hit.stage);
    if (!auxiliary) return hit;
    const verification = originalSelectionVerification(project, hit.file, selfEvidence, textCache);
    if (verification.accepted) {
      return {
        ...hit,
        score: hit.score + 80 + Math.min(120, verification.score),
        stages: mergeList(hit.stages || hit.stage, 'auxiliary-original-selection-verified'),
        reasons: uniq([
          '辅助证据回验通过：定义/i18n/API 线索能回到原始选区所在源码',
          ...verification.reasons,
          ...(hit.reasons || []),
        ]).slice(0, 12),
      };
    }
    const relation = hypothesisRelationForFile(hit.file, {
      seedFiles: new Set(),
      routeEntry,
      routeClosure,
      graph,
    });
    if (relation?.accepted && (hit.contextScore || 0) >= 80) {
      return {
        ...hit,
        score: hit.score + Math.min(60, relation.score),
        stages: mergeList(hit.stages || hit.stage, 'auxiliary-page-related'),
        reasons: uniq([
          relation.reason,
          '辅助证据保留：处于页面关系内，但仍需以后续选区/模型判断为准',
          ...(hit.reasons || []),
        ]).slice(0, 12),
      };
    }
    return {
      ...hit,
      score: Math.max(1, Math.round((hit.score || 0) * 0.58) - 60),
      preciseEvidence: false,
      stages: mergeList(hit.stages || hit.stage, 'auxiliary-demoted'),
      reasons: uniq([
        '辅助证据降权：定义/i18n/API 线索未回验到原始选区，只作为旁证',
        ...(hit.reasons || []),
      ]).slice(0, 12),
    };
  }).filter(hit => (hit.score || 0) > 0);
}

function isDefinitionLikeFile(filePath) {
  const value = String(filePath || '');
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|json)$/i.test(value)) return false;
  if (/\.(vue|jsx|tsx|svelte|astro|html)$/i.test(value)) return false;
  return /(^|\/)(constants?|config|configs|options?|enums?|dictionary|dict|locale|locales|i18n)\//i.test(value)
    || /(^|\/)(constants?|config|configs|options?|enums?|dictionary|dict|locale|locales|i18n)\.(ts|tsx|js|jsx|mjs|cjs|json)$/i.test(value)
    || /(^|\/)[^/]*(constants?|config|options?|enums?|dictionary|dict|locale|i18n)[^/]*\.(ts|tsx|js|jsx|mjs|cjs|json)$/i.test(value);
}

function sourceHasClassOrComponentToken(text, token) {
  const value = String(token || '').trim();
  if (value.length < 2) return false;
  if (findClassTokenIndex(text, value) !== -1) return true;
  if (!/^[A-Za-z][\w-]*-[\w-]+$/.test(value)) return false;
  const escaped = escapeRegExp(value);
  return new RegExp(`<\\s*${escaped}\\b`, 'i').test(text)
    || new RegExp(`\\bh\\(\\s*['"\`]${escaped}['"\`]`, 'i').test(text);
}

function evidenceSignalGroups(evidence) {
  if (!Array.isArray(evidence?.selectionSignals)) return [];
  return evidence.selectionSignals
    .flatMap(signal => Array.isArray(signal?.layers) ? signal.layers : [])
    .map((layer, index) => ({
      label: [
        layer.label || layer.scope || 'node',
        layer.tag || '',
        (layer.ownClassTokens || [])[0] ? `.${(layer.ownClassTokens || [])[0]}` : '',
        (layer.ownTextPhrases || [])[0] ? ` "${String((layer.ownTextPhrases || [])[0]).slice(0, 24)}"` : '',
      ].filter(Boolean).join(' '),
      classTokens: layer.ownClassTokens || [],
      textPhrases: layer.ownTextPhrases || [],
      attrTokens: layer.ownAttrTokens || [],
      styleTokens: layer.ownStyleTokens || [],
      id: `signal-${index}`,
    }));
}

function classTokensFromUiShapeEvidence(evidence) {
  const groups = [
    ...(Array.isArray(evidence?.selectionGroups) ? evidence.selectionGroups : []),
    ...evidenceSignalGroups(evidence),
  ];
  return uniq(groups
    .flatMap(group => group.classTokens || [])
    .map(token => String(token || '').trim())
    .filter(token => token.length >= 3));
}

function rareClassTokensForScope(project, scopeFiles, evidence, textCache) {
  const result = new Set();
  const files = scopeFiles || fileSetFromProject(project);
  for (const token of classTokensFromUiShapeEvidence(evidence)) {
    const docFreq = documentFrequency(project, files, { kind: 'class', value: token }, textCache, 12);
    if (docFreq > 0 && docFreq <= 2) {
      result.add(token.toLowerCase());
    }
  }
  return result;
}

function scoreSourceUiShape(text, evidence, options = {}) {
  let groups = Array.isArray(evidence?.selectionGroups) ? evidence.selectionGroups : [];
  groups = [...groups, ...evidenceSignalGroups(evidence)];
  if (!groups.length) return null;
  const rawText = String(text || '');
  const searchableText = maskCommentsPreserveLength(rawText);
  const rareClassTokens = options.rareClassTokens || new Set();
  const matched = [];
  let score = 0;

  for (const group of groups) {
    const groupMatches = [];
    for (const token of group.classTokens || []) {
      if (!sourceHasClassOrComponentToken(searchableText, token)) continue;
      groupMatches.push(`component/class:${token}`);
      score += rareClassTokens.has(String(token || '').toLowerCase()) ? 260 : 54;
    }
    for (const phrase of group.textPhrases || []) {
      const value = String(phrase || '').trim();
      if (value.length < 2 || findNeedleIndex(searchableText.toLowerCase(), value.toLowerCase()) === -1) continue;
      groupMatches.push(`text:${value}`);
      score += 66;
    }
    const attrTokens = (group.attrTokens || [])
      .filter(token => String(token || '').length >= 3)
      .filter(token => !WEAK_CONTEXT_TOKENS.has(String(token).toLowerCase()));
    for (const token of attrTokens) {
      const value = String(token || '').trim();
      if (!value || findNeedleIndex(searchableText.toLowerCase(), value.toLowerCase()) === -1) continue;
      groupMatches.push(`attr:${value}`);
      score += 24;
    }
    if (!groupMatches.length) continue;
    matched.push({
      label: group.label,
      matched: uniq(groupMatches).slice(0, 6),
    });
  }

  if (!matched.length) return null;
  const componentMatches = matched.flatMap(item => item.matched).filter(item => item.startsWith('component/class:'));
  const textMatches = matched.flatMap(item => item.matched).filter(item => item.startsWith('text:'));
  if (!componentMatches.length && !textMatches.length) return null;
  const bonus = matched.length * 42 + (matched.length >= 2 ? 80 : 0);
  const firstToken = (componentMatches[0] || textMatches[0] || '').split(':').slice(1).join(':');
  const index = firstToken ? searchableText.toLowerCase().indexOf(firstToken.toLowerCase()) : -1;
  return {
    score: Math.min(360, score + bonus),
    matched,
    snippet: index >= 0 ? makeSnippet(rawText, index, firstToken.length) : makeSnippet(rawText, 0, 0),
  };
}

function reverseImportClosure(graph, seedFile, allowedFiles, maxDepth = 5) {
  const result = [];
  const queue = [{ file: seedFile, chain: [seedFile], depth: 0 }];
  const visited = new Set([seedFile]);
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const parent of graph.parents.get(current.file) || []) {
      if (visited.has(parent.file)) continue;
      visited.add(parent.file);
      const chain = [parent.file, ...current.chain];
      if (!allowedFiles || allowedFiles.has(parent.file)) {
        result.push({
          file: parent.file,
          chain,
          depth: current.depth + 1,
          via: parent.specifier || '',
        });
      }
      queue.push({
        file: parent.file,
        chain,
        depth: current.depth + 1,
      });
    }
  }
  return result;
}

function promoteDefinitionUsageHits(project, hits, evidence, textCache, scopeFiles, graph) {
  const promoted = [];
  const allowed = scopeFiles || fileSetFromProject(project);
  const rareClassTokens = rareClassTokensForScope(project, allowed, evidence, textCache);
  for (const hit of hits || []) {
    if (!hit?.file || !isDefinitionLikeFile(hit.file)) continue;
    const parents = reverseImportClosure(graph, hit.file, allowed, 5)
      .filter(parent => isUiSourceFile(parent.file));
    for (const parent of parents) {
      const file = (project.files || []).find(item => item.path === parent.file);
      if (!file || !isTextFile(file.path)) continue;
      const text = readProjectText(project, file, textCache);
      const shape = scoreSourceUiShape(text, evidence, { rareClassTokens });
      if (!shape) continue;
      promoted.push({
        ...hit,
        file: parent.file,
        score: hit.score + 220 + shape.score - Math.min(90, parent.depth * 18),
        stage: 'definition-usage',
        stages: mergeList(hit.stages || hit.stage, 'definition-usage'),
        from: hit.file,
        snippet: shape.snippet || hit.snippet,
        preciseEvidence: true,
        preciseSnippet: shape.snippet || hit.preciseSnippet || hit.snippet,
        contextScore: Math.max(hit.contextScore || 0, shape.score),
        contextReasons: uniq([
          ...(hit.contextReasons || []),
          ...shape.matched.slice(0, 4).map(item => `定义使用组件结构命中：${item.label} => ${item.matched.join('、')}`),
        ]).slice(0, 8),
        contextStrongMatchCount: Math.max(hit.contextStrongMatchCount || 0, shape.matched.length),
        reasons: uniq([
          `命中文案/配置来自定义文件：${hit.file}`,
          `沿 import 反查到渲染组件：${parent.file}`,
          parent.chain.length > 1 ? `定义使用链：${parent.chain.join(' -> ')}` : '',
          ...shape.matched.slice(0, 5).map(item => `源码结构命中：${item.label} => ${item.matched.join('、')}`),
          ...(hit.reasons || []),
        ]).slice(0, 12),
        importChain: parent.chain,
        definitionFile: hit.file,
        definitionEvidence: true,
      });
    }
  }
  return promoted.sort((a, b) => b.score - a.score).slice(0, 12);
}

function runtimeSourceEvidenceList(body) {
  const selections = Array.isArray(body?.selections) ? body.selections : [];
  return selections
    .map(selection => ({
      selection,
      sourceLocate: selection?.sourceLocate || selection?.sourceEvidence || selection?.element?.sourceLocate || null,
    }))
    .filter(item => item.sourceLocate);
}

function decodeSourcePath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    if (/^file:\/\//i.test(raw)) {
      return decodeURIComponent(new URL(raw).pathname || '');
    }
  } catch (error) {
  }
  try {
    return decodeURIComponent(raw);
  } catch (error) {
    return raw;
  }
}

function runtimeFileCandidates(project, runtimeFile) {
  const raw = decodeSourcePath(runtimeFile)
    .replace(/\\/g, '/')
    .replace(/[?#].*$/, '')
    .replace(/^webpack:\/\/\/?/, '')
    .replace(/^webpack-internal:\/\/\/?/, '')
    .replace(/^\/?@fs\//, '/')
    .replace(/^\.\/+/, '');
  if (!raw) return [];
  const candidates = [];
  const add = value => {
    const normalized = posixPath(path.posix.normalize(String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '')));
    if (normalized) candidates.push(normalized);
  };
  add(raw);
  if (project?.path && path.isAbsolute(raw)) {
    try {
      add(path.relative(project.path, raw));
    } catch (error) {
    }
  }
  const srcIndex = raw.lastIndexOf('/src/');
  if (srcIndex !== -1) add(raw.slice(srcIndex + 1));
  const slashSrcIndex = raw.indexOf('src/');
  if (slashSrcIndex !== -1) add(raw.slice(slashSrcIndex));
  const projectName = project?.name ? `${project.name}/` : '';
  if (projectName && raw.includes(projectName)) {
    const projectNameIndex = raw.startsWith(projectName) ? 0 : raw.indexOf(`/${projectName}`);
    if (projectNameIndex !== -1) {
      const offset = projectNameIndex + (raw.startsWith(projectName) ? projectName.length : projectName.length + 1);
      add(raw.slice(offset));
    }
  }
  return uniq(candidates);
}

function resolveRuntimeFile(project, runtimeFile) {
  const fileMap = buildFileMap(project);
  for (const candidate of runtimeFileCandidates(project, runtimeFile)) {
    if (fileMap.has(candidate)) return candidate;
  }
  return '';
}

function snippetForRuntimeLocation(project, filePath, line, textCache) {
  const file = (project.files || []).find(item => item.path === filePath);
  if (!file || !isTextFile(file.path)) return '';
  const text = readProjectText(project, file, textCache);
  const lineNumber = Number(line || 0);
  if (lineNumber > 0) {
    const lines = text.split('\n');
    const start = Math.max(0, lineNumber - 12);
    const end = Math.min(lines.length, lineNumber + 18);
    return lines.slice(start, end).join('\n').trim();
  }
  return makeSnippet(text, 0, 0).trim();
}

function runtimeDirectLocationHits(project, body, textCache) {
  const hits = [];
  for (const { selection, sourceLocate } of runtimeSourceEvidenceList(body)) {
    const direct = sourceLocate?.directLocation || null;
    const filePath = resolveRuntimeFile(project, direct?.file || '');
    if (!filePath) continue;
    const chain = Array.isArray(sourceLocate.componentChain) ? sourceLocate.componentChain : [];
    const component = chain.find(item => resolveRuntimeFile(project, item?.file || '') === filePath) || chain[0] || {};
    const line = Number(direct.line || component.line || 0);
    const column = Number(direct.column || component.column || 0);
    hits.push({
      file: filePath,
      score: 2400 - Math.min(240, Number(component.depth || 0) * 30),
      stage: 'runtime-source',
      stages: ['runtime-source'],
      sourceConfidence: 'exact',
      framework: sourceLocate.framework || component.framework || 'unknown',
      sourceLine: line || 0,
      sourceColumn: column || 0,
      sourceComponentName: component.name || '',
      sourceComponentDepth: Number(component.depth || 0),
      sourceRuntimeFile: direct.file || component.file || '',
      apiEvidence: false,
      apiEvidenceReasons: [],
      apiEvidenceFrom: [],
      preciseEvidence: true,
      preciseSnippet: snippetForRuntimeLocation(project, filePath, line, textCache),
      snippet: snippetForRuntimeLocation(project, filePath, line, textCache),
      contextScore: 300,
      contextReasons: [
        `${sourceLocate.framework || component.framework || 'framework'} 运行时直接定位`,
        direct.file ? `运行时源码路径：${direct.file}` : '',
        component.name ? `组件：${component.name}` : '',
      ].filter(Boolean),
      contextSelectionIndex: Number(selection.index || 0),
      reasons: [
        `框架运行时直接定位：${sourceLocate.framework || component.framework || 'unknown'}`,
        direct.file ? `源码路径：${direct.file}` : '',
        line ? `源码位置：${line}${column ? `:${column}` : ''}` : '',
        component.name ? `组件：${component.name}` : '',
        '置信度：exact',
      ].filter(Boolean),
    });
  }
  return hits;
}

function runtimeComponentChainPreferredFiles(project, body) {
  const bestByFile = new Map();
  for (const { selection, sourceLocate } of runtimeSourceEvidenceList(body)) {
    const chain = Array.isArray(sourceLocate?.componentChain) ? sourceLocate.componentChain : [];
    for (const component of chain) {
      const filePath = resolveRuntimeFile(project, component?.file || '');
      if (!filePath || !component?.isBusinessComponent) continue;
      const depth = Number(component.depth || 0);
      const current = bestByFile.get(filePath);
      if (current && Number(current.depth || 0) <= depth) continue;
      bestByFile.set(filePath, {
        file: filePath,
        framework: sourceLocate.framework || component.framework || 'unknown',
        componentName: component.name || '',
        runtimeFile: component.file || '',
        depth,
        domDepth: Number(component.domDepth || 0),
        selectionIndex: Number(selection.index || 0),
      });
    }
  }
  return Array.from(bestByFile.values()).sort((a, b) => (a.depth || 0) - (b.depth || 0));
}

function angularRuntimeHintHits(project, body, textCache) {
  const hits = [];
  for (const { selection, sourceLocate } of runtimeSourceEvidenceList(body)) {
    if (sourceLocate?.framework !== 'angular') continue;
    const chain = Array.isArray(sourceLocate.componentChain) ? sourceLocate.componentChain : [];
    const component = chain[0] || {};
    const values = uniq([
      component.selector,
      component.name,
      component.name ? kebabCase(component.name.replace(/Component$/i, '')) : '',
    ]).filter(value => String(value || '').length >= 3);
    if (!values.length) continue;
    for (const file of project.files || []) {
      if (!isTextFile(file.path)) continue;
      const lowerPath = file.path.toLowerCase();
      const text = readProjectText(project, file, textCache);
      const lowerText = text.toLowerCase();
      let matched = '';
      for (const value of values) {
        const lower = String(value).toLowerCase();
        if (lowerPath.includes(lower) || lowerText.includes(lower)) {
          matched = value;
          break;
        }
      }
      if (!matched) continue;
      const index = lowerText.indexOf(String(matched).toLowerCase());
      hits.push({
        file: file.path,
        score: 760 + (lowerPath.includes(String(matched).toLowerCase()) ? 120 : 0),
        stage: 'runtime-source',
        stages: ['runtime-source'],
        sourceConfidence: 'medium',
        framework: 'angular',
        sourceComponentName: component.name || '',
        apiEvidence: false,
        apiEvidenceReasons: [],
        apiEvidenceFrom: [],
        preciseEvidence: false,
        snippet: index >= 0 ? makeSnippet(text, index, String(matched).length) : '',
        contextScore: 120,
        contextReasons: [`Angular 运行时组件线索：${matched}`],
        contextSelectionIndex: Number(selection.index || 0),
        reasons: [
          'Angular 运行时只能提供组件类/selector，按约定和源码内容召回',
          component.name ? `组件类：${component.name}` : '',
          component.selector ? `selector：${component.selector}` : '',
          `命中：${matched}`,
          '置信度：medium',
        ].filter(Boolean),
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 6);
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

function layeredSelectionHits(project, routeHits, evidence, textCache, scopes, options = {}) {
  const routeEntry = routeHits?.[0]?.file || '';
  const graph = buildImportGraph(project, textCache);
  const allScope = scopes[scopes.length - 1] || { name: 'fullRepo', files: fileSetFromProject(project) };
  const scopePlan = buildLayeredScopePlan(project, routeHits, evidence, textCache, scopes);
  const selfEvidence = selfOnlyEvidence(evidence);
  const preferredFiles = new Map((options.preferredFiles || []).map(item => [item.file, item]));

  let last = { hits: [], activeScope: allScope, layer: 'L3', graph };
  for (const scope of scopePlan) {
    const preferredScopeFiles = new Set(
      Array.from(scope.files || []).filter(file => preferredFiles.has(file))
    );
    const preferredInitialHits = preferredScopeFiles.size
      ? searchInitialSelectionHits(
        project,
        evidence,
        textCache,
        preferredScopeFiles,
        'runtime-chain-scope',
        `${scope.name}：运行时组件链范围内复核当前选区`,
        {
          allowAncestorFallback: false,
          fileFilter: isUiSourceFile,
        }
      ).map(hit => {
        const detail = preferredFiles.get(hit.file);
        return {
          ...hit,
          score: (hit.score || 0) + 28,
          reasons: uniq([
            '运行时组件链仅作为文件范围，已在该文件内重新命中当前选区证据',
            detail?.componentName ? `组件链组件：${detail.componentName}` : '',
            detail?.runtimeFile ? `运行时文件：${detail.runtimeFile}` : '',
            ...(hit.reasons || []),
          ]).slice(0, 12),
        };
      })
      : [];
    const initialHits = searchInitialSelectionHits(
      project,
      evidence,
      textCache,
      scope.files,
      'local-initial',
      `${scope.name}：仅用当前选区文案/class 初始命中`,
      {
        allowAncestorFallback: false,
        fileFilter: isUiSourceFile,
      }
    );
    const bundledHits = bundleInitialHits(project, [...preferredInitialHits, ...initialHits], evidence, textCache, routeEntry, scope.files, graph)
      .map(hit => ({
        ...hit,
        reasons: uniq([
          `检索层级：${scope.name}`,
          ...(hit.reasons || []),
        ]).slice(0, 12),
      }));
    const groupHits = domGroupCoverageHits(project, selfEvidence, textCache, scope.files, {
      fileFilter: isUiOrStyleSourceFile,
    }).map(hit => ({
      ...hit,
      reasons: uniq([
        `检索层级：${scope.name}`,
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));
    const baseLocalStructuredHits = mergeHits([
      ...bundledHits,
      ...groupHits,
    ]).sort((a, b) => b.score - a.score);
    const localDefinitionUsageHits = promoteDefinitionUsageHits(project, baseLocalStructuredHits, evidence, textCache, scope.files, graph)
      .map(hit => ({
        ...hit,
        reasons: uniq([
          `检索层级：${scope.name}`,
          ...(hit.reasons || []),
        ]).slice(0, 12),
      }));
    const localStructuredHits = mergeHits([
      ...baseLocalStructuredHits,
      ...localDefinitionUsageHits,
    ]).sort((a, b) => b.score - a.score);
    if (stableLocalHits(localStructuredHits) || exactTextIsUniqueEnough(localStructuredHits)) {
      return {
        hits: localStructuredHits,
        activeScope: scope,
        layer: scope.name.replace(/：.*$/, ''),
        graph,
      };
    }
    const recalledHits = recallByStructuredEvidence(project, routeHits, selfEvidence, textCache, {
      scopeFiles: scope.files,
    }).map(hit => ({
      ...hit,
      reasons: uniq([
        `检索层级：${scope.name}`,
        ...(hit.reasons || []),
      ]).slice(0, 12),
    }));
    const definitionUsageHits = promoteDefinitionUsageHits(project, recalledHits, evidence, textCache, scope.files, graph)
      .map(hit => ({
        ...hit,
        reasons: uniq([
          `检索层级：${scope.name}`,
          ...(hit.reasons || []),
        ]).slice(0, 12),
      }));
    const mergedScopeHits = mergeHits([
      ...localStructuredHits,
      ...recalledHits,
      ...definitionUsageHits,
    ]).sort((a, b) => b.score - a.score);
    const meaningfulScopeHits = mergedScopeHits.filter(hit => !isOnlyRouteHitWithoutLocalEvidence(hit));
    if (meaningfulScopeHits.length) {
      const refinedHits = refineHitsByExpandedSelection(project, mergedScopeHits, evidence, textCache)
        .sort((a, b) => b.score - a.score);
      last = {
        hits: refinedHits,
        activeScope: scope,
        layer: scope.name.replace(/：.*$/, ''),
        graph,
      };
      if (stableLocalHits(refinedHits)) return last;
      if (exactTextIsUniqueEnough(refinedHits)) return last;
      continue;
    }

    last = {
      hits: mergedScopeHits,
      activeScope: scope,
      layer: scope.name.replace(/：.*$/, ''),
      graph,
    };
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
  const runtimeHits = mergeHits([
    ...runtimeDirectLocationHits(project, body, textCache),
    ...angularRuntimeHintHits(project, body, textCache),
  ]);
  const runtimePreferredFiles = runtimeComponentChainPreferredFiles(project, body);

  const scopes = buildSearchScopes(project, routeHits, textCache);
  const layered = layeredSelectionHits(project, routeHits, evidence, textCache, scopes, {
    preferredFiles: runtimePreferredFiles,
  });
  const localHits = applyStyleThemePenalty(
    project,
    promoteImportingCandidateScores(
      (layered.hits || [])
      .map(hit => ({
        ...hit,
        reasons: uniq([
          `检索层级：${layered.layer}`,
          ...(hit.reasons || []),
        ]).slice(0, 12),
      })),
      routeHits?.[0]?.file || '',
      layered.graph
    ),
    textCache
  );
  const sortedKeywordHits = localHits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const i18nTrace = traceI18nReferences(project, body, evidence, textCache, routeHits);
  const i18nHits = rebalanceAuxiliaryEvidenceHits(project, i18nTrace.hits || [], evidence, textCache, routeHits);
  const definitionTrace = traceDefinitionReferences(project, body, evidence, textCache);
  const definitionHits = rebalanceAuxiliaryEvidenceHits(project, definitionTrace.hits || [], evidence, textCache, routeHits);
  const apiHits = traceApiReferences(project, body, evidence, textCache);
  const apiTrace = apiHits.apiTrace || null;

  const exactRuntimeFiles = new Set(runtimeHits
    .filter(hit => hit.sourceConfidence === 'exact')
    .map(hit => hit.file));
  const keywordHitsForMerge = exactRuntimeFiles.size
    ? sortedKeywordHits.filter(hit => exactRuntimeFiles.has(hit.file))
    : sortedKeywordHits;
  const hits = mergeHits([
    ...runtimeHits,
    ...keywordHitsForMerge,
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
