const { uniq } = require('../../../utils');

const DEFAULT_DOM_AGENT_THRESHOLD = 2;
const MAX_DOM_INPUT_CHARS = 180000;
const MAX_EXCERPT_CHARS = 7000;
const MAX_COMPRESSED_DOM_CHARS = 30000;
const MAX_INHERITED_KEYWORDS = 4;
const MAX_DEFINITION_RESOLVER_SEARCHES = 2;
const MAX_OWNER_DEPTH = 3;
const MAX_OWNERS_PER_CANDIDATE = 4;
const MAX_ROUTE_RELATION_DEPTH = 7;
const MAX_KEYWORD_INDEXES = 120;
// 一个锚点命中的源文件数超过此阈值即视为「通用外壳/框架词」，只能缩范围、不能单独生成候选，
// 也不参与稀有共现加成（否则 dc-fieldset 这类命中 100+ 文件的词会淹没判别性锚点）。
const DF_SCOPE_LIMIT = 40;
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
  const markupLength = selectionList(body)
    .map(selectionMarkup)
    .reduce((max, value) => Math.max(max, value.length), 0);
  const chainFiles = resolvedComponentChainFiles(options.project, body);
  return {
    enabled: true,
    unified: true,
    markupLength,
    componentFiles: chainFiles,
    reason: '统一启用 DOM Agent；不再按选区长度或 ComponentChain 跳过',
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

function selectionContextMarkupValues(selection) {
  return selectionContextMarkupEntries(selection)
    .map(entry => entry.markup)
    .filter(Boolean);
}

function selectionContextMarkupEntries(selection) {
  const info = selection?.element || selection?.info || selection || {};
  return [
    { source: 'element', value: selection },
    ...(Array.isArray(info.ancestors)
      ? info.ancestors.map((ancestor, index) => ({ source: `element.ancestors[${index}]`, value: ancestor }))
      : []),
    { source: 'expanded', value: selection?.expanded },
    { source: 'expandedContext', value: selection?.expandedContext },
  ].filter(entry => entry.value).map(entry => ({
    source: entry.source,
    markup: selectionMarkup(entry.value),
  }));
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

function vueScopeAttrs(attrs) {
  return Object.keys(attrs || {}).filter(key => /^data-v-[\w-]+$/i.test(key)).sort();
}

function collectScopedDirectTextStructures(node, inheritedScopes = [], result = []) {
  if (!node || node.type !== 'element') return result;
  const ownScopes = vueScopeAttrs(node.attrs);
  const activeScopes = ownScopes.length ? ownScopes : inheritedScopes;
  const text = directText(node);
  if (text && node.tag !== 'root') {
    result.push({
      text,
      tag: String(node.tag || '').toLowerCase(),
      classes: classTokens(node.attrs),
      scopes: activeScopes,
      scope: activeScopes[activeScopes.length - 1] || '',
    });
  }
  for (const child of node.children || []) {
    if (child.type === 'element') collectScopedDirectTextStructures(child, activeScopes, result);
  }
  return result;
}

function domScopedTextStructures(body) {
  const structures = [];
  for (const selection of selectionList(body)) {
    for (const markup of selectionContextMarkupValues(selection)) {
      collectScopedDirectTextStructures(parseHtmlLite(markup), [], structures);
    }
  }
  return uniq(structures.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
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

function domContextDebugSummary(body, keywords = []) {
  const wanted = uniq((keywords || []).map(value => String(value || '').trim()).filter(Boolean));
  const contexts = [];
  const scopedStructures = [];
  for (const [selectionIndex, selection] of selectionList(body).entries()) {
    for (const entry of selectionContextMarkupEntries(selection)) {
      const markup = String(entry.markup || '');
      const tree = parseHtmlLite(markup);
      const root = (tree.children || []).find(child => child.type === 'element') || null;
      const structures = [];
      if (markup) collectScopedDirectTextStructures(tree, [], structures);
      const annotated = structures.map(item => ({
        ...item,
        selection: selectionIndex + 1,
        source: entry.source,
      }));
      scopedStructures.push(...annotated);
      contexts.push({
        selection: selectionIndex + 1,
        source: entry.source,
        markupLength: markup.length,
        rootTag: root?.tag || '',
        rootClasses: classTokens(root?.attrs || {}).slice(0, 8),
        dataV: uniq(Array.from(markup.matchAll(/\b(data-v-[\w-]+)/gi), match => match[1])).slice(0, 12),
        directTextSamples: uniq(structures
          .map(item => compactWhitespace(item.text))
          .filter(Boolean))
          .slice(0, 12),
      });
    }
  }
  const keywordSources = wanted.map(keyword => {
    const matches = scopedStructures
      .filter(item => String(item.text || '').includes(keyword))
      .map(item => ({
        selection: item.selection,
        source: item.source,
        text: compactWhitespace(item.text),
        tag: item.tag,
        classes: item.classes || [],
        dataV: item.scope || '',
      }));
    const selectedScopedMatch = matches.find(item => item.dataV) || null;
    return {
      keyword,
      matches: matches.slice(0, 12),
      selectedScopedMatch,
    };
  });
  return { contexts, keywordSources };
}

module.exports = {
  DEFAULT_DOM_AGENT_THRESHOLD,
  MAX_EXCERPT_CHARS,
  MAX_INHERITED_KEYWORDS,
  MAX_DEFINITION_RESOLVER_SEARCHES,
  MAX_OWNER_DEPTH,
  MAX_OWNERS_PER_CANDIDATE,
  MAX_ROUTE_RELATION_DEPTH,
  MAX_KEYWORD_INDEXES,
  DF_SCOPE_LIMIT,
  STYLE_EXTENSIONS,
  NATIVE_HTML_TAGS,
  parseJsonResult,
  selectionList,
  selectionMarkup,
  parseAttributes,
  parseHtmlLite,
  compactWhitespace,
  classTokens,
  compressDomMarkup,
  domAgentTrigger,
  plannerDomInput,
  selectionContextMarkupValues,
  selectionContextMarkupEntries,
  domContextDebugSummary,
  domClassTokenSet,
  domAttributePairs,
  domScopedTextStructures,
  domDirectTextStructures,
};
