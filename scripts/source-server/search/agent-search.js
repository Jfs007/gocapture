const path = require('path');
const { isTextFile, readProjectText } = require('../core/fs-utils');
const { runModelTask } = require('../model/model-adapters');
const { escapeRegExp, makeSnippet, uniq } = require('../utils');
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
const MAX_EXCERPT_CHARS = 7000;
const MAX_COMPRESSED_DOM_CHARS = 30000;
const MAX_INHERITED_KEYWORDS = 4;
const MAX_DEFINITION_RESOLVER_SEARCHES = 2;
const MAX_OWNER_DEPTH = 3;
const MAX_OWNERS_PER_CANDIDATE = 4;
const MAX_ROUTE_RELATION_DEPTH = 5;
const STYLE_EXTENSIONS = new Set(['.css', '.less', '.scss', '.sass', '.styl']);
const NATIVE_HTML_TAGS = new Set([
  'a', 'article', 'aside', 'button', 'canvas', 'caption', 'code', 'col', 'colgroup',
  'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'em', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header',
  'hr', 'i', 'iframe', 'img', 'input', 'label', 'legend', 'li', 'main', 'nav',
  'ol', 'option', 'p', 'picture', 'pre', 'section', 'select', 'small', 'span',
  'strong', 'summary', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead',
  'time', 'tr', 'ul', 'video',
]);

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
    const parsedMarkup = parseHtmlLite(rawMarkup);
    const rootElement = (parsedMarkup.children || []).find(child => child.type === 'element') || null;
    const rootDirectText = rootElement ? directText(rootElement) : '';
    const compression = compressDomMarkup(rawMarkup);
    const markup = (compression.markup || rawMarkup).slice(0, MAX_DOM_INPUT_CHARS);
    return {
      index: index + 1,
      tag: info.tag || info.tagName || '',
      selector: info.selector || '',
      className: info.className || '',
      text: info.text || '',
      directText: rootDirectText,
      textScope: rootDirectText && compactWhitespace(info.text || '') === rootDirectText
        ? 'root-direct-text'
        : 'descendant-flat-text',
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
    ...selectionList(body).flatMap(selection => {
      const sourceLocate = selection?.sourceLocate
        || selection?.sourceEvidence
        || selection?.element?.sourceLocate
        || null;
      return (sourceLocate?.componentChain || []).flatMap(component => [
        component?.name,
        component?.file,
      ]);
    }),
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

function domClassTokenSet(body) {
  const tokens = new Set();
  const add = value => {
    for (const token of String(value || '').split(/\s+/)) {
      const text = token.trim();
      if (text) tokens.add(text);
    }
  };
  for (const selection of selectionList(body)) {
    const info = selection?.element || selection?.info || selection || {};
    add(info.className || '');
    for (const markup of selectionContextMarkupValues(selection)) {
      const regex = /\bclass\s*=\s*["']([^"']+)["']/gi;
      let match;
      while ((match = regex.exec(String(markup || '')))) add(match[1]);
    }
  }
  return tokens;
}

function domAttributePairs(body) {
  const pairs = [];
  for (const selection of selectionList(body)) {
    for (const markup of selectionContextMarkupValues(selection)) {
      const regex = /\s([:@\w-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
      let match;
      while ((match = regex.exec(String(markup || '')))) {
        const key = String(match[1] || '').replace(/^:/, '').trim();
        const value = String(match[3] ?? match[4] ?? match[5] ?? '').trim();
        if (!key || key === 'class' || key === 'style' || !value) continue;
        pairs.push({ key, value });
      }
    }
  }
  return uniq(pairs.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
}

function collectDirectTextStructures(node, result = []) {
  if (!node || node.type !== 'element') return result;
  const text = directText(node);
  if (text && node.tag !== 'root') {
    result.push({
      text,
      tag: String(node.tag || '').toLowerCase(),
      classes: classTokens(node.attrs),
    });
  }
  for (const child of node.children || []) {
    if (child.type === 'element') collectDirectTextStructures(child, result);
  }
  return result;
}

function domDirectTextStructures(body) {
  const structures = [];
  for (const selection of selectionList(body)) {
    for (const markup of selectionContextMarkupValues(selection)) {
      collectDirectTextStructures(parseHtmlLite(markup), structures);
    }
  }
  return uniq(structures.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
}

function domStyleTokenSet(body) {
  const tokens = new Set();
  for (const selection of selectionList(body)) {
    for (const markup of selectionContextMarkupValues(selection)) {
      const regex = /\bstyle\s*=\s*("([^"]*)"|'([^']*)')/gi;
      let match;
      while ((match = regex.exec(String(markup || '')))) {
        const declarations = String(match[2] ?? match[3] ?? '').split(';');
        for (const declaration of declarations) {
          const separator = declaration.indexOf(':');
          if (separator === -1) continue;
          const key = declaration.slice(0, separator).trim();
          const value = declaration.slice(separator + 1).trim();
          if (!key || !value || key.startsWith('--')) continue;
          tokens.add(key);
          tokens.add(value);
          tokens.add(`${key}: ${value}`);
          tokens.add(`${key}:${value}`);
        }
      }
    }
  }
  return tokens;
}

function serializedAttributeKeyword(keyword) {
  const match = String(keyword || '').trim().match(/^([:@\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))$/);
  if (!match) return null;
  const key = String(match[1] || '').replace(/^:/, '').trim();
  const value = String(match[2] ?? match[3] ?? match[4] ?? '').trim();
  return key && value ? { key, value } : null;
}

function annotatePlanKeywordTypes(plan, body) {
  const classTokens = domClassTokenSet(body);
  const attributePairs = domAttributePairs(body);
  const directTextStructures = domDirectTextStructures(body);
  const styleTokens = domStyleTokenSet(body);
  const searches = (plan.searches || []).map(search => {
    const expandedKeywords = [];
    const searchAttributePairs = [];
    for (const keyword of search.keywords || []) {
      const serialized = serializedAttributeKeyword(keyword);
      const pair = serialized && attributePairs.find(item => {
        return item.key === serialized.key && item.value === serialized.value;
      });
      if (pair) {
        expandedKeywords.push(pair.key, pair.value);
        searchAttributePairs.push(pair);
      } else {
        expandedKeywords.push(keyword);
      }
    }
    for (const pair of attributePairs) {
      if (expandedKeywords.includes(pair.key) && expandedKeywords.includes(pair.value)) {
        searchAttributePairs.push(pair);
      }
    }
    const keywords = uniq(expandedKeywords);
    const keywordTypes = {};
    const domTextStructures = {};
    const evidenceKinds = {};
    for (const keyword of keywords) {
      if (classTokens.has(String(keyword || '').trim())) {
        keywordTypes[keyword] = 'class-token';
        evidenceKinds[keyword] = 'class';
      }
      if (searchAttributePairs.some(pair => pair.key === keyword)) {
        keywordTypes[keyword] = 'attribute-name';
        evidenceKinds[keyword] = 'other';
      }
      if (searchAttributePairs.some(pair => pair.value === keyword)) {
        keywordTypes[keyword] = 'attribute-value';
        evidenceKinds[keyword] = 'other';
      }
      if (!keywordTypes[keyword] && styleTokens.has(keyword)) {
        keywordTypes[keyword] = 'style-token';
        evidenceKinds[keyword] = 'style';
      }
      if (!keywordTypes[keyword]) {
        const structures = directTextStructures.filter(item => item.text.includes(keyword));
        if (structures.length) {
          domTextStructures[keyword] = structures.slice(0, 8);
          evidenceKinds[keyword] = 'text';
        }
      }
      if (!evidenceKinds[keyword]) evidenceKinds[keyword] = 'other';
    }
    return {
      ...search,
      keywords,
      ...(Object.keys(keywordTypes).length ? { keywordTypes } : {}),
      evidenceKinds,
      ...(Object.keys(domTextStructures).length ? { domTextStructures } : {}),
      ...(searchAttributePairs.length
        ? {
            attributePairs: uniq(searchAttributePairs.map(item => JSON.stringify(item)))
              .map(item => JSON.parse(item)),
          }
        : {}),
    };
  });
  return { ...plan, searches };
}

function planEvidenceKinds(plan) {
  return (plan?.searches || []).flatMap((search, searchIndex) => {
    return (search.keywords || []).map(keyword => ({
      search: searchIndex + 1,
      keyword,
      kind: search?.evidenceKinds?.[keyword] || 'other',
      matcher: search?.keywordTypes?.[keyword] || 'literal',
    }));
  });
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

function classTokenIndexes(text, keyword, filePath = '') {
  const source = String(text || '');
  const value = String(keyword || '').trim();
  if (!source || !value) return [];
  const indexes = [];
  const escaped = escapeRegExp(value);
  const ext = path.posix.extname(filePath || '').toLowerCase();
  const patterns = [
    new RegExp(`\\bclass(?:Name)?\\s*=\\s*["'][^"']*(?<![\\w-])${escaped}(?![\\w-])[^"']*["']`, 'gi'),
    new RegExp(`\\bclass(?:Name)?\\s*:\\s*["'\`][^"'\`]*(?<![\\w-])${escaped}(?![\\w-])[^"'\`]*["'\`]`, 'gi'),
    new RegExp(`\\bclass(?:Name)?\\s*:\\s*[\\[{][\\s\\S]{0,220}(?<![\\w-])["'\`]?${escaped}["'\`]?(?![\\w-])`, 'gi'),
    new RegExp(`['"]class['"]\\s*:\\s*["'\`][^"'\`]*(?<![\\w-])${escaped}(?![\\w-])[^"'\`]*["'\`]`, 'gi'),
    new RegExp(`h\\([^\\n]{0,220}\\bclass\\s*:\\s*[\\s\\S]{0,220}(?<![\\w-])["'\`]?${escaped}["'\`]?(?![\\w-])`, 'gi'),
  ];
  if (STYLE_EXTENSIONS.has(ext)) {
    patterns.push(new RegExp(`(^|[\\s,{>+~])\\.${escaped}(?![\\w-])`, 'g'));
  }
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) && indexes.length < 20) {
      const index = match.index + Math.max(0, match[0].indexOf(value));
      indexes.push(index);
    }
  }
  return uniq(indexes).sort((a, b) => a - b);
}

function attributePairIndexes(text, pair) {
  const source = String(text || '');
  const key = String(pair?.key || '').trim();
  const value = String(pair?.value || '').trim();
  if (!source || !key || !value) return [];
  const escapedKey = escapeRegExp(key);
  const escapedValue = escapeRegExp(value);
  const patterns = [
    new RegExp(`(?:^|[\\s<{])(?::)?${escapedKey}\\s*=\\s*["'][^"']*${escapedValue}[^"']*["']`, 'gmi'),
    new RegExp(`["'\`]${escapedKey}["'\`]\\s*:\\s*["'\`][^"'\`]*${escapedValue}[^"'\`]*["'\`]`, 'gmi'),
  ];
  const indexes = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) && indexes.length < 20) {
      indexes.push(match.index);
    }
  }
  return uniq(indexes).sort((a, b) => a - b);
}

