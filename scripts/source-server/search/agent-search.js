const path = require('path');
const { isTextFile, readProjectText } = require('../core/fs-utils');
const { runModelTask } = require('../model/model-adapters');
const { makeSnippet, uniq } = require('../utils');
const { buildFileMap, importedFiles } = require('./import-trace');
const { searchProjectWithMeta } = require('./index');
const { resolvePageRouteTrace } = require('../route-resolvers/registry');
const {
  buildLocatorSystemPrompt,
  buildLocatorUserInput,
  normalizeLocatorDecision,
  validateLocatorDecision,
  locatorDecisionToSearchPlan,
} = require('./locator-protocol');

const DEFAULT_DOM_AGENT_THRESHOLD = 8000;
const MAX_DOM_INPUT_CHARS = 180000;
const MAX_PLAN_SEARCHES = 8;
const MAX_PLAN_KEYWORDS = 8;
const MAX_CANDIDATES = 12;
const MAX_INSPECT_FILES = 6;
const MAX_EXCERPT_CHARS = 7000;
const MAX_COMPRESSED_DOM_CHARS = 30000;
const MAX_INHERITED_KEYWORDS = 4;

function parseJsonResult(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch (error) {
  }
  const objectStart = unfenced.indexOf('{');
  const objectEnd = unfenced.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    try {
      return JSON.parse(unfenced.slice(objectStart, objectEnd + 1));
    } catch (error) {
    }
  }
  return null;
}

function selectionList(body) {
  return Array.isArray(body?.selections) ? body.selections : [];
}

function selectionMarkup(selection) {
  const info = selection?.element || selection?.info || selection || {};
  return String(
    info.rawOuterHtml
      || info.fullOuterHtml
      || info.outerHtml
      || info.innerHtml
      || ''
  );
}

function parseAttributes(value) {
  const attrs = {};
  const regex = /([:@\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = regex.exec(String(value || '')))) {
    const key = match[1];
    if (!key || key === '/' || key.startsWith('<')) continue;
    attrs[key] = match[3] ?? match[4] ?? match[5] ?? true;
  }
  return attrs;
}