function attributeTokenIndexes(text, keyword, search, type) {
  const pairs = (search?.attributePairs || []).filter(pair => {
    return type === 'attribute-name'
      ? pair.key === keyword
      : pair.value === keyword;
  });
  return uniq(pairs.flatMap(pair => attributePairIndexes(text, pair))).sort((a, b) => a - b);
}

function styleTokenIndexes(text, keyword) {
  const source = String(text || '');
  const value = String(keyword || '').trim();
  if (!source || !value) return [];
  const escaped = escapeRegExp(value);
  const patterns = [
    new RegExp(`\\bstyle\\s*=\\s*["'][^"']*${escaped}[^"']*["']`, 'gi'),
    new RegExp(`(?:^|[;{]\\s*)[A-Za-z-]+\\s*:\\s*[^;}\\n]*${escaped}`, 'gmi'),
    new RegExp(`\\bstyle\\s*:\\s*(?:["'\`][^"'\`]*${escaped}|\\{[^}]*${escaped})`, 'gi'),
  ];
  const indexes = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) && indexes.length < 20) indexes.push(match.index);
  }
  return uniq(indexes).sort((a, b) => a - b);
}

function keywordType(search, keyword) {
  return search?.keywordTypes?.[keyword] || '';
}

function textEvidenceIndexes(text, keyword) {
  const source = String(text || '');
  const value = String(keyword || '');
  if (!source || !value) return [];
  const indexes = keywordIndexes(source, value);
  const wordLike = /[\p{L}\p{N}_]/u;
  return indexes.filter(index => {
    const before = index > 0 ? source[index - 1] : '';
    const after = source[index + value.length] || '';
    const startsWord = wordLike.test(value[0] || '');
    const endsWord = wordLike.test(value[value.length - 1] || '');
    if (startsWord && before && wordLike.test(before)) return false;
    if (endsWord && after && wordLike.test(after)) return false;
    return true;
  });
}

function keywordIndexesForSearch(text, keyword, search, filePath = '') {
  const type = keywordType(search, keyword);
  if (type === 'class-token') return classTokenIndexes(text, keyword, filePath);
  if (type === 'attribute-name' || type === 'attribute-value') {
    return attributeTokenIndexes(text, keyword, search, type);
  }
  if (type === 'style-token') return styleTokenIndexes(text, keyword);
  if (search?.evidenceKinds?.[keyword] === 'text') return textEvidenceIndexes(text, keyword);
  return keywordIndexes(text, keyword);
}

function groupMatch(text, search, filePath = '') {
  const matches = search.keywords.map(keyword => ({
    keyword,
    indexes: keywordIndexesForSearch(text, keyword, search, filePath),
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

function candidateSort(a, b) {
  const scoreDiff = b.score - a.score;
  if (scoreDiff) return scoreDiff;
  const styleDiff = Number(STYLE_EXTENSIONS.has(path.posix.extname(a.file)))
    - Number(STYLE_EXTENSIONS.has(path.posix.extname(b.file)));
  if (styleDiff) return styleDiff;
  return a.file.localeCompare(b.file);
}

function executeSearchPlan(project, plan, textCache) {
  const candidateMap = new Map();
  for (const file of sourceFiles(project)) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    for (const search of plan.searches) {
      const match = groupMatch(text, search, file.path);
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
        const positions = keywordIndexesForSearch(text, keyword, search, file.path);
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
  const ranked = Array.from(candidateMap.values())
    .map(candidate => ({
      ...candidate,
      matchedKeywords: uniq(candidate.matchedKeywords),
      positions: uniq(candidate.positions).sort((a, b) => a - b),
    }));
  return ranked.sort(candidateSort);
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
    .filter(item => item?.file);
  if (!previousCandidates.length || !currentCandidates.length) return { candidates: [], relations: [] };

  const inherited = inheritedSearchKeywords(agentState);
  const previousByFile = new Map(previousCandidates.map(item => [item.file, item]));
  const previousFiles = Array.from(previousByFile.keys());
  const currentFiles = new Set(currentCandidates.map(item => item.file));
  const candidateMap = new Map();
  const relations = [];

  for (const parent of currentCandidates) {
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

function candidateSourceRole(filePath, text) {
  const ext = path.posix.extname(filePath || '').toLowerCase();
  const source = String(text || '');
  if (STYLE_EXTENSIONS.has(ext)) {
    return {
      role: 'style-reference',
      referenceOnly: true,
      reasons: ['样式文件只作为 UI 样式参考，不作为 DOM 渲染源码'],
    };
  }
  if (ext === '.json') {
    return {
      role: 'definition-like',
      referenceOnly: true,
      reasons: ['JSON 只承载数据/配置，不能直接生成 DOM，需要追踪其渲染使用处'],
    };
  }
  const renderSignals = [
    /<template[\s>]/i,
    /\bdefineComponent\s*\(/,
    /\bh\s*\(/,
    /\bcreateElement\s*\(/,
    /\bReact\.createElement\s*\(/,
    /\breturn\s*\(\s*</,
    /\bclassName\s*[=:]/,
    /\bclass\s*:\s*/,
    /\bclass\s*=/,
    /\bsetup\s*\(/,
    /\brender\s*[:=]\s*/,
  ];
  if (renderSignals.some(pattern => pattern.test(source))) {
    return {
      role: 'render-like',
      referenceOnly: false,
      reasons: ['源码包含渲染/组件结构信号'],
    };
  }
  const definitionSignals = [
    /\bexport\s+default\s+\{/,
    /\bexport\s+const\s+\w+\s*=/,
    /\bexport\s+default\s+\[/,
    /\bconst\s+\w+\s*=\s*(?:\{|\[)/,
  ];
  if (definitionSignals.some(pattern => pattern.test(source))) {
    return {
      role: 'definition-like',
      referenceOnly: true,
      reasons: ['源码更像常量/文案/配置定义，需要结合引用链确认真实使用处'],
    };
  }
  return {
    role: 'unknown',
    referenceOnly: false,
    reasons: [],
  };
}

function sourceDirectTextStructures(text, keyword) {
  const source = String(text || '');
  const value = String(keyword || '').trim();
  if (!source || !value) return [];
  const escaped = escapeRegExp(value);
  const pattern = new RegExp(
    `<([A-Za-z][\\w.-]*)\\b([^>]*)>[^<]{0,240}${escaped}[^<]{0,240}<\\/\\1\\s*>`,
    'gi'
  );
  const structures = [];
  let match;
  while ((match = pattern.exec(source)) && structures.length < 12) {
    const rawTag = String(match[1] || '');
    const tag = rawTag.toLowerCase();
    if (rawTag !== tag || !NATIVE_HTML_TAGS.has(tag)) continue;
    const attrSource = match[2] || '';
    const attrs = parseAttributes(attrSource);
    structures.push({
      tag,
      classes: classTokens(attrs),
      dynamicClass: /(?:^|\s)(?::class|v-bind:class|className\s*=\s*\{|class\s*=\s*\{)/.test(attrSource),
      index: match.index,
    });
  }
  return structures;
}

function keywordDomTextStructures(plan, keyword) {
  return uniq((plan.searches || []).flatMap(search => {
    return search?.domTextStructures?.[keyword] || [];
  }).map(item => JSON.stringify(item))).map(item => JSON.parse(item));
}

function directTextStructureMismatch(text, keyword, plan) {
  const domStructures = keywordDomTextStructures(plan, keyword);
  if (!domStructures.length) return null;
  const sourceStructures = sourceDirectTextStructures(text, keyword);
  if (!sourceStructures.length) return null;
  const compatible = sourceStructures.some(source => {
    return domStructures.some(dom => {
      if (source.tag !== dom.tag) return false;
      if (source.dynamicClass || !source.classes.length) return true;
      const domClasses = new Set(dom.classes || []);
      return source.classes.every(className => domClasses.has(className));
    });
  });
  if (compatible) return null;
  return {
    keyword,
    domTags: uniq(domStructures.map(item => item.tag)),
    sourceTags: uniq(sourceStructures.map(item => item.tag)),
    domClasses: uniq(domStructures.flatMap(item => item.classes || [])),
    sourceClasses: uniq(sourceStructures.flatMap(item => item.classes || [])),
  };
}

function candidateEffectiveKeywordSet(candidate) {
  return new Set((candidate?.keywordFacts || [])
    .filter(item => item.codeCount > 0 && !item.structureMismatch)
    .map(item => item.keyword));
}

function originalDomClassTokens(body) {
  const tokens = new Set();
  for (const selection of selectionList(body)) {
    const info = selection?.element || selection?.info || selection || {};
    const values = [String(info.className || '')];
    const markup = selectionMarkup(selection);
    const regex = /\bclass\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = regex.exec(markup))) values.push(match[1]);
    for (const value of values) {
      for (const token of value.split(/\s+/)) {
        if (token.trim()) tokens.add(token.trim());
      }
    }
  }
  return tokens;
}

function sourceDomClassCoverage(text, filePath, domClasses) {
  const matchedClasses = Array.from(domClasses || []).filter(className => {
    return classTokenIndexes(text, className, filePath).length > 0;
  });
  return {
    matchedClasses,
    matchedClassCount: matchedClasses.length,
    totalDomClassCount: domClasses?.size || 0,
  };
}

function pruneStrictDomCoverageSubsets(inspected) {
  const renderCandidates = inspected.filter(candidate => !candidate.referenceOnly);
  return inspected.filter(candidate => {
    if (candidate.referenceOnly) return true;
    const own = new Set(candidate.domCoverage?.matchedClasses || []);
    if (!own.size) return true;
    return !renderCandidates.some(other => {
      if (other === candidate) return false;
      const otherClasses = new Set(other.domCoverage?.matchedClasses || []);
      if (otherClasses.size < 2 || otherClasses.size <= own.size) return false;
      return Array.from(own).every(className => otherClasses.has(className));
    });
  });
}

function pruneTextOnlyRenderCandidates(inspected, plan) {
  const structuralKeywords = new Set((plan?.searches || []).flatMap(search => {
    return (search.keywords || []).filter(keyword => {
      const kind = search?.evidenceKinds?.[keyword];
      const type = search?.keywordTypes?.[keyword];
      return kind === 'class'
        || type === 'attribute-name'
        || type === 'attribute-value';
    });
  }));
  if (!structuralKeywords.size) return inspected;
  const hasStructuralRender = inspected.some(candidate => {
    if (candidate.referenceOnly) return false;
    const evidence = candidateEffectiveKeywordSet(candidate);
    return Array.from(structuralKeywords).some(keyword => evidence.has(keyword));
  });
  if (!hasStructuralRender) return inspected;
  return inspected.filter(candidate => {
    if (candidate.referenceOnly) return true;
    const evidence = candidateEffectiveKeywordSet(candidate);
    const structuralMatch = Array.from(structuralKeywords).some(keyword => evidence.has(keyword));
    if (structuralMatch) return true;
    candidate.roleReasons = uniq([
      ...(candidate.roleReasons || []),
      '仅命中复合容器后代文案，未命中任何 DOM 结构锚点',
    ]);
    return false;
  });
}

function candidateHasExactQuotedKeyword(candidate) {
  const excerpt = String(candidate?.excerpt || '');
  return (candidate?.keywordFacts || []).some(item => {
    const keyword = String(item?.keyword || '').trim();
    if (!keyword) return false;
    return new RegExp(`["'\`]\\s*${escapeRegExp(keyword)}\\s*["'\`]`).test(excerpt);
  });
}

function pruneDominatedDomCandidates(inspected, plan) {
  const plannedKeywords = uniq((plan?.searches || [])
    .flatMap(search => search.keywords || [])
    .map(keyword => String(keyword || '').trim())
    .filter(Boolean));
  if (plannedKeywords.length < 2) return inspected;
  const completeRenderCandidates = inspected.filter(candidate => {
    if (candidate.referenceOnly || candidate.sourceRole !== 'render-like') return false;
    const evidence = candidateEffectiveKeywordSet(candidate);
    return plannedKeywords.every(keyword => evidence.has(keyword));
  });
  if (completeRenderCandidates.length !== 1) return inspected;
  const winner = completeRenderCandidates[0];
  const winnerEvidence = candidateEffectiveKeywordSet(winner);
  winner.roleReasons = uniq([
    ...(winner.roleReasons || []),
    '唯一覆盖本轮全部 DOM 检索锚点，淘汰只命中其证据子集的候选',
  ]);
  return inspected.filter(candidate => {
    if (candidate === winner) return true;
    const evidence = candidateEffectiveKeywordSet(candidate);
    if (!evidence.size || evidence.size >= winnerEvidence.size) return true;
    const dominated = Array.from(evidence).every(keyword => winnerEvidence.has(keyword));
    if (!dominated) return true;
    if (!candidate.referenceOnly) return false;
    if (candidate.sourceRole === 'style-reference') return true;
    return candidateHasExactQuotedKeyword(candidate);
  });
}

function definitionValueRefs(text, keywordFacts) {
  const source = String(text || '');
  const refs = [];
  const textKeywords = (keywordFacts || [])
    .filter(item => item.codeCount > 0 && item.type !== 'class-token')
    .map(item => String(item.keyword || '').trim())
    .filter(Boolean);
  for (const keyword of uniq(textKeywords)) {
    const escaped = escapeRegExp(keyword);
    const simplePattern = new RegExp(`([A-Za-z_$][\\w$-]*)\\s*:\\s*["'\`][^"'\`]{0,200}${escaped}[^"'\`]{0,200}["'\`]`, 'g');
    const nestedPattern = new RegExp(`([A-Za-z_$][\\w$-]*)\\s*:\\s*\\{[^{}\\n]{0,400}?([A-Za-z_$][\\w$-]*)\\s*:\\s*["'\`][^"'\`]{0,200}${escaped}[^"'\`]{0,200}["'\`]`, 'g');
    let match;
    while ((match = nestedPattern.exec(source)) && refs.length < 20) {
      refs.push({
        keyword,
        key: match[2],
        path: `${match[1]}.${match[2]}`,
      });
    }
    while ((match = simplePattern.exec(source)) && refs.length < 20) {
      const key = match[1];
      refs.push({ keyword, key, path: '' });
    }
  }
  return uniq(refs.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
}

function identifierIndexes(text, identifier) {
  const source = String(text || '');
  const value = String(identifier || '').trim();
  if (!source || !value) return [];
  const pattern = new RegExp(`(?<![\\w$-])${escapeRegExp(value)}(?![\\w$-])`, 'g');
  const indexes = [];
  let match;
  while ((match = pattern.exec(source)) && indexes.length < 20) indexes.push(match.index);
  return indexes;
}

function definitionRefSearchTerms(project, refs, textCache) {
  const terms = [];
  const files = sourceFiles(project);
  const maxStandaloneKeyFiles = Math.min(20, Math.max(4, Math.ceil(files.length * 0.01)));
  for (const ref of refs || []) {
    if (ref.path) terms.push(ref.path);
    const key = String(ref.key || '');
    if (key.length < 4 || ref.path) continue;
    let fileCount = 0;
    for (const file of files) {
      const text = readProjectText(project, file, textCache);
      if (!identifierIndexes(text, key).length) continue;
      fileCount += 1;
      if (fileCount > maxStandaloneKeyFiles) break;
    }
    if (fileCount <= maxStandaloneKeyFiles) terms.push(key);
  }
  return uniq(terms);
}

function createDefinitionLinkedCandidate(project, file, text, terms, definitionFile) {
  const positions = uniq(terms.flatMap(term => keywordIndexes(text, term))).slice(0, 8);
  if (!positions.length) return null;
  return {
    file: file.path,
    score: 260 + positions.length * 18,
    matchedGroups: [{
      priority: 1,
      keywords: terms,
      range: 'same-file',
      reason: `定义值 key/path 在渲染源码中被使用：${definitionFile}`,
      source: 'definition-key-reference',
    }],
    matchedKeywords: terms,
    positions,
    definitionLinks: [{
      type: 'key-reference',
      definitionFile,
      terms,
    }],
  };
}

function enrichDefinitionCandidates(project, inspected, plan, textCache) {
  const fileMap = buildFileMap(project);
  const byFile = new Map(inspected.map(item => [item.file, item]));
  const renderCandidates = inspected.filter(item => !item.referenceOnly);
  const definitionCandidates = inspected.filter(item => item.sourceRole === 'definition-like');

  for (const definition of definitionCandidates) {
    const links = [];
    for (const render of renderCandidates) {
      const chains = importChainFromParent(project, render.file, [definition.file], textCache, 3);
      const chain = chains.get(definition.file);
      if (chain) {
        links.push({
          type: 'import-relation',
          renderFile: render.file,
          chain,
        });
      }
    }
    if (links.length) {
      definition.definitionLinks = uniq([
        ...(definition.definitionLinks || []),
        ...links,
      ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
      definition.roleReasons = uniq([
        ...(definition.roleReasons || []),
        '定义文件被渲染候选通过 import 链引用，作为参考而非最终 DOM 源码',
      ]);
    }
  }

  for (const definition of definitionCandidates) {
    const file = fileMap.get(definition.file);
    const definitionText = file ? readProjectText(project, file, textCache) : '';
    const refs = definitionValueRefs(definitionText, definition.keywordFacts);
    const terms = definitionRefSearchTerms(project, refs, textCache);
    if (!terms.length) continue;
    const links = [];
    for (const candidate of renderCandidates) {
      const renderFile = fileMap.get(candidate.file);
      const renderText = renderFile ? readProjectText(project, renderFile, textCache) : '';
      const matchedTerms = terms.filter(term => keywordIndexes(renderText, term).length);
      if (!matchedTerms.length) continue;
      links.push({
        type: 'key-reference',
        renderFile: candidate.file,
        terms: matchedTerms,
      });
    }
    if (links.length) {
      definition.definitionLinks = uniq([
        ...(definition.definitionLinks || []),
        ...links,
      ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
      definition.roleReasons = uniq([
        ...(definition.roleReasons || []),
        '定义值可通过 key/path 在渲染候选中找到使用关系',
      ]);
      continue;
    }

    for (const sourceFile of sourceFiles(project)) {
      if (byFile.has(sourceFile.path) || sourceFile.path === definition.file) continue;
      const text = readProjectText(project, sourceFile, textCache);
      if (!text) continue;
      const roleInfo = candidateSourceRole(sourceFile.path, text);
      if (roleInfo.referenceOnly || roleInfo.role !== 'render-like') continue;
      const linked = createDefinitionLinkedCandidate(project, sourceFile, text, terms, definition.file);
      if (!linked) continue;
      const keywordFacts = terms.map(term => ({
        keyword: term,
        type: '',
        count: keywordIndexes(text, term).length,
        codeCount: keywordIndexes(commentMask(text), term).length,
        commentOnly: false,
      })).filter(item => item.count > 0);
      const inspectedCandidate = {
        file: linked.file,
        score: linked.score + keywordFacts.length * 24,
        matchedGroups: linked.matchedGroups,
        keywordFacts,
        commentOnly: [],
        sourceRole: roleInfo.role,
        referenceOnly: roleInfo.referenceOnly,
        roleReasons: [
          ...roleInfo.reasons,
          '由定义文件命中的文案 key/path 反查到渲染源码',
        ],
        importRelation: null,
        definitionLinks: linked.definitionLinks,
        excerpt: candidateExcerpt(text, linked),
      };
      byFile.set(inspectedCandidate.file, inspectedCandidate);
      renderCandidates.push(inspectedCandidate);
      links.push({
        type: 'key-reference',
        renderFile: inspectedCandidate.file,
        terms,
      });
      if (links.length >= 4) break;
    }
    if (links.length) {
      definition.definitionLinks = uniq([
        ...(definition.definitionLinks || []),
        ...links,
      ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
      definition.roleReasons = uniq([
        ...(definition.roleReasons || []),
        '定义值可通过 key/path 反查到渲染源码',
      ]);
    }
  }

  return Array.from(byFile.values());
}

function inspectCandidates(project, candidates, plan, textCache, body = null) {
  const domClasses = originalDomClassTokens(body);
  let inspected = candidates.map(candidate => {
    const file = (project.files || []).find(item => item.path === candidate.file);
    const text = file ? readProjectText(project, file, textCache) : '';
    const masked = commentMask(text);
    const roleInfo = candidateSourceRole(candidate.file, text);
    const keywordFacts = uniq(plan.searches.flatMap(search => {
      return (search.keywords || []).map(keyword => ({
        keyword,
        type: keywordType(search, keyword),
        search,
      }));
    }).map(item => JSON.stringify({
      keyword: item.keyword,
      type: item.type || '',
    }))).map(value => JSON.parse(value)).map(item => {
      const search = (plan.searches || []).find(searchItem => {
        return (searchItem.keywords || []).includes(item.keyword)
          && keywordType(searchItem, item.keyword) === item.type;
      }) || { keywords: [item.keyword], keywordTypes: item.type ? { [item.keyword]: item.type } : {} };
      const allCount = keywordIndexesForSearch(text, item.keyword, search, candidate.file).length;
      const codeCount = keywordIndexesForSearch(masked, item.keyword, search, candidate.file).length;
      const structureMismatch = item.type
        ? null
        : directTextStructureMismatch(masked, item.keyword, plan);
      return {
        keyword: item.keyword,
        type: item.type || '',
        count: allCount,
        codeCount: structureMismatch ? 0 : codeCount,
        commentOnly: allCount > 0 && codeCount === 0,
        structureMismatch,
      };
    }).filter(item => item.count > 0);
    const codeMatches = keywordFacts.filter(item => item.codeCount > 0).length;
    const commentOnly = keywordFacts.filter(item => item.commentOnly).map(item => item.keyword);
    const structureMismatches = keywordFacts
      .filter(item => item.structureMismatch)
      .map(item => item.structureMismatch);
    const mismatchedKeywords = new Set(structureMismatches.map(item => item.keyword));
    const matchedGroups = (candidate.matchedGroups || []).map(group => ({
      ...group,
      keywords: (group.keywords || []).filter(keyword => !mismatchedKeywords.has(keyword)),
    })).filter(group => group.keywords.length);
    const rolePenalty = roleInfo.referenceOnly ? 80 : 0;
    const localScore = candidate.score
      + codeMatches * 24
      - commentOnly.length * 40
      - structureMismatches.length * 140
      - rolePenalty;
    return {
      file: candidate.file,
      score: localScore,
      matchedGroups,
      keywordFacts,
      commentOnly,
      structureMismatches,
      sourceRole: roleInfo.role,
      referenceOnly: roleInfo.referenceOnly,
      roleReasons: roleInfo.reasons,
      importRelation: candidate.importRelation || null,
      definitionLinks: candidate.definitionLinks || [],
      domCoverage: sourceDomClassCoverage(masked, candidate.file, domClasses),
      excerpt: candidateExcerpt(text, candidate),
    };
  }).filter(candidate => candidate.matchedGroups.length);
  inspected = pruneTextOnlyRenderCandidates(inspected, plan);
  inspected = pruneStrictDomCoverageSubsets(inspected);
  inspected = pruneDominatedDomCandidates(inspected, plan);
  inspected = enrichDefinitionCandidates(project, inspected, plan, textCache)
    .sort((a, b) => b.score - a.score);
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
    inspectedCount: candidates.length,
    candidates: inspected,
  };
}

function unresolvedDefinitionCandidates(inspection) {
  return (inspection?.candidates || []).filter(candidate => {
    return candidate.sourceRole === 'definition-like'
      && !(candidate.definitionLinks || []).length;
  });
}

function createDefinitionOwnerCandidate(project, owner, definition, textCache) {
  const fileMap = buildFileMap(project);
  const file = fileMap.get(owner.file);
  const text = file ? readProjectText(project, file, textCache) : '';
  const roleInfo = candidateSourceRole(owner.file, text);
  if (roleInfo.referenceOnly || roleInfo.role !== 'render-like') return null;
  const basename = path.posix.basename(definition.file).replace(/\.[^.]+$/, '');
  const position = Math.max(0, text.indexOf(basename));
  return {
    file: owner.file,
    score: 340 - Math.max(0, Number(owner.depth || 0)) * 20,
    matchedGroups: [{
      priority: 1,
      keywords: (definition.keywordFacts || []).map(item => item.keyword).filter(Boolean),
      range: 'import-relation',
      reason: `渲染源码通过 import 链引用定义文件：${definition.file}`,
      source: 'definition-import-owner',
    }],
    keywordFacts: [],
    commentOnly: [],
    sourceRole: roleInfo.role,
    referenceOnly: false,
    roleReasons: [
      ...roleInfo.reasons,
      '由定义文件的反向 import 链找到渲染源码',
    ],
    importRelation: null,
    definitionLinks: [{
      type: 'import-relation',
      definitionFile: definition.file,
      chain: owner.chain || [],
    }],
    excerpt: owner.excerpt || candidateExcerpt(text, { positions: [position] }),
  };
}

function enrichDefinitionOwners(project, inspection, ownership, textCache) {
  const candidateMap = new Map((inspection?.candidates || []).map(candidate => [candidate.file, candidate]));
  for (const definition of unresolvedDefinitionCandidates(inspection)) {
    const matchingOwners = (ownership || []).filter(owner => {
      return Array.isArray(owner.chain)
        && owner.chain[0] === definition.file
        && owner.file !== definition.file;
    });
    for (const owner of matchingOwners) {
      const renderCandidate = createDefinitionOwnerCandidate(project, owner, definition, textCache);
      if (!renderCandidate) continue;
      const old = candidateMap.get(renderCandidate.file);
      if (old) {
        old.definitionLinks = uniq([
          ...(old.definitionLinks || []),
          ...renderCandidate.definitionLinks,
        ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
        old.roleReasons = uniq([...(old.roleReasons || []), ...renderCandidate.roleReasons]);
      } else {
        candidateMap.set(renderCandidate.file, renderCandidate);
      }
      definition.definitionLinks = uniq([
        ...(definition.definitionLinks || []),
        {
          type: 'import-relation',
          renderFile: renderCandidate.file,
          chain: owner.chain || [],
        },
      ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
      definition.roleReasons = uniq([
        ...(definition.roleReasons || []),
        '反向 import 链已找到真实渲染引用者',
      ]);
    }
  }
  const candidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
  const first = candidates[0];
  const second = candidates[1];
  const unique = !!first && (!second || first.score - second.score >= 90);
  return {
    status: unique ? 'unique' : candidates.length ? 'ambiguous' : 'empty',
    selectedFile: unique ? first.file : '',
    candidates,
  };
}

function buildDefinitionResolverPrompt(body, inspection, ownership) {
  const unresolved = unresolvedDefinitionCandidates(inspection);
  const primary = (inspection?.candidates || []).filter(candidate => !candidate.referenceOnly);
  return [
    '你是 Magnus 的定义来源关系分析器。只分析已给出的真实源码片段之间是否存在“定义 -> 渲染使用”关系。',
    '你的目标不是修改代码，也不是直接按用户需求猜文件。',
    '优先判断 definitionFiles 中的值、key 或访问路径，是否在 renderCandidates 或 owners 中被消费并最终生成当前 DOM。',
    '如果现有片段已经能确认关系，返回 linked。',
    '如果只能从现有片段中提取可继续本地检索的原样关键词，返回 search。',
    '完全无法判断则返回 unresolved。',
    '禁止编造文件、变量、key、路径或检索词。searches 中每个关键词必须逐字存在于本次输入的源码片段中。',
    '最多返回 2 组 searches。',
    '严格返回 JSON，不输出 Markdown：',
    '{"status":"linked|search|unresolved","relations":[{"definitionFile":"","renderFile":"","confidence":0,"reason":""}],"searches":[{"keywords":[""],"mode":"all|any","range":"same-file|same-structure","reason":""}]}',
    `用户需求（只用于理解 DOM 焦点）: ${body.userPrompt || ''}`,
    `选区摘要: ${JSON.stringify(plannerDomInput(body).map(item => ({
      index: item.index,
      tag: item.tag,
      selector: item.selector,
      className: item.className,
      text: item.text,
    })), null, 2)}`,
    `definitionFiles:\n${JSON.stringify(unresolved.map(candidate => ({
      file: candidate.file,
      matchedKeywords: (candidate.keywordFacts || []).map(item => item.keyword),
      excerpt: candidate.excerpt,
    })), null, 2)}`,
    `renderCandidates:\n${JSON.stringify(primary.map(candidate => ({
      file: candidate.file,
      excerpt: candidate.excerpt,
    })), null, 2)}`,
    `owners:\n${JSON.stringify((ownership || []).map(owner => ({
      file: owner.file,
      chain: owner.chain,
      excerpt: owner.excerpt,
    })), null, 2)}`,
  ].join('\n');
}

function definitionResolverCorpus(inspection, ownership) {
  return [
    ...((inspection?.candidates || []).flatMap(candidate => [
      candidate.file,
      candidate.excerpt,
    ])),
    ...((ownership || []).flatMap(owner => [
      owner.file,
      owner.excerpt,
      ...(owner.chain || []),
    ])),
  ].filter(Boolean).join('\n').toLowerCase();
}

function keywordExistsInCorpus(keyword, corpus) {
  const value = String(keyword || '').trim().toLowerCase();
  return !!value && String(corpus || '').includes(value);
}

function normalizeDefinitionResolver(parsed, inspection, ownership) {
  const unresolvedFiles = new Set(unresolvedDefinitionCandidates(inspection).map(item => item.file));
  const renderFiles = new Set([
    ...((inspection?.candidates || []).filter(item => !item.referenceOnly).map(item => item.file)),
    ...((ownership || []).map(item => item.file)),
  ]);
  const relations = (Array.isArray(parsed?.relations) ? parsed.relations : [])
    .map(item => ({
      definitionFile: String(item?.definitionFile || '').replace(/^\/+/, ''),
      renderFile: String(item?.renderFile || '').replace(/^\/+/, ''),
      confidence: Math.max(0, Math.min(100, Number(item?.confidence || 0))),
      reason: String(item?.reason || ''),
    }))
    .filter(item => unresolvedFiles.has(item.definitionFile) && renderFiles.has(item.renderFile));
  const corpus = definitionResolverCorpus(inspection, ownership);
  const removed = [];
  const searches = normalizePlan({ searches: parsed?.searches }).searches
    .slice(0, MAX_DEFINITION_RESOLVER_SEARCHES)
    .map(search => ({
      ...search,
      keywords: (search.keywords || []).filter(keyword => {
        const exists = keywordExistsInCorpus(keyword, corpus);
        if (!exists) removed.push(keyword);
        return exists;
      }),
    }))
    .filter(search => search.keywords.length);
  return {
    status: relations.length
      ? 'linked'
      : searches.length
        ? 'search'
        : 'unresolved',
    relations,
    searches,
    removed: uniq(removed),
  };
}

function applyDefinitionResolverRelations(project, inspection, relations, ownership, textCache) {
  if (!(relations || []).length) return inspection;
  const candidateMap = new Map((inspection?.candidates || []).map(candidate => [candidate.file, candidate]));
  for (const relation of relations) {
    const definition = candidateMap.get(relation.definitionFile);
    if (!definition) continue;
    const owner = (ownership || []).find(item => item.file === relation.renderFile);
    if (!candidateMap.has(relation.renderFile) && owner) {
      const renderCandidate = createDefinitionOwnerCandidate(project, owner, definition, textCache);
      if (renderCandidate) candidateMap.set(renderCandidate.file, renderCandidate);
    }
    const render = candidateMap.get(relation.renderFile);
    if (!render || render.referenceOnly) continue;
    definition.definitionLinks = uniq([
      ...(definition.definitionLinks || []),
      {
        type: 'model-validated-relation',
        renderFile: relation.renderFile,
        confidence: relation.confidence,
        reason: relation.reason,
      },
    ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
    render.definitionLinks = uniq([
      ...(render.definitionLinks || []),
      {
        type: 'model-validated-relation',
        definitionFile: relation.definitionFile,
        confidence: relation.confidence,
        reason: relation.reason,
      },
    ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
  }
  const candidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
  return {
    status: candidates.length === 1 ? 'unique' : candidates.length ? 'ambiguous' : 'empty',
    selectedFile: candidates.length === 1 ? candidates[0].file : '',
    candidates,
  };
}

function hasPlannedGroupMatch(candidate) {
  return (candidate?.matchedGroups || []).some(group => {
    return group?.source === 'planned-group' && (group.keywords || []).length >= 2;
  });
}

function analyzeEvidenceSufficiency(plan, inspection, ownership = [], options = {}) {
  const candidates = inspection?.candidates || [];
  const plannedGroupCandidates = candidates.filter(hasPlannedGroupMatch);
  const importRelationCandidates = candidates.filter(candidate => candidate.importRelation);
  const primaryCandidates = candidates.filter(candidate => !candidate.referenceOnly);
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
  if (!primaryCandidates.length) {
    return {
      insufficient: true,
      reason: '当前只命中样式/定义参考文件，尚未找到生成 DOM 的渲染源码',
      candidateCount: candidates.length,
      primaryCandidateCount: 0,
      referenceCandidateCount: candidates.length,
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
  if (plannedGroupCandidates.length === 1) {
    return {
      insufficient: false,
      reason: 'DOM 验证后只有一个渲染候选完整命中同组锚点，其余局部命中仅作为参考',
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (primaryCandidates.length === 1 && candidates.length > 1) {
    return {
      insufficient: false,
      reason: 'DOM 验证后只剩一个可渲染源码候选，参考文件不参与主候选计数',
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (primaryCandidates.length > 1 && options.expansionRetry) {
    return {
      insufficient: false,
      reason: '自动扩区后仍有多个通过 DOM 验证的渲染候选，进入 Judge 裁决',
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (primaryCandidates.length > 1) {
    return {
      insufficient: true,
      reason: `DOM 验证后仍有 ${primaryCandidates.length} 个候选文件可生成该区域，需要扩区收敛`,
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
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
    inspectedCount: Number(inspection.inspectedCount || 0),
    retainedCount: (inspection.candidates || []).length,
    candidates: inspection.candidates.map(candidate => ({
      file: candidate.file,
      score: candidate.score,
      matchedGroups: candidate.matchedGroups,
      keywordFacts: candidate.keywordFacts,
      commentOnly: candidate.commentOnly,
      structureMismatches: candidate.structureMismatches || [],
      sourceRole: candidate.sourceRole || '',
      referenceOnly: !!candidate.referenceOnly,
      roleReasons: candidate.roleReasons || [],
      importRelation: candidate.importRelation || null,
      definitionLinks: candidate.definitionLinks || [],
      domCoverage: candidate.domCoverage || null,
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
    let ownerCount = 0;
    const queue = [{ file: selectedFile, depth: 0, chain: [selectedFile] }];
    const visited = new Set([selectedFile]);
    while (queue.length && ownerCount < MAX_OWNERS_PER_CANDIDATE) {
      const current = queue.shift();
      if (current.depth >= MAX_OWNER_DEPTH) continue;
      for (const parent of reverse.get(current.file) || []) {
        if (visited.has(parent)) continue;
        visited.add(parent);
        const parentFile = fileMap.get(parent);
        const text = parentFile ? readProjectText(project, parentFile, textCache) : '';
        const basename = path.posix.basename(current.file).replace(/\.[^.]+$/, '');
        const position = Math.max(0, text.indexOf(basename));
        const chain = [...current.chain, parent];
        result.push({
          candidateFile: selectedFile,
          file: parent,
          depth: current.depth + 1,
          chain,
          excerpt: makeSnippet(text, position, basename.length).slice(0, 3000),
        });
        ownerCount += 1;
        if (ownerCount >= MAX_OWNERS_PER_CANDIDATE) break;
        queue.push({ file: parent, depth: current.depth + 1, chain });
      }
    }
  }
  return result;
}

function traceRouteCandidateRelations(project, routeTrace, candidates, textCache) {
  const fileMap = buildFileMap(project);
  const candidateFiles = new Set((candidates || [])
    .filter(candidate => !candidate.referenceOnly)
    .map(candidate => candidate.file)
    .filter(file => fileMap.has(file)));
  if (!candidateFiles.size) return [];
  const routeFiles = uniq([
    routeTrace?.bestPageFile || '',
    routeTrace?.bestRoute?.sourceFile || '',
    ...((routeTrace?.hits || []).map(hit => hit?.file || '')),
    ...((routeTrace?.hits || []).map(hit => hit?.from || '')),
  ]).filter(file => fileMap.has(file));
  const relationByCandidate = new Map();
  for (const routeFile of routeFiles) {
    const queue = [{ file: routeFile, depth: 0, chain: [routeFile] }];
    const visited = new Set([routeFile]);
    while (queue.length) {
      const current = queue.shift();
      if (candidateFiles.has(current.file)) {
        const old = relationByCandidate.get(current.file);
        if (!old || current.depth < old.depth) {
          relationByCandidate.set(current.file, {
            candidateFile: current.file,
            routeFile,
            depth: current.depth,
            chain: current.chain,
          });
        }
      }
      if (current.depth >= MAX_ROUTE_RELATION_DEPTH) continue;
      if (current.depth > 0 && /(?:^|\/)(?:store|stores|api|apis|router|routers|init|util|utils|service|services|infrastructure)(?:\/|$)/i.test(current.file)) {
        continue;
      }
      for (const child of importedFiles(project, current.file, fileMap, textCache)) {
        if (visited.has(child.file)) continue;
        visited.add(child.file);
        queue.push({
          file: child.file,
          depth: current.depth + 1,
          chain: [...current.chain, child.file],
        });
      }
    }
  }
  return Array.from(relationByCandidate.values())
    .sort((a, b) => a.depth - b.depth || a.candidateFile.localeCompare(b.candidateFile));
}

function buildJudgePrompt(body, inspection, ownership, routeTrace, routeRelations) {
  return [
    '你是源码候选裁决器。候选已经由本地检索并读取局部结构。',
    '比较 DOM 事实与候选源码事实，选择最可能直接生成或控制该选区的文件。',
    '不要重新生成宽泛关键词，不要选择只有注释命中的文件。',
    '必须区分 definition、assembly、render。DOM 内容定义文件不能冒充最终渲染文件。',
    '一个文件可能只命中结构 class，另一个文件只命中文案/路径；这代表 render 与 definition 分离，需要结合用户需求决定返回一个或多个方向，不能只按命中词数量裁决。',
    '页面路由不是最终结论，但候选若能从当前精确路由入口通过真实 import 链到达，这是区分重复组件的重要证据。',
    '多个候选 DOM 结构相似时，必须比较候选路由关系；不得仅凭目录名称猜测哪个文件属于当前页面。',
    '你的目标仍然是定位当前 DOM 对应的源码方向，不是提前设计修改方案；用户需求只能帮助理解焦点，不能驱动你搜索接口名、数据源变量、样式写法等实现细节。',
    '如果候选中存在唯一 source=planned-group 且包含 2 个以上关键词的命中，通常代表 DOM 多锚点已在同一局部结构命中；除非它明显只是注释或无关定义，否则优先返回该候选。',
    '你只能裁决输入中的候选文件，不得生成新检索词；证据不足时返回 ambiguous。',
    '严格返回 JSON：',
    '{"status":"unique|ambiguous","files":[{"file":"","role":"render|definition|assembly","confidence":0,"reason":""}]}',
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
    `页面路由证据:\n${JSON.stringify({
      pagePath: body.pagePath || '',
      matched: !!routeTrace?.matched,
      bestPageFile: routeTrace?.bestPageFile || '',
      hits: (routeTrace?.hits || []).slice(0, 4).map(hit => ({
        file: hit.file,
        routePath: hit.routePath,
        reasons: hit.reasons || [],
      })),
    }, null, 2)}`,
    `候选路由关系:\n${JSON.stringify(routeRelations || [], null, 2)}`,
  ].join('\n');
}

function candidateKeywordSet(candidate) {
  return new Set((candidate?.keywordFacts || [])
    .filter(item => item.codeCount > 0 && !item.structureMismatch)
    .map(item => item.keyword));
}

function hasComparableDomEvidence(candidate, selectedCandidate) {
  if (!candidate || !selectedCandidate || candidate.referenceOnly) return false;
  const candidateKeywords = candidateKeywordSet(candidate);
  const selectedKeywords = candidateKeywordSet(selectedCandidate);
  if (!selectedKeywords.size) return false;
  return Array.from(selectedKeywords).every(keyword => candidateKeywords.has(keyword))
    && (candidate.structureMismatches || []).length <= (selectedCandidate.structureMismatches || []).length;
}

function validateJudgeRouteDecision(judge, inspection, routeRelations) {
  if (judge?.status !== 'unique' || judge.files.length !== 1 || !routeRelations?.length) {
    return { judge, rejected: false, reason: '' };
  }
  const selectedFile = judge.files[0].file;
  const relatedFiles = new Set(routeRelations.map(relation => relation.candidateFile));
  if (relatedFiles.has(selectedFile)) return { judge, rejected: false, reason: '' };
  const candidateByFile = new Map((inspection?.candidates || []).map(candidate => [candidate.file, candidate]));
  const selectedCandidate = candidateByFile.get(selectedFile);
  const alternatives = (inspection?.candidates || []).filter(candidate => {
    return relatedFiles.has(candidate.file) && hasComparableDomEvidence(candidate, selectedCandidate);
  });
  if (!alternatives.length) return { judge, rejected: false, reason: '' };
  return {
    judge: {
      ...judge,
      status: 'ambiguous',
      files: uniq([
        selectedFile,
        ...alternatives.map(candidate => candidate.file),
      ]).map(file => {
        const old = judge.files.find(item => item.file === file);
        return old || {
          file,
          role: 'render',
          confidence: 0,
          reason: '该候选具备同等 DOM 命中，并由当前页面路由入口的真实 import 链到达',
        };
      }),
    },
    rejected: true,
    reason: `Judge 选择了路由关系外候选 ${selectedFile}，但当前路由可达候选具备同等 DOM 证据：${alternatives.map(item => item.file).join('、')}`,
  };
}

function normalizedRoutePath(value) {
  const text = String(value || '').trim().split('?')[0].split('#')[0] || '/';
  return text.length > 1 ? text.replace(/\/+$/, '') : text;
}

function hasExactRouteEvidence(body, routeTrace) {
  if (!routeTrace?.matched || !routeTrace.bestPageFile) return false;
  const pagePath = normalizedRoutePath(body?.pagePath);
  return (routeTrace.hits || []).some(hit => {
    if (hit.file !== routeTrace.bestPageFile) return false;
    if (normalizedRoutePath(hit.routePath) === pagePath) return true;
    return (hit.reasons || []).some(reason => String(reason).includes('路径精确匹配'));
  });
}

function resolveByRouteRelation(body, inspection, routeTrace, routeRelations) {
  if (!hasExactRouteEvidence(body, routeTrace)) return null;
  const exactRelations = (routeRelations || []).filter(relation => {
    return relation.routeFile === routeTrace.bestPageFile
      || relation.routeFile === routeTrace?.bestRoute?.sourceFile;
  });
  const candidateByFile = new Map((inspection?.candidates || []).map(candidate => [candidate.file, candidate]));
  const relatedCandidates = uniq(exactRelations.map(relation => relation.candidateFile))
    .map(file => candidateByFile.get(file))
    .filter(candidate => {
      if (!candidate || candidate.referenceOnly) return false;
      const evidenceCount = candidateKeywordSet(candidate).size;
      const classCoverage = candidate.domCoverage?.matchedClassCount;
      const hasEnoughStructure = classCoverage == null
        ? evidenceCount > 0
        : classCoverage >= 2 || evidenceCount >= 2;
      return hasEnoughStructure && !(candidate.structureMismatches || []).length;
    });
  if (relatedCandidates.length !== 1) return null;
  const candidate = relatedCandidates[0];
  const relation = exactRelations.find(item => item.candidateFile === candidate.file);
  return {
    status: 'unique',
    files: [{
      file: candidate.file,
      role: 'render',
      confidence: 100,
      reason: `候选同时命中 DOM 结构，并由当前精确路由入口通过真实 import 链到达：${relation.chain.join(' -> ')}`,
    }],
    source: 'local-route-relation',
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
      : 'ambiguous',
    files,
  };
}

function agentHits(inspection, judge, ownership = []) {
  const candidateByFile = new Map((inspection.candidates || []).map(candidate => [candidate.file, candidate]));
  const hasPrimaryCandidate = (inspection.candidates || []).some(candidate => !candidate.referenceOnly);
  const selected = judge?.files?.length
    ? judge.files.filter(item => {
        const candidate = candidateByFile.get(item.file);
        return !(hasPrimaryCandidate && candidate?.referenceOnly);
      })
    : inspection.status === 'unique'
      ? [{ file: inspection.selectedFile, role: 'render', confidence: 90, reason: '本地候选事实形成唯一匹配' }]
      : [];
  const uniqueDecision = judge?.status === 'unique';
  const selectedMap = new Map(selected.map(item => [item.file, item]));
  const baseCandidates = selected.length
    ? inspection.candidates.filter(candidate => selectedMap.has(candidate.file))
    : inspection.candidates;
  const ranked = baseCandidates.map(candidate => {
    const decision = selectedMap.get(candidate.file);
    return {
      file: candidate.file,
      score: decision && uniqueDecision ? 1800 + candidate.score : candidate.score,
      stage: 'dom-agent',
      preciseEvidence: !!decision && uniqueDecision,
      sourceRole: decision?.role || '',
      modelConfidence: decision?.confidence || 0,
      snippet: candidate.excerpt,
      preciseSnippet: decision && uniqueDecision ? candidate.excerpt : '',
      reasons: [
        'DOM Agent：LLM 检索计划 → 本地候选事实对照',
        ...(candidate.matchedGroups || []).map(group => `同组命中：${group.keywords.join(' + ')}`),
        candidate.commentOnly.length ? `纯注释命中：${candidate.commentOnly.join('、')}` : '',
        (candidate.structureMismatches || []).length
          ? `DOM/源码静态节点不一致：${candidate.structureMismatches.map(item => {
              const tagDiff = `${item.domTags.join('|')} != ${item.sourceTags.join('|')}`;
              const classDiff = `${(item.domClasses || []).join('|') || '-'} != ${(item.sourceClasses || []).join('|') || '-'}`;
              return `${item.keyword}(tag: ${tagDiff}; class: ${classDiff})`;
            }).join('、')}`
          : '',
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
  plan = annotatePlanKeywordTypes(filteredPlan.plan, body);
  onLog(`DOM Agent 检索词定性：${JSON.stringify(planEvidenceKinds(plan), null, 2)}`);
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
  const candidates = Array.from(candidateMap.values()).sort(candidateSort);
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
  let inspection = inspectCandidates(project, candidates, inspectionPlan, textCache, body);
  onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);

  let routeRelations = traceRouteCandidateRelations(
    project,
    routeResult.trace,
    inspection.candidates,
    textCache
  );
  onLog(`本地调用：traceRouteCandidateRelations(project, route, ${JSON.stringify(inspection.candidates.filter(item => !item.referenceOnly).map(item => item.file))})`);
  onLog(`本地输出：${JSON.stringify(routeRelations, null, 2)}`);
  const localRouteDecision = resolveByRouteRelation(
    body,
    inspection,
    routeResult.trace,
    routeRelations
  );
  if (localRouteDecision) {
    const evidence = {
      insufficient: false,
      reason: '当前精确路由、真实 import 链与 DOM 结构共同形成唯一候选',
      candidateCount: inspection.candidates.length,
      routeRelationCount: routeRelations.length,
    };
    const hits = agentHits(inspection, localRouteDecision, []);
    onLog(`DOM Agent 本地关系裁决：${localRouteDecision.files[0].reason}`);
    onLog(`DOM Agent 最终输出：${JSON.stringify({
      status: localRouteDecision.status,
      files: hits.map(hit => ({
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
        definitionResolution: null,
        evidence,
        routeRelations,
        judge: localRouteDecision,
      },
    };
  }

  const initialOwnershipFiles = uniq([
    ...inspection.candidates.filter(item => !item.referenceOnly).map(item => item.file),
    ...unresolvedDefinitionCandidates(inspection).map(item => item.file),
  ]);
  let ownership = traceCandidateOwners(
    project,
    initialOwnershipFiles,
    textCache
  );
  onLog(`本地调用：traceCandidateOwners(project, ${JSON.stringify(initialOwnershipFiles)})`);
  onLog(`本地输出：${JSON.stringify(ownership, null, 2)}`);

  const unresolvedBeforeOwners = unresolvedDefinitionCandidates(inspection);
  if (unresolvedBeforeOwners.length) {
    inspection = enrichDefinitionOwners(project, inspection, ownership, textCache);
    onLog(`本地调用：enrichDefinitionOwners(project, ${JSON.stringify(unresolvedBeforeOwners.map(item => item.file))})`);
    onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);
  }

  let definitionResolution = null;
  const unresolvedDefinitions = unresolvedDefinitionCandidates(inspection);
  if (unresolvedDefinitions.length) {
    const resolverPrompt = buildDefinitionResolverPrompt(body, inspection, ownership);
    onLog(`DOM Agent 定义关系分析输入（${resolverPrompt.length} 字符）:\n${resolverPrompt}`);
    try {
      const resolverResult = await invokeModel(body.adapter, resolverPrompt, project.path, {
        signal,
        onLog,
        systemPrompt: '你是 Magnus 定义来源关系分析器。只根据提供的真实源码片段返回 JSON。',
      });
      onLog(`DOM Agent 定义关系分析输出（${resolverResult.rawText.length} 字符）:\n${resolverResult.rawText || '-'}`);
      definitionResolution = normalizeDefinitionResolver(
        parseJsonResult(resolverResult.rawText) || {},
        inspection,
        ownership
      );
      if (definitionResolution.removed.length) {
        onLog(`DOM Agent 定义关系检索词过滤：丢弃未在输入源码片段中出现的词 ${definitionResolution.removed.join('、')}`);
      }
      if (definitionResolution.relations.length) {
        inspection = applyDefinitionResolverRelations(
          project,
          inspection,
          definitionResolution.relations,
          ownership,
          textCache
        );
        onLog(`本地调用：applyDefinitionResolverRelations(${JSON.stringify(definitionResolution.relations)})`);
        onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);
      } else if (definitionResolution.searches.length) {
        const definitionPlan = {
          searches: definitionResolution.searches,
          needMoreDom: false,
        };
        onLog(`本地调用：executeSearchPlan(project, ${JSON.stringify(definitionPlan)})`);
        const definitionCandidates = executeSearchPlan(project, definitionPlan, textCache);
        onLog(`本地输出：${JSON.stringify({
          candidateCount: definitionCandidates.length,
          files: definitionCandidates.map(item => item.file),
        }, null, 2)}`);
        const mergedDefinitionCandidates = Array.from(new Map(
          [...candidates, ...definitionCandidates].map(item => [item.file, item])
        ).values());
        inspection = inspectCandidates(project, mergedDefinitionCandidates, {
          searches: [...inspectionPlan.searches, ...definitionPlan.searches],
        }, textCache, body);
        const definitionOwnershipFiles = uniq([
          ...inspection.candidates.filter(item => !item.referenceOnly).map(item => item.file),
          ...unresolvedDefinitionCandidates(inspection).map(item => item.file),
        ]);
        ownership = traceCandidateOwners(project, definitionOwnershipFiles, textCache);
        inspection = enrichDefinitionOwners(project, inspection, ownership, textCache);
        onLog(`本地调用：inspectCandidates(project, ${JSON.stringify(mergedDefinitionCandidates.map(item => item.file))})`);
        onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);
      }
    } catch (error) {
      definitionResolution = {
        status: 'unresolved',
        relations: [],
        searches: [],
        removed: [],
        error: error?.message || String(error),
      };
      onLog(`DOM Agent 定义关系分析失败：${definitionResolution.error}`);
    }
  }

  const evidence = analyzeEvidenceSufficiency(plan, inspection, ownership, {
    expansionRetry: body?.agentState?.expansionRetry === true,
  });
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
        definitionResolution,
        evidence,
        needMoreDom: true,
      },
    };
  }

  routeRelations = traceRouteCandidateRelations(
    project,
    routeResult.trace,
    inspection.candidates,
    textCache
  );
  let judgePrompt = buildJudgePrompt(
    body,
    inspection,
    ownership,
    routeResult.trace,
    routeRelations,
    false
  );
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
  let routeValidation = validateJudgeRouteDecision(judge, inspection, routeRelations);
  judge = routeValidation.judge;
  if (routeValidation.rejected) {
    onLog(`DOM Agent Judge 路由关系校验：拒绝唯一结论；${routeValidation.reason}`);
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
      definitionResolution,
      evidence,
      routeRelations,
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
  inspectCandidates,
  resolveByRouteRelation,
  runAgentSearch,
  traceCandidateOwners,
  traceRouteCandidateRelations,
  validateJudgeRouteDecision,
};