function parseHtmlLite(markup) {
  const root = { type: 'element', tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const tokenRegex = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+/g;
  let match;
  while ((match = tokenRegex.exec(String(markup || '')))) {
    const token = match[0];
    if (!token || token.startsWith('<!--') || token.startsWith('<!')) continue;
    if (!token.startsWith('<')) {
      const text = compactWhitespace(token);
      if (text) stack[stack.length - 1].children.push({ type: 'text', text });
      continue;
    }
    if (/^<\//.test(token)) {
      const tag = (token.match(/^<\/\s*([^\s>]+)/) || [])[1]?.toLowerCase();
      if (!tag) continue;
      while (stack.length > 1) {
        const current = stack.pop();
        if (current.tag === tag) break;
      }
      continue;
    }
    const open = token.match(/^<\s*([^\s>/]+)([\s\S]*?)\/?\s*>$/);
    if (!open) continue;
    const tag = open[1].toLowerCase();
    const attrText = open[2] || '';
    const node = {
      type: 'element',
      tag,
      attrs: parseAttributes(attrText),
      children: [],
    };
    stack[stack.length - 1].children.push(node);
    const selfClosing = /\/\s*>$/.test(token) || isVoidTag(tag);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

function isVoidTag(tag) {
  return new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']).has(tag);
}

function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function classTokens(attrs) {
  return String(attrs?.class || '').split(/\s+/).map(item => item.trim()).filter(Boolean);
}

function stableAttrs(attrs) {
  const result = {};
  for (const [key, rawValue] of Object.entries(attrs || {})) {
    const value = rawValue === true ? true : compactWhitespace(rawValue);
    if (!key) continue;
    if (isRuntimeAttr(key, value)) continue;
    if (key === 'style') {
      const compact = compactStyle(value);
      if (compact) result[key] = compact;
      continue;
    }
    if (key === 'class') {
      const tokens = classTokens(attrs).slice(0, 12);
      if (tokens.length) result[key] = tokens.join(' ');
      continue;
    }
    if (String(value).length > 160) {
      result[key] = `${String(value).slice(0, 120)}...`;
      continue;
    }
    result[key] = value;
  }
  return result;
}

function isRuntimeAttr(key, value) {
  if (/^data-v-[\w-]+$/i.test(key)) return true;
  if (/^data-[\w-]*id$/i.test(key) && looksRuntimeValue(value)) return true;
  if (/^aria-(?:labelledby|describedby|controls|owns|activedescendant)$/i.test(key)) return true;
  if (key === 'id' && looksRuntimeValue(value)) return true;
  return false;
}

function looksRuntimeValue(value) {
  const text = String(value || '');
  if (/^[a-f0-9]{6,}$/i.test(text)) return true;
  if (/^[a-z]+-[a-f0-9]{5,}$/i.test(text)) return true;
  return false;
}

function compactStyle(value) {
  const text = compactWhitespace(value);
  if (!text) return '';
  const pairs = text.split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => !item.startsWith('--'))
    .slice(0, 8);
  return pairs.join('; ');
}

function directText(node) {
  return (node.children || [])
    .filter(child => child.type === 'text')
    .map(child => child.text)
    .join(' ')
    .trim();
}

function descendantText(node, limit = 160) {
  const parts = [];
  function visit(item) {
    if (parts.join(' ').length >= limit) return;
    if (item.type === 'text') {
      parts.push(item.text);
      return;
    }
    for (const child of item.children || []) visit(child);
  }
  visit(node);
  return compactWhitespace(parts.join(' ')).slice(0, limit);
}

function descendantAnchorAttrs(node, limit = 24) {
  const result = [];
  function visit(item) {
    if (result.length >= limit || item.type !== 'element') return;
    const attrs = stableAttrs(item.attrs);
    for (const [key, value] of Object.entries(attrs)) {
      if (result.length >= limit) break;
      if (key === 'class' || key === 'style' || value === true) continue;
      result.push(`${key}=${value}`);
    }
    for (const child of item.children || []) visit(child);
  }
  visit(node);
  return uniq(result).slice(0, limit);
}

function nodeSignature(node) {
  if (!node || node.type !== 'element') return '';
  const attrs = stableAttrs(node.attrs);
  const attrKeys = Object.keys(attrs)
    .filter(key => key !== 'style')
    .sort()
    .slice(0, 8)
    .join(',');
  const classes = classTokens(node.attrs)
    .filter(token => !/--/.test(token))
    .slice(0, 6)
    .join('.');
  const childShape = (node.children || [])
    .filter(child => child.type === 'element')
    .slice(0, 8)
    .map(child => `${child.tag}:${Object.keys(stableAttrs(child.attrs)).filter(key => key !== 'style').sort().join(',')}`)
    .join('|');
  return `${node.tag}#${classes}#${attrKeys}#${childShape}`;
}

function compressNodeChildren(node, repeatedGroups) {
  if (!node || node.type !== 'element') return;
  for (const child of node.children || []) compressNodeChildren(child, repeatedGroups);
  const children = node.children || [];
  const groups = new Map();
  children.forEach((child, index) => {
    if (child.type !== 'element') return;
    const signature = nodeSignature(child);
    if (!signature) return;
    const group = groups.get(signature) || [];
    group.push({ child, index });
    groups.set(signature, group);
  });
  const removeIndexes = new Set();
  const inserts = [];
  for (const [signature, group] of groups.entries()) {
    if (group.length < 3) continue;
    const representatives = group.slice(0, 2);
    const omitted = group.slice(2);
    omitted.forEach(item => removeIndexes.add(item.index));
    const summary = {
      type: 'repeat-summary',
      tag: group[0].child.tag,
      count: group.length,
      omitted: omitted.length,
      signature,
      samples: group.slice(0, 30).map(item => ({
        text: descendantText(item.child, 80),
        anchorAttrs: descendantAnchorAttrs(item.child, 12),
        attrs: stableAttrs(item.child.attrs),
      })),
    };
    repeatedGroups.push({
      tag: summary.tag,
      count: summary.count,
      omitted: summary.omitted,
      sampleTexts: summary.samples.map(item => item.text).filter(Boolean).slice(0, 6),
      sampleAttrs: uniq(summary.samples.flatMap(item => item.anchorAttrs || [])).slice(0, 12),
    });
    inserts.push({
      after: representatives[representatives.length - 1].index,
      node: summary,
    });
  }
  if (!removeIndexes.size && !inserts.length) return;
  const next = [];
  children.forEach((child, index) => {
    if (!removeIndexes.has(index)) next.push(child);
    for (const insert of inserts) {
      if (insert.after === index) next.push(insert.node);
    }
  });
  node.children = next;
}

function serializeNode(node, budget) {
  if (budget.remaining <= 0) return '';
  if (node.type === 'text') {
    const text = compactWhitespace(node.text).slice(0, Math.min(120, budget.remaining));
    budget.remaining -= text.length;
    return text;
  }
  if (node.type === 'repeat-summary') {
    const sampleTexts = uniq((node.samples || []).map(item => item.text).filter(Boolean)).slice(0, 30).join(' | ');
    const sampleAttrs = uniq((node.samples || []).flatMap(item => item.anchorAttrs || [])).slice(0, 40).join(' | ');
    const text = `<magnus-repeat tag="${escapeAttr(node.tag)}" count="${node.count}" omitted="${node.omitted}" texts="${escapeAttr(sampleTexts)}" attrs="${escapeAttr(sampleAttrs)}" />`;
    budget.remaining -= text.length;
    return text;
  }
  const attrs = stableAttrs(node.attrs);
  const attrText = Object.entries(attrs)
    .map(([key, value]) => value === true ? key : `${key}="${escapeAttr(value)}"`)
    .join(' ');
  const open = node.tag === 'root' ? '' : `<${node.tag}${attrText ? ` ${attrText}` : ''}>`;
  const close = node.tag === 'root' ? '' : `</${node.tag}>`;
  budget.remaining -= open.length + close.length;
  const children = [];
  for (const child of node.children || []) {
    if (budget.remaining <= 0) break;
    const value = serializeNode(child, budget);
    if (value) children.push(value);
  }
  return `${open}${children.join('')}${close}`;
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function compressDomMarkup(markup) {
  const raw = String(markup || '');
  if (!raw) return { enabled: false, markup: '', repeatedGroups: [] };
  const repeatedGroups = [];
  const tree = parseHtmlLite(raw);
  compressNodeChildren(tree, repeatedGroups);
  const budget = { remaining: MAX_COMPRESSED_DOM_CHARS };
  const serialized = serializeNode(tree, budget);
  const markupText = serialized || raw.slice(0, MAX_COMPRESSED_DOM_CHARS);
  return {
    enabled: repeatedGroups.length > 0 || markupText.length < raw.length,
    markup: markupText,
    repeatedGroups,
  };
}

function componentChainFiles(body) {
  const files = [];
  for (const selection of selectionList(body)) {
    const sourceLocate = selection?.sourceLocate
      || selection?.sourceEvidence
      || selection?.element?.sourceLocate
      || null;
    for (const component of sourceLocate?.componentChain || []) {
      const file = String(component?.file || '').trim();
      if (file) files.push(file);
    }
  }
  return uniq(files);
}

function resolvedComponentChainFiles(project, body) {
  const projectFiles = new Set((project?.files || []).map(file => file.path));
  return componentChainFiles(body).filter(rawFile => {
    const normalized = String(rawFile || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (projectFiles.has(normalized)) return true;
    const srcIndex = normalized.lastIndexOf('/src/');
    return srcIndex !== -1 && projectFiles.has(normalized.slice(srcIndex + 1));
  });
}

function domAgentTrigger(body, options = {}) {
  const threshold = Math.max(1000, Number(options.threshold || DEFAULT_DOM_AGENT_THRESHOLD));
  const markupLength = selectionList(body)
    .map(selectionMarkup)
    .reduce((max, value) => Math.max(max, value.length), 0);
  const chainFiles = resolvedComponentChainFiles(options.project, body);
  const oversized = markupLength > threshold;
  const missingComponentFile = chainFiles.length === 0;
  return {
    enabled: oversized || missingComponentFile,
    oversized,
    missingComponentFile,
    markupLength,
    threshold,
    componentFiles: chainFiles,
    reason: [
      oversized ? `选区字符长度 ${markupLength} > ${threshold}` : '',
      missingComponentFile ? 'ComponentChain 未找到源码文件' : '',
    ].filter(Boolean).join('；'),
  };
}

function plannerDomInput(body) {
  return selectionList(body).map((selection, index) => {
    const info = selection?.element || selection?.info || selection || {};
    const rawMarkup = selectionMarkup(selection);
    const compression = compressDomMarkup(rawMarkup);
    const markup = (compression.markup || rawMarkup).slice(0, MAX_DOM_INPUT_CHARS);
    return {
      index: index + 1,
      tag: info.tag || info.tagName || '',
      selector: info.selector || '',
      className: info.className || '',
      text: info.text || '',
      markup,
      rawMarkupLength: rawMarkup.length,
      compressedMarkupLength: compression.markup.length,
      compression: {
        enabled: compression.enabled,
        repeatedGroupCount: compression.repeatedGroups.length,
        repeatedGroups: compression.repeatedGroups.slice(0, 12),
      },
      markupTruncated: compression.markup.length > markup.length,
    };
  });
}

function buildPlannerPrompt(project, body, routeTrace, domSelections) {
  return JSON.stringify(buildLocatorUserInput({
    project,
    body,
    routeTrace,
    domSelections,
  }), null, 2);
}

function normalizePlan(parsed) {
  const searches = (Array.isArray(parsed?.searches) ? parsed.searches : [])
    .slice(0, MAX_PLAN_SEARCHES)
    .map((search, index) => ({
      keywords: uniq((Array.isArray(search?.keywords) ? search.keywords : [])
        .map(value => String(value || '').trim())
        .filter(value => value.length >= 2)
        .slice(0, MAX_PLAN_KEYWORDS)),
      mode: search?.mode === 'any' ? 'any' : 'all',
      range: search?.range === 'same-structure' ? 'same-structure' : 'same-file',
      priority: Math.max(1, Number(search?.priority || index + 1)),
      reason: String(search?.reason || '').trim(),
    }))
    .filter(search => search.keywords.length);
  return {
    searches,
    needMoreDom: parsed?.needMoreDom === true,
  };
}

function plannerEvidenceCorpus(body, routeTrace) {
  return [
    body?.pagePath || '',
    routeTrace?.bestPageFile || '',
    ...(routeTrace?.hits || []).flatMap(hit => [hit.file, hit.routePath]),
    ...plannerDomInput(body).flatMap(item => [
      item.tag,
      item.selector,
      item.className,
      item.text,
      item.markup,
    ]),
  ].filter(Boolean).join('\n').toLowerCase();
}

function keywordExistsInPlannerEvidence(keyword, corpus) {
  const value = String(keyword || '').trim();
  if (!value) return false;
  return corpus.includes(value.toLowerCase());
}

function selectionContextMarkupValues(selection) {
  const info = selection?.element || selection?.info || selection || {};
  return [
    selectionMarkup(selection),
    ...(Array.isArray(info.ancestors) ? info.ancestors.map(selectionMarkup) : []),
    selectionMarkup(selection?.asset),
    selectionMarkup(selection?.expanded),
    selectionMarkup(selection?.expandedContext),
  ].filter(Boolean);
}

function filterPlanByVisibleEvidence(plan, body, routeTrace) {
  const corpus = [
    plannerEvidenceCorpus(body, routeTrace),
    ...selectionList(body).flatMap(selectionContextMarkupValues),
  ].filter(Boolean).join('\n').toLowerCase();
  const removed = [];
  const searches = (plan.searches || []).map(search => {
    const keywords = (search.keywords || []).filter(keyword => {
      const ok = keywordExistsInPlannerEvidence(keyword, corpus);
      if (!ok) removed.push(keyword);
      return ok;
    });
    return { ...search, keywords };
  }).filter(search => search.keywords.length);
  return {
    plan: {
      ...plan,
      searches,
    },
    removed: uniq(removed),
  };
}

function inheritedSearchKeywords(agentState) {
  if (!agentState?.expansionRetry) return [];
  const previousSearches = Array.isArray(agentState?.previousPlan?.searches)
    ? agentState.previousPlan.searches
    : [];
  const groupKeywords = [];
  for (const search of previousSearches) {
    const keywords = Array.isArray(search?.keywords) ? search.keywords : [];
    if (!keywords.length) continue;
    groupKeywords.push(...keywords);
    if (groupKeywords.length >= MAX_INHERITED_KEYWORDS) break;
  }
  return uniq(groupKeywords
    .map(value => String(value || '').trim())
    .filter(value => value.length >= 2))
    .slice(0, MAX_INHERITED_KEYWORDS);
}

function expansionCombinedSearchPlan(plan, agentState) {
  const inherited = inheritedSearchKeywords(agentState);
  if (!agentState?.expansionRetry || !inherited.length || !(plan.searches || []).length) {
    return { plan: { searches: [], needMoreDom: false }, inherited: [] };
  }
  const searches = (plan.searches || []).map((search, index) => {
    const keywords = uniq([
      ...inherited,
      ...(Array.isArray(search.keywords) ? search.keywords : []),
    ]).slice(0, MAX_PLAN_KEYWORDS);
    if (keywords.length <= (search.keywords || []).length) return null;
    return {
      keywords,
      mode: 'all',
      range: 'same-file',
      priority: index + 1,
      reason: [
        search.reason || '',
        `扩区联合直搜：上一轮锚点 ${inherited.join('、')}`,
      ].filter(Boolean).join('；'),
    };
  }).filter(Boolean);
  return {
    plan: {
      searches,
      needMoreDom: false,
    },
    inherited,
  };
}

function sourceFiles(project) {
  return (project.files || []).filter(file => isTextFile(file.path));
}

function keywordIndexes(text, keyword) {
  const indexes = [];
  const lowerText = String(text || '').toLowerCase();
  const needle = String(keyword || '').toLowerCase();
  if (!needle) return indexes;
  let from = 0;
  while (indexes.length < 20) {
    const index = lowerText.indexOf(needle, from);
    if (index === -1) break;
    indexes.push(index);
    from = index + Math.max(1, needle.length);
  }
  return indexes;
}

function groupMatch(text, search) {
  const matches = search.keywords.map(keyword => ({
    keyword,
    indexes: keywordIndexes(text, keyword),
  }));
  const accepted = search.mode === 'any'
    ? matches.some(item => item.indexes.length)
    : matches.every(item => item.indexes.length);
  if (!accepted) return null;
  const positions = matches.flatMap(item => item.indexes.slice(0, 2));
  const spread = positions.length
    ? Math.max(...positions) - Math.min(...positions)
    : Number.MAX_SAFE_INTEGER;
  const structureAccepted = search.range !== 'same-structure' || spread <= 16000;
  if (!structureAccepted) return null;
  return {
    keywords: matches.filter(item => item.indexes.length).map(item => item.keyword),
    positions,
    spread,
  };
}

function executeSearchPlan(project, plan, textCache) {
  const candidateMap = new Map();
  for (const file of sourceFiles(project)) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    for (const search of plan.searches) {
      const match = groupMatch(text, search);
      if (match) {
        upsertCandidate(candidateMap, file.path, {
          score: Math.max(40, 260 - (search.priority - 1) * 30) + match.keywords.length * 18,
          matchedGroup: {
            priority: search.priority,
            keywords: match.keywords,
            range: search.range,
            reason: search.reason,
            source: 'planned-group',
          },
          keywords: match.keywords,
          positions: match.positions,
        });
      }
      for (const keyword of search.keywords) {
        const positions = keywordIndexes(text, keyword);
        if (!positions.length) continue;
        upsertCandidate(candidateMap, file.path, {
          score: Math.max(12, 80 - (search.priority - 1) * 8),
          matchedGroup: {
            priority: search.priority,
            keywords: [keyword],
            range: 'same-file',
            reason: `单点证据：${search.reason || keyword}`,
            source: 'keyword-fallback',
          },
          keywords: [keyword],
          positions: positions.slice(0, 3),
        });
      }
    }
  }
  return Array.from(candidateMap.values())
    .map(candidate => ({
      ...candidate,
      matchedKeywords: uniq(candidate.matchedKeywords),
      positions: uniq(candidate.positions).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);
}

function previousCandidateKeywords(previousCandidate, fallbackKeywords = []) {
  return uniq([
    ...fallbackKeywords,
    ...((previousCandidate?.matchedGroups || []).flatMap(group => group?.keywords || [])),
  ].map(value => String(value || '').trim()).filter(value => value.length >= 2))
    .slice(0, MAX_INHERITED_KEYWORDS);
}

function importChainFromParent(project, parentFile, targetFiles, textCache, maxDepth = 5) {
  const targets = new Set(targetFiles);
  if (!parentFile || !targets.size) return new Map();
  const fileMap = buildFileMap(project);
  const found = new Map();
  const queue = [{ file: parentFile, depth: 0, chain: [parentFile] }];
  const visited = new Set([parentFile]);
  while (queue.length && found.size < targets.size) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const child of importedFiles(project, current.file, fileMap, textCache)) {
      if (visited.has(child.file)) continue;
      visited.add(child.file);
      const chain = [...current.chain, child.file];
      if (targets.has(child.file)) found.set(child.file, chain);
      queue.push({ file: child.file, depth: current.depth + 1, chain });
    }
  }
  return found;
}

function expansionRelatedCandidateHits(project, currentCandidates, agentState, textCache) {
  if (!agentState?.expansionRetry) return { candidates: [], relations: [] };
  const previousCandidates = (Array.isArray(agentState.previousCandidates) ? agentState.previousCandidates : [])
    .filter(item => item?.file)
    .slice(0, MAX_CANDIDATES);
  if (!previousCandidates.length || !currentCandidates.length) return { candidates: [], relations: [] };

  const inherited = inheritedSearchKeywords(agentState);
  const previousByFile = new Map(previousCandidates.map(item => [item.file, item]));
  const previousFiles = Array.from(previousByFile.keys());
  const currentFiles = new Set(currentCandidates.map(item => item.file));
  const candidateMap = new Map();
  const relations = [];

  for (const parent of currentCandidates.slice(0, MAX_INSPECT_FILES)) {
    const chains = importChainFromParent(project, parent.file, previousFiles, textCache);
    for (const [childFile, chain] of chains.entries()) {
      if (currentFiles.has(childFile)) continue;
      const previous = previousByFile.get(childFile);
      const keywords = previousCandidateKeywords(previous, inherited);
      if (!keywords.length) continue;
      const file = (project.files || []).find(item => item.path === childFile);
      const text = file ? readProjectText(project, file, textCache) : '';
      const positions = uniq(keywords.flatMap(keyword => keywordIndexes(text, keyword))).slice(0, 8);
      if (!positions.length) continue;
      upsertCandidate(candidateMap, childFile, {
        score: Math.max(180, Math.floor((parent.score || 0) * 0.72)) + positions.length * 16,
        matchedGroup: {
          priority: 1,
          keywords,
          range: 'import-relation',
          reason: `扩区引用链验证：${parent.file} 命中新锚点并引用上一轮候选 ${childFile}`,
          source: 'import-relation',
        },
        keywords,
        positions,
      });
      const old = candidateMap.get(childFile);
      old.importRelation = {
        parentFile: parent.file,
        childFile,
        chain,
        inheritedKeywords: keywords,
        parentKeywords: parent.matchedKeywords || [],
      };
      relations.push(old.importRelation);
    }
  }

  return {
    candidates: Array.from(candidateMap.values()),
    relations,
  };
}

function upsertCandidate(candidateMap, filePath, patch) {
  const old = candidateMap.get(filePath) || {
    file: filePath,
    score: 0,
    matchedGroups: [],
    matchedKeywords: [],
    positions: [],
  };
  old.score += Number(patch.score || 0);
  if (patch.matchedGroup) old.matchedGroups.push(patch.matchedGroup);
  old.matchedKeywords.push(...(patch.keywords || []));
  old.positions.push(...(patch.positions || []));
  candidateMap.set(filePath, old);
}

function commentMask(text) {
  return String(text || '')
    .replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length))
    .replace(/\/\*[\s\S]*?\*\//g, match => ' '.repeat(match.length))
    .replace(/(^|[^:])\/\/.*$/gm, match => ' '.repeat(match.length));
}

function candidateExcerpt(text, candidate) {
  const positions = candidate.positions || [];
  if (!positions.length) return makeSnippet(text, 0, 0).slice(0, MAX_EXCERPT_CHARS);
  const start = Math.max(0, Math.min(...positions) - 1800);
  const end = Math.min(text.length, Math.max(...positions) + 2600);
  if (end - start <= MAX_EXCERPT_CHARS) return text.slice(start, end).trim();
  const chunks = positions.slice(0, 3).map(position => makeSnippet(text, position, 0));
  return uniq(chunks).join('\n\n').slice(0, MAX_EXCERPT_CHARS).trim();
}

function inspectCandidates(project, candidates, plan, textCache) {
  const inspected = candidates.slice(0, MAX_INSPECT_FILES).map(candidate => {
    const file = (project.files || []).find(item => item.path === candidate.file);
    const text = file ? readProjectText(project, file, textCache) : '';
    const masked = commentMask(text);
    const keywordFacts = uniq(plan.searches.flatMap(search => search.keywords)).map(keyword => {
      const allCount = keywordIndexes(text, keyword).length;
      const codeCount = keywordIndexes(masked, keyword).length;
      return {
        keyword,
        count: allCount,
        codeCount,
        commentOnly: allCount > 0 && codeCount === 0,
      };
    }).filter(item => item.count > 0);
    const codeMatches = keywordFacts.filter(item => item.codeCount > 0).length;
    const commentOnly = keywordFacts.filter(item => item.commentOnly).map(item => item.keyword);
    const localScore = candidate.score + codeMatches * 24 - commentOnly.length * 40;
    return {
      file: candidate.file,
      score: localScore,
      matchedGroups: candidate.matchedGroups,
      keywordFacts,
      commentOnly,
      importRelation: candidate.importRelation || null,
      excerpt: candidateExcerpt(text, candidate),
    };
  }).sort((a, b) => b.score - a.score);
  const first = inspected[0];
  const second = inspected[1];
  const unique = !!first && (
    !second
      || first.score - second.score >= 90
      || (
        first.matchedGroups.length > second.matchedGroups.length
        && first.commentOnly.length === 0
      )
  );
  return {
    status: unique ? 'unique' : inspected.length ? 'ambiguous' : 'empty',
    selectedFile: unique ? first.file : '',
    candidates: inspected,
  };
}

function hasPlannedGroupMatch(candidate) {
  return (candidate?.matchedGroups || []).some(group => {
    return group?.source === 'planned-group' && (group.keywords || []).length >= 2;
  });
}

function analyzeEvidenceSufficiency(plan, inspection, ownership = []) {
  const candidates = inspection?.candidates || [];
  const plannedGroupCandidates = candidates.filter(hasPlannedGroupMatch);
  const importRelationCandidates = candidates.filter(candidate => candidate.importRelation);
  const ownershipCount = Array.isArray(ownership) ? ownership.length : 0;
  if (plan.needMoreDom && !candidates.length) {
    return {
      insufficient: true,
      reason: 'Planner 请求更多 DOM 且当前没有候选文件',
      candidateCount: candidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (!candidates.length) {
    return {
      insufficient: true,
      reason: '本地检索未命中候选文件，需要扩区补充稳定 DOM 证据',
      candidateCount: 0,
      plannedGroupCandidateCount: 0,
      ownershipCount,
    };
  }
  if (plannedGroupCandidates.length === 1) {
    return {
      insufficient: false,
      reason: '存在唯一完整检索组命中，忽略单点 fallback 噪音',
      candidateCount: candidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (importRelationCandidates.length) {
    return {
      insufficient: false,
      reason: '扩区新锚点命中父文件，上一轮候选在父文件引用链内，交给 Judge 裁决父子源码方向',
      candidateCount: candidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      importRelationCandidateCount: importRelationCandidates.length,
      ownershipCount,
    };
  }
  if (candidates.length > 1) {
    return {
      insufficient: true,
      reason: `本地检索命中 ${candidates.length} 个候选文件，需要扩区收敛`,
      candidateCount: candidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  return {
    insufficient: false,
    reason: '',
    candidateCount: candidates.length,
    plannedGroupCandidateCount: plannedGroupCandidates.length,
    ownershipCount,
  };
}

function compactInspectionForModel(inspection) {
  return {
    status: inspection.status,
    candidates: inspection.candidates.map(candidate => ({
      file: candidate.file,
      score: candidate.score,
      matchedGroups: candidate.matchedGroups,
      keywordFacts: candidate.keywordFacts,
      commentOnly: candidate.commentOnly,
      importRelation: candidate.importRelation || null,
      excerpt: candidate.excerpt,
    })),
  };
}

function globPatternMatches(fromFile, pattern, targetFile) {
  if (!pattern || !pattern.includes('*')) return false;
  const absolutePattern = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), pattern));
  const regex = new RegExp(`^${absolutePattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*')}$`);
  return regex.test(targetFile);
}

function dynamicGlobTargets(text) {
  const patterns = [];
  const regex = /import\.meta\.glob\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(String(text || ''))) && patterns.length < 20) {
    patterns.push(match[1]);
  }
  return patterns;
}

function traceCandidateOwners(project, selectedFiles, textCache) {
  const fileMap = buildFileMap(project);
  const reverse = new Map();
  for (const file of fileMap.keys()) {
    for (const child of importedFiles(project, file, fileMap, textCache)) {
      const parents = reverse.get(child.file) || [];
      parents.push(file);
      reverse.set(child.file, uniq(parents));
    }
    const source = readProjectText(project, fileMap.get(file), textCache);
    for (const pattern of dynamicGlobTargets(source)) {
      for (const target of fileMap.keys()) {
        if (!globPatternMatches(file, pattern, target)) continue;
        const parents = reverse.get(target) || [];
        parents.push(file);
        reverse.set(target, uniq(parents));
      }
    }
  }
  const result = [];
  for (const selectedFile of selectedFiles) {
    const queue = [{ file: selectedFile, depth: 0, chain: [selectedFile] }];
    const visited = new Set([selectedFile]);
    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= 3) continue;
      for (const parent of reverse.get(current.file) || []) {
        if (visited.has(parent)) continue;
        visited.add(parent);
        const parentFile = fileMap.get(parent);
        const text = parentFile ? readProjectText(project, parentFile, textCache) : '';
        const basename = path.posix.basename(current.file).replace(/\.[^.]+$/, '');
        const position = Math.max(0, text.indexOf(basename));
        const chain = [...current.chain, parent];
        result.push({
          file: parent,
          depth: current.depth + 1,
          chain,
          excerpt: makeSnippet(text, position, basename.length).slice(0, 3000),
        });
        queue.push({ file: parent, depth: current.depth + 1, chain });
      }
    }
  }
  return result.slice(0, 12);
}

function buildJudgePrompt(body, inspection, ownership, finalRound = false) {
  return [
    '你是源码候选裁决器。候选已经由本地检索并读取局部结构。',
    '比较 DOM 事实与候选源码事实，选择最可能直接生成或控制该选区的文件。',
    '不要重新生成宽泛关键词，不要选择只有注释命中的文件。',
    '必须区分 definition、assembly、render。DOM 内容定义文件不能冒充最终渲染文件。',
    '一个文件可能只命中结构 class，另一个文件只命中文案/路径；这代表 render 与 definition 分离，需要结合用户需求决定返回一个或多个方向，不能只按命中词数量裁决。',
    '你的目标仍然是定位当前 DOM 对应的源码方向，不是提前设计修改方案；用户需求只能帮助理解焦点，不能驱动你搜索接口名、数据源变量、样式写法等实现细节。',
    '如果候选中存在唯一 source=planned-group 且包含 2 个以上关键词的命中，通常代表 DOM 多锚点已在同一局部结构命中；除非它明显只是注释或无关定义，否则优先返回该候选，不要继续 follow-up。',
    'followUpSearches 只能用于寻找更直接生成当前 DOM 的文件，不能用于追踪用户需求里的新接口、新变量、目标样式或修改方案。',
    finalRound
      ? '这是最终裁决轮，不再申请后续搜索；证据不足则返回 ambiguous。'
      : '如果当前只找到 definition/assembly，尚未找到 render，可从 DOM 摘要或已展示候选源码/引用片段里真实出现过的标识符生成一组精确 followUpSearches；不得从用户需求里提取未出现的词，不得凭空猜测标识符。',
    'followUpSearches.keywords 中每个词都必须能在 DOM 摘要、候选事实 excerpt、候选引用者 excerpt 中逐字找到；不存在的词禁止输出。',
    '严格返回 JSON：',
    '{"status":"unique|ambiguous|needs-follow-up","files":[{"file":"","role":"render|definition|assembly","confidence":0,"reason":""}],"followUpSearches":[{"keywords":[""],"mode":"all|any","range":"same-file|same-structure","priority":1,"reason":""}]}',
    `用户需求: ${body.userPrompt || ''}`,
    `选区摘要: ${JSON.stringify(plannerDomInput(body).map(item => ({
      index: item.index,
      tag: item.tag,
      selector: item.selector,
      className: item.className,
      text: item.text,
    })), null, 2)}`,
    `候选事实:\n${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`,
    `候选引用者:\n${JSON.stringify(ownership, null, 2)}`,
  ].join('\n');
}

function followUpCorpus(body, inspection, ownership) {
  return [
    ...plannerDomInput(body).flatMap(item => [
      item.tag,
      item.selector,
      item.className,
      item.text,
      item.markup,
    ]),
    ...selectionList(body).flatMap(selectionContextMarkupValues),
    ...((inspection?.candidates || []).flatMap(candidate => [
      candidate.file,
      candidate.excerpt,
      ...(candidate.keywordFacts || []).map(item => item.keyword),
      ...((candidate.matchedGroups || []).flatMap(group => group.keywords || [])),
    ])),
    ...((ownership || []).flatMap(item => [
      item.file,
      item.excerpt,
      ...(item.chain || []),
    ])),
  ].filter(Boolean).join('\n').toLowerCase();
}

function keywordExistsInFollowUpCorpus(keyword, corpus) {
  const value = String(keyword || '').trim();
  if (!value) return false;
  return corpus.includes(value.toLowerCase());
}

function filterFollowUpSearchesByEvidence(searches, body, inspection, ownership) {
  const corpus = followUpCorpus(body, inspection, ownership);
  const removed = [];
  const filtered = (searches || []).map(search => {
    const keywords = (search.keywords || []).filter(keyword => {
      const ok = keywordExistsInFollowUpCorpus(keyword, corpus);
      if (!ok) removed.push(keyword);
      return ok;
    });
    return { ...search, keywords };
  }).filter(search => search.keywords.length);
  return {
    searches: filtered,
    removed: uniq(removed),
  };
}

function normalizeJudge(parsed, project, allowedFiles = []) {
  const fileSet = new Set((project.files || []).map(file => file.path));
  const allowed = new Set(allowedFiles);
  const files = (Array.isArray(parsed?.files) ? parsed.files : [])
    .map(item => ({
      file: String(item?.file || '').replace(/^\/+/, ''),
      role: ['render', 'definition', 'assembly'].includes(item?.role) ? item.role : 'render',
      confidence: Math.max(0, Math.min(100, Number(item?.confidence || 0))),
      reason: String(item?.reason || ''),
    }))
    .filter(item => fileSet.has(item.file) && allowed.has(item.file));
  return {
    status: parsed?.status === 'unique' && files.length
      ? 'unique'
      : parsed?.status === 'needs-follow-up'
        ? 'needs-follow-up'
        : 'ambiguous',
    files,
    followUpSearches: normalizePlan({
      searches: parsed?.followUpSearches,
    }).searches,
  };
}

function agentHits(inspection, judge, ownership = []) {
  const selected = judge?.status === 'unique'
    ? judge.files
    : inspection.status === 'unique'
      ? [{ file: inspection.selectedFile, role: 'render', confidence: 90, reason: '本地候选事实形成唯一匹配' }]
      : [];
  const selectedMap = new Map(selected.map(item => [item.file, item]));
  const baseCandidates = selected.length
    ? inspection.candidates.filter(candidate => selectedMap.has(candidate.file))
    : inspection.candidates;
  const ranked = baseCandidates.map(candidate => {
    const decision = selectedMap.get(candidate.file);
    return {
      file: candidate.file,
      score: decision ? 1800 + candidate.score : candidate.score,
      stage: 'dom-agent',
      preciseEvidence: !!decision,
      sourceRole: decision?.role || '',
      modelConfidence: decision?.confidence || 0,
      snippet: candidate.excerpt,
      preciseSnippet: decision ? candidate.excerpt : '',
      reasons: [
        'DOM Agent：LLM 检索计划 → 本地候选事实对照',
        ...(candidate.matchedGroups || []).map(group => `同组命中：${group.keywords.join(' + ')}`),
        candidate.commentOnly.length ? `纯注释命中：${candidate.commentOnly.join('、')}` : '',
        decision?.reason || '',
      ].filter(Boolean).slice(0, 12),
    };
  });
  const inspectedFiles = new Set(ranked.map(item => item.file));
  for (const decision of selected) {
    if (inspectedFiles.has(decision.file)) continue;
    const owner = ownership.find(item => item.file === decision.file);
    if (!owner) continue;
    ranked.push({
      file: decision.file,
      score: 1800 + Math.max(0, Number(decision.confidence || 0)),
      stage: 'dom-agent',
      preciseEvidence: true,
      sourceRole: decision.role || '',
      modelConfidence: decision.confidence || 0,
      snippet: owner.excerpt || '',
      preciseSnippet: owner.excerpt || '',
      importChain: owner.chain || [],
      reasons: [
        'DOM Agent：候选源码引用链',
        owner.chain?.length ? `引用链：${owner.chain.join(' -> ')}` : '',
        decision.reason || '',
      ].filter(Boolean),
    });
  }
  return ranked.sort((a, b) => b.score - a.score);
}

async function runAgentSearch(project, body, options = {}) {
  if (!project) throw new Error('No project selected.');
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  const signal = options.signal;
  const invokeModel = options.runModelTask || runModelTask;
  const trigger = domAgentTrigger(body, { ...options, project });
  onLog(`DOM Agent 触发判断：${trigger.enabled ? '启用' : '跳过'}；${trigger.reason || 'ComponentChain 可用且选区未超长'}`);
  if (!trigger.enabled) {
    onLog('本地调用：searchProjectWithMeta(body)');
    const result = searchProjectWithMeta(project, body);
    onLog(`本地输出：候选 ${result.hits.length} 个`);
    return { ...result, agent: { enabled: false, trigger } };
  }
  if (!body.adapter) throw new Error('DOM Agent 需要已配置的定位模型。');

  const textCache = new Map();
  onLog('本地调用：resolvePageRouteTrace(project, body)');
  const routeResult = resolvePageRouteTrace(project, body, textCache);
  onLog(`本地输出：${JSON.stringify({
    matched: !!routeResult.trace?.matched,
    bestPageFile: routeResult.trace?.bestPageFile || '',
    hits: (routeResult.hits || []).slice(0, 4).map(hit => hit.file),
  }, null, 2)}`);
  const domSelections = plannerDomInput(body);
  onLog('本地调用：compressDomMarkup(selection DOM)');
  onLog(`本地输出：${JSON.stringify({
    selections: domSelections.map(item => ({
      index: item.index,
      tag: item.tag,
      rawMarkupLength: item.rawMarkupLength,
      compressedMarkupLength: item.compressedMarkupLength,
      repeatedGroupCount: item.compression.repeatedGroupCount,
    })),
  }, null, 2)}`);
  const plannerPrompt = buildPlannerPrompt(project, body, routeResult.trace, domSelections);
  const plannerSystemPrompt = buildLocatorSystemPrompt();
  onLog(`DOM Agent System Prompt（${plannerSystemPrompt.length} 字符）:\n${plannerSystemPrompt}`);
  onLog(`DOM Agent Planner 输入（${plannerPrompt.length} 字符）:\n${plannerPrompt}`);
  const plannerResult = await invokeModel(body.adapter, plannerPrompt, project.path, {
    signal,
    onLog,
    systemPrompt: plannerSystemPrompt,
  });
  onLog(`DOM Agent Planner 输出（${plannerResult.rawText.length} 字符）:\n${plannerResult.rawText || '-'}`);
  const plannerParsed = parseJsonResult(plannerResult.rawText);
  const locatorDecision = normalizeLocatorDecision(plannerParsed || {});
  const locatorValidation = validateLocatorDecision(locatorDecision);
  if (locatorDecision.status) {
    onLog(`DOM Agent LocatorDecision 校验：${locatorValidation.valid ? '通过' : `失败：${locatorValidation.errors.join('；')}`}`);
  }
  let plan = locatorValidation.valid
    ? locatorDecisionToSearchPlan(locatorDecision)
    : { searches: [], needMoreDom: false };
  if (!plan.searches.length && !plan.needMoreDom) {
    plan = normalizePlan(plannerParsed);
  }
  const filteredPlan = filterPlanByVisibleEvidence(plan, body, routeResult.trace);
  if (filteredPlan.removed.length) {
    onLog(`DOM Agent Planner 计划过滤：丢弃未在 DOM/路由证据中出现的词 ${filteredPlan.removed.join('、')}`);
  }
  plan = filteredPlan.plan;
  const inheritedKeywords = inheritedSearchKeywords(body?.agentState || null);
  if (inheritedKeywords.length) {
    onLog(`DOM Agent 扩区保留上一轮检索锚点用于引用链验证：${inheritedKeywords.join('、')}`);
  }
  const combinedPlan = expansionCombinedSearchPlan(plan, body?.agentState || null);
  if (!plan.searches.length) {
    if (plan.needMoreDom) {
      const evidence = {
        insufficient: true,
        reason: 'Planner 判断当前选区无法形成稳定检索计划',
        candidateCount: 0,
      };
      onLog(`DOM Agent 证据不足：${evidence.reason}`);
      return {
        hits: [],
        routeResolver: routeResult.trace,
        apiTrace: null,
        i18nTrace: null,
        definitionTrace: null,
        needMoreDom: true,
        needsMoreEvidence: true,
        agent: {
          enabled: true,
          trigger,
          plan,
          evidence,
          needMoreDom: true,
        },
      };
    }
    throw new Error('DOM Agent Planner 未返回可执行检索计划。');
  }

  let combinedCandidates = [];
  if (combinedPlan.plan.searches.length) {
    onLog(`本地调用：executeSearchPlan(project, ${JSON.stringify(combinedPlan.plan)})`);
    combinedCandidates = executeSearchPlan(project, combinedPlan.plan, textCache).map(candidate => ({
      ...candidate,
      score: candidate.score + 180,
    }));
    onLog(`本地输出：${JSON.stringify({
      candidateCount: combinedCandidates.length,
      files: combinedCandidates.map(candidate => ({
        file: candidate.file,
        score: candidate.score,
        matchedGroups: candidate.matchedGroups.map(group => group.keywords),
      })),
    }, null, 2)}`);
  }

  onLog(`本地调用：executeSearchPlan(project, ${JSON.stringify(plan)})`);
  const currentCandidates = executeSearchPlan(project, plan, textCache);
  const related = expansionRelatedCandidateHits(project, currentCandidates, body?.agentState || null, textCache);
  if (related.relations.length) {
    onLog(`DOM Agent 扩区引用链命中：${JSON.stringify(related.relations, null, 2)}`);
  }
  const candidateMap = new Map();
  for (const candidate of [...combinedCandidates, ...currentCandidates, ...related.candidates]) {
    const old = candidateMap.get(candidate.file);
    if (!old || Number(candidate.score || 0) > Number(old.score || 0)) {
      candidateMap.set(candidate.file, candidate);
    }
  }
  const candidates = Array.from(candidateMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);
  onLog(`本地输出：${JSON.stringify({
    candidateCount: candidates.length,
    files: candidates.map(candidate => ({
      file: candidate.file,
      score: candidate.score,
      matchedGroups: candidate.matchedGroups.map(group => group.keywords),
    })),
  }, null, 2)}`);

  onLog(`本地调用：inspectCandidates(project, ${JSON.stringify(candidates.map(item => item.file))})`);
  const inspectionPlan = {
    searches: [
      ...combinedPlan.plan.searches,
      ...plan.searches,
    ],
  };
  let inspection = inspectCandidates(project, candidates, inspectionPlan, textCache);
  onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);

  let ownership = traceCandidateOwners(
    project,
    inspection.candidates.slice(0, 3).map(item => item.file),
    textCache
  );
  onLog(`本地调用：traceCandidateOwners(project, ${JSON.stringify(inspection.candidates.slice(0, 3).map(item => item.file))})`);
  onLog(`本地输出：${JSON.stringify(ownership, null, 2)}`);

  const evidence = analyzeEvidenceSufficiency(plan, inspection, ownership);
  onLog(`本地调用：analyzeEvidenceSufficiency(plan, inspection, ownership)`);
  onLog(`本地输出：${JSON.stringify(evidence, null, 2)}`);
  if (evidence.insufficient) {
    onLog(`DOM Agent 证据不足：${evidence.reason}`);
    return {
      hits: [],
      routeResolver: routeResult.trace,
      apiTrace: null,
      i18nTrace: null,
      definitionTrace: null,
      needMoreDom: true,
      needsMoreEvidence: true,
      agent: {
        enabled: true,
        trigger,
        plan,
        inspection: compactInspectionForModel(inspection),
        evidence,
        needMoreDom: true,
      },
    };
  }

  let judgePrompt = buildJudgePrompt(body, inspection, ownership, false);
  onLog(`DOM Agent Judge 输入（${judgePrompt.length} 字符）:\n${judgePrompt}`);
  let judgeResult = await invokeModel(body.adapter, judgePrompt, project.path, {
    signal,
    onLog,
    systemPrompt: '你是 Magnus 源码候选裁决器。只根据给定候选事实返回 JSON。',
  });
  onLog(`DOM Agent Judge 输出（${judgeResult.rawText.length} 字符）:\n${judgeResult.rawText || '-'}`);
  let judge = normalizeJudge(
    parseJsonResult(judgeResult.rawText),
    project,
    uniq([
      ...inspection.candidates.map(item => item.file),
      ...ownership.map(item => item.file),
    ])
  );
  const followUpFilter = filterFollowUpSearchesByEvidence(judge.followUpSearches, body, inspection, ownership);
  if (followUpFilter.removed.length) {
    onLog(`DOM Agent Judge 后续检索词过滤：丢弃未在 DOM/候选源码中出现的词 ${followUpFilter.removed.join('、')}`);
  }
  judge.followUpSearches = followUpFilter.searches;
  if (judge.status === 'needs-follow-up' && !judge.followUpSearches.length) {
    judge.status = 'ambiguous';
  }

  if (judge.status === 'needs-follow-up' && judge.followUpSearches.length) {
    const followUpPlan = {
      searches: judge.followUpSearches,
      needMoreDom: false,
    };
    onLog(`本地调用：executeSearchPlan(project, ${JSON.stringify(followUpPlan)})`);
    const followUpCandidates = executeSearchPlan(project, followUpPlan, textCache);
    onLog(`本地输出：${JSON.stringify({
      candidateCount: followUpCandidates.length,
      files: followUpCandidates.map(item => item.file),
    }, null, 2)}`);
    const mergedCandidates = Array.from(new Map(
      [...candidates, ...followUpCandidates].map(item => [item.file, item])
    ).values());
    inspection = inspectCandidates(project, mergedCandidates, {
      searches: [...plan.searches, ...followUpPlan.searches],
    }, textCache);
    onLog(`本地调用：inspectCandidates(project, ${JSON.stringify(mergedCandidates.map(item => item.file))})`);
    onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);
    ownership = traceCandidateOwners(
      project,
      inspection.candidates.slice(0, 4).map(item => item.file),
      textCache
    );
    judgePrompt = buildJudgePrompt(body, inspection, ownership, true);
    onLog(`DOM Agent Judge 第 2 轮输入（${judgePrompt.length} 字符）:\n${judgePrompt}`);
    judgeResult = await invokeModel(body.adapter, judgePrompt, project.path, {
      signal,
      onLog,
      systemPrompt: '你是 Magnus 源码候选裁决器。只根据给定候选事实返回 JSON。',
    });
    onLog(`DOM Agent Judge 第 2 轮输出（${judgeResult.rawText.length} 字符）:\n${judgeResult.rawText || '-'}`);
    judge = normalizeJudge(
      parseJsonResult(judgeResult.rawText),
      project,
      uniq([
        ...inspection.candidates.map(item => item.file),
        ...ownership.map(item => item.file),
      ])
    );
  }

  const hits = agentHits(inspection, judge, ownership);
  onLog(`DOM Agent 最终输出：${JSON.stringify({
    status: judge?.status || inspection.status,
    files: hits.slice(0, 6).map(hit => ({
      file: hit.file,
      score: hit.score,
      role: hit.sourceRole || '',
    })),
  }, null, 2)}`);
  return {
    hits,
    routeResolver: routeResult.trace,
    apiTrace: null,
    i18nTrace: null,
    definitionTrace: null,
    agent: {
      enabled: true,
      trigger,
      plan,
      inspection: compactInspectionForModel(inspection),
      evidence,
      judge,
    },
  };
}

module.exports = {
  DEFAULT_DOM_AGENT_THRESHOLD,
  compressDomMarkup,
  analyzeEvidenceSufficiency,
  domAgentTrigger,
  executeSearchPlan,
  filterFollowUpSearchesByEvidence,
  inspectCandidates,
  runAgentSearch,
  traceCandidateOwners,
};
