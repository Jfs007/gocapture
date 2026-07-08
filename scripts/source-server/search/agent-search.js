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
  locatorTechnicalStackMarkdown,
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

// Stage0：把运行时组件链上的 __file 解析成「项目内相对路径」，保持自近及远的顺序。
// 命中即为确定性最强信号（Vue/React 运行时直接给出的渲染源码），可据此跳过全部 LLM。
function resolveChainToProjectFiles(project, body) {
  const projectFiles = new Set((project?.files || []).map(file => file.path));
  const result = [];
  for (const rawFile of componentChainFiles(body)) {
    const normalized = String(rawFile || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (projectFiles.has(normalized)) {
      result.push(normalized);
      continue;
    }
    const srcIndex = normalized.lastIndexOf('/src/');
    if (srcIndex !== -1 && projectFiles.has(normalized.slice(srcIndex + 1))) {
      result.push(normalized.slice(srcIndex + 1));
    }
  }
  return uniq(result);
}

// Stage0：仅凭运行时组件链构造确定性组合结果（render=最近业务组件，assembly=其上一层）。
function buildStage0Composite(chainProjectFiles) {
  const [render, assembly] = chainProjectFiles;
  return {
    render: { file: render, role: 'render', score: 4000, anchors: [], source: 'component-chain' },
    assembly: assembly
      ? { file: assembly, via: 'component-chain', chain: chainProjectFiles.slice(0, 2) }
      : null,
    children: [],
  };
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

function stableDomSearchText(value) {
  const text = compactWhitespace(value);
  if (!text || text.length < 2 || text.length > 24) return '';
  if (/^https?:\/\//i.test(text)) return '';
  if (/^\d+(?:[.,:/-]\d+)*$/.test(text)) return '';
  if (/^[¥$]\s*\d/.test(text)) return '';
  return text;
}

function isLikelyRuntimeClassToken(token) {
  const value = String(token || '').trim();
  if (!value || value.length < 3) return true;
  if (/^(?:n|el|ant|ivu|van|arco|semi|q)-/i.test(value)) return true;
  if (/^data-v-[a-f0-9]+$/i.test(value)) return true;
  return false;
}

function rootClassTokensFromSelections(body) {
  const tokens = [];
  for (const selection of selectionList(body)) {
    const info = selection?.element || selection?.info || selection || {};
    const rawMarkup = selectionMarkup(selection);
    const parsed = parseHtmlLite(rawMarkup);
    const root = (parsed.children || []).find(child => child.type === 'element') || null;
    const values = [
      String(info.className || ''),
      root?.attrs?.class || '',
    ];
    for (const value of values) {
      for (const token of String(value || '').split(/\s+/)) {
        const text = token.trim();
        if (text && !isLikelyRuntimeClassToken(text)) tokens.push(text);
      }
    }
  }
  return uniq(tokens).slice(0, 4);
}

function domFieldLabelTexts(body) {
  return uniq(domDirectTextStructures(body)
    .filter(item => {
      if (String(item.tag || '').toLowerCase() === 'label') return true;
      return (item.classes || []).some(className => /(?:^|[-_])label(?:$|[-_])|form-item-label/i.test(className));
    })
    .map(item => stableDomSearchText(item.text))
    .filter(Boolean));
}

function domSectionTitleTexts(body) {
  return uniq(domDirectTextStructures(body)
    .filter(item => {
      if (String(item.tag || '').toLowerCase() === 'legend') return true;
      return (item.classes || []).some(className => /(?:^|[-_])(?:title|legend|header)(?:$|[-_])/i.test(className));
    })
    .map(item => stableDomSearchText(item.text))
    .filter(Boolean));
}

function deriveLocalDomSearchPlan(body) {
  const searches = [];
  const prompt = compactWhitespace(body?.userPrompt || '');
  const labels = domFieldLabelTexts(body);
  const targetLabels = labels.filter(text => prompt.includes(text));
  if (labels.length >= 2) {
    const selected = uniq([
      ...(targetLabels.length ? targetLabels : labels.slice(0, 1)),
      ...labels,
    ]).slice(0, 4);
    if (selected.length >= 2) {
      searches.push({
        keywords: selected,
        mode: 'all',
        range: 'same-structure',
        priority: 1,
        reason: '本地派生：目标字段与同块兄弟字段共同定位内部渲染结构',
      });
    }
  }

  const rootClasses = rootClassTokensFromSelections(body);
  const sectionTitles = domSectionTitleTexts(body);
  if (rootClasses.length && sectionTitles.length) {
    searches.push({
      keywords: uniq([rootClasses[0], sectionTitles[0]]),
      mode: 'all',
      range: 'same-file',
      priority: 2,
      reason: '本地派生：根容器 class 与区域标题定位外层装配结构',
    });
  }

  return {
    searches,
    needMoreDom: false,
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
  while (indexes.length < MAX_KEYWORD_INDEXES) {
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
    // 绑定类表达式里以「带引号的字符串字面量」出现的类名：
    //   :class="{ 'dom-list': true }" / :class="['dom-list', x]" / :class="ok ? 'dom-list' : ''"
    //   className={clsx('dom-list', ...)} 等（Vue :class / v-bind:class / React clsx/classnames 通用）。
    new RegExp(`(?::|v-bind:)?class(?:Name)?\\s*=\\s*["'{\\[][\\s\\S]{0,300}?(?<![\\w-])["'\`]${escaped}["'\`](?![\\w-])`, 'gi'),
    new RegExp(`classnames?\\s*\\([\\s\\S]{0,300}?(?<![\\w-])["'\`]${escaped}["'\`](?![\\w-])`, 'gi'),
    new RegExp(`\\bclsx\\s*\\([\\s\\S]{0,300}?(?<![\\w-])["'\`]${escaped}["'\`](?![\\w-])`, 'gi'),
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

// 收集某文件内一个检索组各关键词的命中位置。返回 Map<keyword, indexes>，只含真正命中的词。
function collectGroupHits(text, search, filePath = '') {
  const hits = new Map();
  for (const keyword of search.keywords) {
    const indexes = keywordIndexesForSearch(text, keyword, search, filePath);
    if (indexes.length) hits.set(keyword, indexes);
  }
  return hits;
}

function searchLayer(search) {
  if (search?.layer === 'scope' || search?.scopeOnly) return 'scope';
  if (search?.layer === 'child' || search?.childAnchor) return 'child';
  return 'render';
}

function candidateSort(a, b) {
  const scoreDiff = b.score - a.score;
  if (scoreDiff) return scoreDiff;
  const styleDiff = Number(STYLE_EXTENSIONS.has(path.posix.extname(a.file)))
    - Number(STYLE_EXTENSIONS.has(path.posix.extname(b.file)));
  if (styleDiff) return styleDiff;
  return a.file.localeCompare(b.file);
}

function bestKeywordWindow(hits, keywordOrder, maxSpread = 16000) {
  const allowed = new Set(keywordOrder || []);
  const events = [];
  for (const [keyword, indexes] of hits.entries()) {
    if (!allowed.has(keyword)) continue;
    for (const index of indexes) events.push({ keyword, index });
  }
  events.sort((a, b) => a.index - b.index);
  let best = null;
  for (let left = 0; left < events.length; left += 1) {
    const counts = new Map();
    for (let right = left; right < events.length; right += 1) {
      const event = events[right];
      if (event.index - events[left].index > maxSpread) break;
      counts.set(event.keyword, (counts.get(event.keyword) || 0) + 1);
      const keywords = keywordOrder.filter(keyword => counts.has(keyword));
      const spread = event.index - events[left].index;
      if (
        !best
        || keywords.length > best.keywords.length
        || (keywords.length === best.keywords.length && spread < best.spread)
      ) {
        const windowEvents = events.slice(left, right + 1);
        best = {
          keywords,
          positions: keywords.map(keyword => {
            return windowEvents.find(item => item.keyword === keyword)?.index;
          }).filter(Number.isFinite),
          spread,
        };
      }
    }
  }
  return best || { keywords: [], positions: [], spread: 0 };
}

// 稀有度加权 + 共现收敛的候选检索。
// 关键改动（相对旧实现）：
//  1. 先做一遍全库文档频率(df)统计，得到每个锚点的稀有度(idf)。
//  2. 通用外壳/框架词(df>DF_SCOPE_LIMIT)不再单独生成候选，只作为已有候选的缩范围加成——
//     彻底消除「一个不可满足的 AND 组退化成成百上千个单词候选」的洪水。
//  3. 判别性锚点(稀有词)在同一文件共现越多，得分越高(共现平方加成)，让真正渲染该区域的文件胜出。
function executeSearchPlan(project, plan, textCache) {
  const files = sourceFiles(project);
  const totalFiles = files.length || 1;

  // Pass 1：收集每个文件的命中并统计文档频率。
  const df = new Map();
  const perFile = [];
  for (const file of files) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const groups = [];
    const seen = new Set();
    for (const search of plan.searches) {
      const hits = collectGroupHits(text, search, file.path);
      if (!hits.size) continue;
      groups.push({ search, hits });
      for (const keyword of hits.keys()) {
        if (seen.has(keyword)) continue;
        seen.add(keyword);
        df.set(keyword, (df.get(keyword) || 0) + 1);
      }
    }
    if (groups.length) perFile.push({ file: file.path, groups });
  }

  const idf = keyword => Math.log((totalFiles + 1) / ((df.get(keyword) || 0) + 1)) + 1;
  const isRare = keyword => (df.get(keyword) || 0) <= DF_SCOPE_LIMIT;

  // 严格共现组(same-structure all，即 render 组)的两阶段准入：
  //  1) 优先取「完整 AND 命中」的文件；
  //  2) 若全库都没有完整命中，则取「所有共现≥2 个稀有锚点」的文件——
  //     不再只取「命中最多的那一个」。因为数据驱动场景里，配置/路由文件常常命中最多的文案/路径锚点，
  //     若只保留最大子集会把「只命中业务 class（如 main-layout-left-menu）」的真实渲染组件挤掉。
  //     这里把它们都保留为候选，再由角色判定(definition-like 参考文件不算渲染)与 Judge 收敛。
  const strictAdmission = new Map();
  for (const search of plan.searches) {
    if (!(search.mode === 'all' && search.range === 'same-structure')) continue;
    const matched = [];
    for (const { file, groups } of perFile) {
      const group = groups.find(item => item.search === search);
      if (!group) continue;
      const window = bestKeywordWindow(group.hits, search.keywords);
      const rareWindow = bestKeywordWindow(
        group.hits,
        search.keywords.filter(isRare)
      );
      matched.push({
        file,
        keywords: window.keywords,
        rareKeywords: rareWindow.keywords,
        positions: window.positions,
        rarePositions: rareWindow.positions,
      });
    }
    const full = matched.filter(item => item.keywords.length === search.keywords.length);
    const admitted = full.length
      ? full
      : matched
        .filter(item => item.rareKeywords.length >= 2)
        .map(item => ({
          ...item,
          keywords: item.rareKeywords,
          positions: item.rarePositions,
        }));
    strictAdmission.set(search, new Map(admitted.map(item => [item.file, item])));
  }

  // Pass 2：打分。先处理 render/child 组建立候选，再用 scope 组给已有候选加成。
  const candidateMap = new Map();
  for (const { file, groups } of perFile) {
    const rareRenderAnchors = new Set();

    for (const { search, hits } of groups) {
      const layer = searchLayer(search);
      if (layer === 'scope') continue;
      const isStrict = search.mode === 'all' && search.range === 'same-structure';

      // ——严格共现组：只有通过两阶段准入的文件才生成 planned-group，绝不做单点回退。
      if (isStrict) {
        const admitted = strictAdmission.get(search)?.get(file);
        if (!admitted) continue;
        const keywords = admitted.keywords;
        const rareKeywords = keywords.filter(isRare);
        upsertCandidate(candidateMap, file, {
          score: Math.round(
            Math.max(40, 220 - (search.priority - 1) * 30)
            + keywords.reduce((sum, keyword) => sum + idf(keyword), 0) * 12
            + rareKeywords.length * rareKeywords.length * 20
            + (layer === 'child' ? -60 : 0)
          ),
          matchedGroup: {
            priority: search.priority,
            keywords,
            range: search.range,
            reason: search.reason,
            source: 'planned-group',
            layer,
          },
          keywords,
          positions: admitted.positions.slice(0, 6),
        });
        if (layer === 'child') markChildCandidate(candidateMap, file);
        if (layer === 'render') for (const keyword of rareKeywords) rareRenderAnchors.add(keyword);
        continue;
      }

      // ——非严格组(any / all-same-file)：完整命中记 planned-group；AND 部分命中时对稀有锚点做单点回退。
      const keywords = [...hits.keys()];
      const positions = keywords.flatMap(keyword => hits.get(keyword).slice(0, 2));
      const allMatched = keywords.length === search.keywords.length;
      const accepted = search.mode === 'any' ? true : allMatched;
      const rareKeywords = keywords.filter(isRare);

      if (accepted && keywords.length) {
        upsertCandidate(candidateMap, file, {
          score: Math.round(
            Math.max(40, 220 - (search.priority - 1) * 30)
            + keywords.reduce((sum, keyword) => sum + idf(keyword), 0) * 12
            + rareKeywords.length * rareKeywords.length * 20
            + (layer === 'child' ? -60 : 0)
          ),
          matchedGroup: {
            priority: search.priority,
            keywords,
            range: search.range,
            reason: search.reason,
            source: 'planned-group',
            layer,
          },
          keywords,
          positions: positions.slice(0, 6),
        });
        if (layer === 'child') markChildCandidate(candidateMap, file);
      }

      if (!accepted) {
        for (const keyword of rareKeywords) {
          upsertCandidate(candidateMap, file, {
            score: Math.round(Math.max(10, 60 - (search.priority - 1) * 8) + idf(keyword) * 10),
            matchedGroup: {
              priority: search.priority,
              keywords: [keyword],
              range: 'same-file',
              reason: `单点稀有证据：${search.reason || keyword}`,
              source: 'keyword-fallback',
              layer,
            },
            keywords: [keyword],
            positions: hits.get(keyword).slice(0, 3),
          });
          if (layer === 'child') markChildCandidate(candidateMap, file);
        }
      }

      if (layer === 'render') for (const keyword of rareKeywords) rareRenderAnchors.add(keyword);
    }

    // ——scope 组：
    //  · 稀有(判别性)范围锚点(df≤DF_SCOPE_LIMIT，如业务 class x-menu)可以独立生成一个弱候选——
    //    它往往正是「渲染该 DOM 的组件」的身份标识；不能因为 LLM 把它放进了 scope 层就永远搜不到它所在的文件。
    //  · 通用外壳词(df>DF_SCOPE_LIMIT，如 dc-fieldset)仍然只做缩范围加成、不造候选，避免噪音。
    //  · 对已是候选的文件，所有 scope 锚点都追加一点加成。
    for (const { search, hits } of groups) {
      if (searchLayer(search) !== 'scope') continue;
      const keywords = [...hits.keys()];
      for (const keyword of keywords) {
        if (!isRare(keyword)) continue;
        upsertCandidate(candidateMap, file, {
          score: Math.round(Math.max(8, 36 - (search.priority - 1) * 4) + idf(keyword) * 8),
          matchedGroup: {
            priority: search.priority,
            keywords: [keyword],
            range: 'same-file',
            reason: `范围锚点(稀有，可能是渲染组件身份)：${keyword}`,
            source: 'scope-anchor',
            layer: 'scope',
          },
          keywords: [keyword],
          positions: hits.get(keyword).slice(0, 3),
        });
      }
      if (candidateMap.has(file)) {
        const candidate = candidateMap.get(file);
        candidate.score += Math.round(keywords.reduce((sum, keyword) => sum + idf(keyword), 0) * 4);
        candidate.scopeAnchors = uniq([...(candidate.scopeAnchors || []), ...keywords]);
      }
    }

    // ——稀有锚点共现加成：真正渲染该区域的文件会同时聚集多个判别性锚点。
    if (rareRenderAnchors.size >= 2 && candidateMap.has(file)) {
      const anchors = [...rareRenderAnchors];
      const candidate = candidateMap.get(file);
      candidate.score += Math.round(
        anchors.length * anchors.length * 18
        + anchors.reduce((sum, keyword) => sum + idf(keyword), 0) * 8
      );
      candidate.rareAnchorCount = anchors.length;
      candidate.rareAnchors = anchors;
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

function markChildCandidate(candidateMap, file) {
  const candidate = candidateMap.get(file);
  if (candidate) candidate.childComponentCandidate = true;
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
  // .vue 单文件组件本质上就是渲染 DOM 的组件（无论用 <template> 还是 setup/render），
  // 一律视为渲染源码，避免因为脚本里有 export default {}/常量定义等信号被误判成 definition-like 参考文件。
  if (ext === '.vue') {
    return {
      role: 'render-like',
      referenceOnly: false,
      reasons: ['.vue 单文件组件是 DOM 渲染源码'],
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
  const attrPattern = new RegExp(`\\b(label|title|placeholder|aria-label)\\s*=\\s*["']${escaped}["']`, 'gi');
  while ((match = attrPattern.exec(source)) && structures.length < 16) {
    const attrName = String(match[1] || '').toLowerCase();
    structures.push({
      tag: attrName === 'label' ? 'label' : '',
      classes: [],
      dynamicClass: false,
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

function domTextAnchors(body) {
  const anchors = domDirectTextStructures(body)
    .map(item => ({
      text: compactWhitespace(item.text),
      tag: item.tag,
      classes: item.classes || [],
    }))
    .filter(item => {
      const text = item.text;
      if (!text || text.length < 2 || text.length > 24) return false;
      if (/^https?:\/\//i.test(text)) return false;
      if (/^\d+(?:[.,:/-]\d+)*$/.test(text)) return false;
      if (/^[¥$]\s*\d/.test(text)) return false;
      return true;
    });
  return uniq(anchors.map(item => JSON.stringify(item))).map(item => JSON.parse(item)).slice(0, 24);
}

function sourceTextAnchorIndexes(text, anchor) {
  const source = String(text || '');
  const keyword = String(anchor?.text || '').trim();
  if (!source || !keyword) return [];
  const escaped = escapeRegExp(keyword);
  const patterns = [
    new RegExp(`>[^<]{0,120}${escaped}[^<]{0,120}<`, 'g'),
    new RegExp(`\\b(?:label|title|placeholder|aria-label)\\s*=\\s*["']${escaped}["']`, 'g'),
    new RegExp(`\\b(?:label|title|text|name)\\s*:\\s*["'\`]${escaped}["'\`]`, 'g'),
  ];
  const indexes = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) && indexes.length < 20) indexes.push(match.index);
  }
  if (!indexes.length) {
    indexes.push(...textEvidenceIndexes(source, keyword));
  }
  return uniq(indexes).sort((a, b) => a - b);
}

function sourceDomTextCoverage(text, domAnchors) {
  const matchedTexts = [];
  for (const anchor of domAnchors || []) {
    if (sourceTextAnchorIndexes(text, anchor).length) matchedTexts.push(anchor.text);
  }
  return {
    matchedTexts: uniq(matchedTexts),
    matchedTextCount: uniq(matchedTexts).length,
    totalTextCount: domAnchors?.length || 0,
  };
}

function plannedGroupTargetBonus(matchedGroups, body) {
  const prompt = compactWhitespace(body?.userPrompt || '');
  if (!prompt) return 0;
  let bonus = 0;
  for (const group of matchedGroups || []) {
    if (group?.source !== 'planned-group') continue;
    const keywords = group.keywords || [];
    if (keywords.length < 2) continue;
    bonus += keywords.length * 30;
    if (keywords.some(keyword => prompt.includes(String(keyword || '').trim()))) {
      bonus += 180;
    }
  }
  return bonus;
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
    if (hasPlannedGroupMatch(candidate)) return true;
    const own = new Set(candidate.domCoverage?.matchedClasses || []);
    if (!own.size) return true;
    const ownTextCount = candidate.domTextCoverage?.matchedTextCount || 0;
    return !renderCandidates.some(other => {
      if (other === candidate) return false;
      const otherClasses = new Set(other.domCoverage?.matchedClasses || []);
      if (otherClasses.size < 2 || otherClasses.size <= own.size) return false;
      const otherTextCount = other.domTextCoverage?.matchedTextCount || 0;
      if (ownTextCount > otherTextCount) return false;
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
    if (hasPlannedGroupMatch(candidate)) return true;
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

function candidateSearchKeywords(candidate, search, includeCommentOnly = false) {
  const facts = candidate?.keywordFacts || [];
  return uniq((search?.keywords || []).filter(keyword => {
    const expectedType = keywordType(search, keyword);
    return facts.some(item => {
      if (item.keyword !== keyword || item.type !== expectedType || item.structureMismatch) return false;
      return includeCommentOnly ? item.count > 0 : item.codeCount > 0;
    });
  }));
}

function pruneDominatedDomCandidates(inspected, plan) {
  const searches = (plan?.searches || []).filter(search => {
    return uniq(search.keywords || []).length >= 2;
  });
  const dominantGroups = searches.flatMap(search => {
    const required = uniq(search.keywords || []);
    const complete = inspected.filter(candidate => {
      if (candidate.referenceOnly || candidate.sourceRole !== 'render-like') return false;
      return candidateSearchKeywords(candidate, search).length === required.length;
    });
    return complete.length === 1 ? [{
      search,
      required,
      winner: complete[0],
      matches: (candidate, includeCommentOnly = false) => {
        return candidateSearchKeywords(candidate, search, includeCommentOnly);
      },
    }] : [];
  });

  const plannedKeywords = uniq((plan?.searches || [])
    .flatMap(search => search.keywords || [])
    .map(keyword => String(keyword || '').trim())
    .filter(Boolean));
  if (plannedKeywords.length >= 2) {
    const completeAcrossGroups = inspected.filter(candidate => {
      if (candidate.referenceOnly || candidate.sourceRole !== 'render-like') return false;
      const evidence = candidateEffectiveKeywordSet(candidate);
      return plannedKeywords.every(keyword => evidence.has(keyword));
    });
    if (completeAcrossGroups.length === 1 && !dominantGroups.some(group => {
      return group.winner === completeAcrossGroups[0]
        && group.required.length === plannedKeywords.length;
    })) {
      dominantGroups.push({
        search: null,
        required: plannedKeywords,
        winner: completeAcrossGroups[0],
        matches: (candidate, includeCommentOnly = false) => {
          const facts = candidate?.keywordFacts || [];
          return plannedKeywords.filter(keyword => facts.some(item => {
            if (item.keyword !== keyword || item.structureMismatch) return false;
            return includeCommentOnly ? item.count > 0 : item.codeCount > 0;
          }));
        },
      });
    }
  }
  if (!dominantGroups.length) return inspected;

  for (const group of dominantGroups) {
    group.winner.roleReasons = uniq([
      ...(group.winner.roleReasons || []),
      `唯一完整覆盖检索组（${group.required.join(' + ')}），局部命中候选按组淘汰`,
    ]);
  }

  return inspected.filter(candidate => {
    if (dominantGroups.some(group => candidate === group.winner)) return true;
    if (candidate.importRelation || (candidate.definitionLinks || []).length) return true;
    if (candidate.referenceOnly) {
      if (candidate.sourceRole === 'style-reference') return true;
      return candidateHasExactQuotedKeyword(candidate);
    }

    const completesAnotherGroup = searches.some(search => {
      const required = uniq(search.keywords || []);
      return candidateSearchKeywords(candidate, search).length === required.length;
    });
    if (completesAnotherGroup) return true;

    return !dominantGroups.some(group => {
      const effectiveMatches = group.matches(candidate);
      if (effectiveMatches.length > 0 && effectiveMatches.length < group.required.length) return true;
      const rawMatches = group.matches(candidate, true);
      return rawMatches.length > 0 && effectiveMatches.length === 0;
    });
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
  const textAnchors = domTextAnchors(body);
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
    const domTextCoverage = sourceDomTextCoverage(masked, textAnchors);
    const localScore = candidate.score
      + codeMatches * 24
      + domTextCoverage.matchedTextCount * 50
      + plannedGroupTargetBonus(matchedGroups, body)
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
      domTextCoverage,
      childComponentCandidate: !!candidate.childComponentCandidate,
      rareAnchorCount: Number(candidate.rareAnchorCount || 0),
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
      confidence: normalizeConfidence(item?.confidence),
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

// 是否算「主渲染候选」。渲染角色由 candidateSourceRole 在源头判定（见其中对 .vue / 路由配置的处理），
// 这里不再按扩展名去「提升」参考文件——否则像路由配置 workbench.ts 这类命中了菜单文案/路径、
// 但根本不渲染 DOM 的 .ts 文件会被错当成渲染源码返回。referenceOnly 一律不算主渲染，子组件候选也不算。
function isRenderCandidate(candidate) {
  return !!candidate && !candidate.referenceOnly && !candidate.childComponentCandidate;
}

// 判断本地是否已存在明显占优的渲染候选（可据此本地收敛、跳过 Judge）。
// 只有当榜首候选具备「真实 DOM 共现证据」——一个 ≥2 关键词的 planned-group，或 ≥2 个稀有锚点共现——
// 时才允许本地收敛；对靠 import/定义反查合成出来的单锚点候选，仍交给 Judge 做兜底校验。
function dominantRenderCandidate(inspection) {
  const primary = (inspection?.candidates || [])
    .filter(isRenderCandidate)
    .sort((a, b) => b.score - a.score);
  const first = primary[0];
  const second = primary[1];
  if (!first) return null;
  const strongEvidence = hasPlannedGroupMatch(first) || Number(first.rareAnchorCount || 0) >= 2;
  if (!strongEvidence) return null;
  const dominates = !second
    || first.score - second.score >= 120
    || (hasPlannedGroupMatch(first) && !hasPlannedGroupMatch(second));
  return dominates ? first : null;
}

// 收集与某文件在 import 图上「N 跳内相关」的所有文件（向下：它 import 的；向上：import 它的）。
function filesRelatedByImport(project, file, textCache, maxHops = 2) {
  const fileMap = buildFileMap(project);
  const related = new Set([file]);
  let frontier = [file];
  for (let hop = 0; hop < maxHops; hop += 1) {
    const next = [];
    for (const current of frontier) {
      for (const child of importedFiles(project, current, fileMap, textCache)) {
        if (!related.has(child.file)) { related.add(child.file); next.push(child.file); }
      }
    }
    frontier = next;
  }
  const reverse = new Map();
  for (const source of fileMap.keys()) {
    for (const child of importedFiles(project, source, fileMap, textCache)) {
      const parents = reverse.get(child.file) || [];
      parents.push(source);
      reverse.set(child.file, parents);
    }
  }
  frontier = [file];
  for (let hop = 0; hop < maxHops; hop += 1) {
    const next = [];
    for (const current of frontier) {
      for (const parent of reverse.get(current) || []) {
        if (!related.has(parent)) { related.add(parent); next.push(parent); }
      }
    }
    frontier = next;
  }
  return related;
}

// 原始选区关系校验：一个收敛出来的渲染文件，必须与「用户最初选中的区域(origin 锚点)」有真实关系——
// 要么自身包含 origin 锚点，要么通过 import 引用链(N 跳内)关联到包含它的文件。
// 否则说明它只是命中了「扩区后的大区域」里别的东西，跟用户真正选的那块毫无渲染/引用关系，即找错了。
function validateOriginRelation(project, renderFile, originAnchors, textCache) {
  const anchors = uniq((originAnchors || []).map(value => String(value || '').trim()).filter(value => value.length >= 2));
  if (!anchors.length) return { valid: true, reason: 'no-origin-anchors' };
  const containsAnchor = filePath => {
    const fileObj = (project.files || []).find(item => item.path === filePath);
    if (!fileObj) return false;
    const text = readProjectText(project, fileObj, textCache);
    return anchors.some(anchor => keywordIndexes(text, anchor).length > 0);
  };
  if (containsAnchor(renderFile)) return { valid: true, reason: 'direct' };
  for (const related of filesRelatedByImport(project, renderFile, textCache, 2)) {
    if (related !== renderFile && containsAnchor(related)) {
      return { valid: true, reason: `reference:${related}` };
    }
  }
  return { valid: false, reason: '与原始选区锚点既无直接包含、也无 import 引用关系' };
}

function analyzeEvidenceSufficiency(plan, inspection, ownership = [], options = {}) {
  const candidates = inspection?.candidates || [];
  const plannedGroupCandidates = candidates.filter(hasPlannedGroupMatch);
  const importRelationCandidates = candidates.filter(candidate => candidate.importRelation);
  // 子组件候选不参与「主渲染候选」竞争；planned-group 命中的候选即便被标 referenceOnly 也算主渲染。
  const primaryCandidates = candidates.filter(isRenderCandidate);
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
  if (primaryCandidates.length > 1 && dominantRenderCandidate(inspection)) {
    return {
      insufficient: false,
      reason: '存在稀有锚点共现明显占优的渲染候选，本地直接收敛',
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      dominant: true,
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
      childComponentCandidate: !!candidate.childComponentCandidate,
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
      const textCoverage = candidate.domTextCoverage?.matchedTextCount || 0;
      const totalTextCoverage = candidate.domTextCoverage?.totalTextCount || 0;
      const hasEnoughStructure = classCoverage == null
        ? evidenceCount > 0
        : classCoverage >= 2 || evidenceCount >= 2 || textCoverage >= 2;
      const hasEnoughLocalTextContext = totalTextCoverage >= 3
        ? textCoverage >= 2
        : true;
      return hasEnoughStructure
        && hasEnoughLocalTextContext
        && !(candidate.structureMismatches || []).length;
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

// 归一化置信度：模型有时返回 0~1 小数（如 0.95），有时返回 0~100。统一到 0~100。
function normalizeConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const scaled = num > 0 && num <= 1 ? num * 100 : num;
  return Math.max(0, Math.min(100, scaled));
}

// 组装结构化组合结果：一段 DOM 通常由 assembly(装配) + render(主渲染) + children(子组件) 协作渲染。
function buildComposite(inspection, ownership, selectedFile) {
  const candidates = inspection?.candidates || [];
  const renderFile = selectedFile
    || (dominantRenderCandidate(inspection) || {}).file
    || (candidates.find(isRenderCandidate) || {}).file
    || '';
  if (!renderFile) return null;
  const renderCandidate = candidates.find(item => item.file === renderFile) || null;
  const owners = (ownership || [])
    .filter(owner => owner.candidateFile === renderFile)
    .sort((a, b) => Number(a.depth || 0) - Number(b.depth || 0));
  const assembly = owners.length
    ? { file: owners[0].file, via: 'import', chain: owners[0].chain || [] }
    : null;
  const children = candidates
    .filter(item => item.childComponentCandidate && item.file !== renderFile)
    .map(item => ({
      file: item.file,
      anchor: (item.matchedGroups || []).flatMap(group => group.keywords || [])[0] || '',
    }));
  // 同级并列渲染：一段 DOM 由多个平级组件各渲染一部分时，除主 render 外，
  // 把「同样具备真实共现证据、且与主 render 不是父子关系、分数可比」的其它渲染候选也并列出来。
  const renderScore = renderCandidate ? renderCandidate.score : 0;
  const assemblyFile = assembly ? assembly.file : '';
  const childFiles = new Set(children.map(child => child.file));
  const coRenders = candidates
    .filter(item => isRenderCandidate(item)
      && item.file !== renderFile
      && item.file !== assemblyFile
      && !childFiles.has(item.file)
      && hasPlannedGroupMatch(item)
      && item.score >= renderScore * 0.5)
    .map(item => ({
      file: item.file,
      role: 'render',
      score: item.score,
      anchors: uniq((item.matchedGroups || []).flatMap(group => group.keywords || [])).slice(0, 8),
    }));
  return {
    render: {
      file: renderFile,
      role: 'render',
      score: renderScore,
      anchors: uniq((renderCandidate?.matchedGroups || []).flatMap(group => group.keywords || [])).slice(0, 8),
    },
    assembly,
    children,
    ...(coRenders.length ? { coRenders } : {}),
  };
}

// 字符偏移 → 1 基 line:column。
function offsetToLineColumn(text, offset) {
  const clamped = Math.max(0, Math.min(String(text).length, Number(offset) || 0));
  const before = String(text).slice(0, clamped);
  const line = before.split('\n').length;
  const column = clamped - before.lastIndexOf('\n');
  return { line, column };
}

// 收集计划里各关键词在文件中的所有命中偏移（按各自的匹配器：class/attr/style/text/literal）。
function collectPlanKeywordOffsets(text, searches, filePath) {
  const map = new Map();
  for (const search of searches || []) {
    for (const keyword of search.keywords || []) {
      const offsets = keywordIndexesForSearch(text, keyword, search, filePath);
      if (offsets.length) map.set(keyword, uniq([...(map.get(keyword) || []), ...offsets]));
    }
  }
  return map;
}

// 原始选区的稳定锚点：扩区时前端全程保持不变地带回来（即使中间某轮 Planner 返回 need-more、计划为空，
// 也不会丢），保证「细定位」永远能回到用户最初选的那一处，而不是退化成扩区大区域的质心。
function focusAnchorsFromState(agentState) {
  const raw = Array.isArray(agentState?.focusAnchors) ? agentState.focusAnchors : [];
  return uniq(raw.map(value => String(value || '').trim()).filter(value => value.length >= 2))
    .slice(0, MAX_INHERITED_KEYWORDS);
}

// 收敛后「细定位」：文件已确定，回到「原始选区最具体的锚点」在该文件里的精确位置。
//  · 聚焦优先级：显式 focusAnchors（前端全程保持的原始选区锚点）> 上一轮继承锚点 > render 层锚点。
//  · 一个锚点在文件里可能出现多次，取「离其它命中锚点簇最近」的那一次——即真正落在目标渲染结构里的那处。
//  · 返回精确 offset + line:column + 该处代码片段，供编辑器直接跳转。
function computeFineLocation(project, file, plan, agentState, textCache) {
  const fileObj = (project.files || []).find(item => item.path === file);
  if (!fileObj) return null;
  const text = readProjectText(project, fileObj, textCache);
  if (!text) return null;

  const focusFromState = focusAnchorsFromState(agentState);
  const inherited = inheritedSearchKeywords(agentState);
  const extraFocus = uniq([...focusFromState, ...inherited]);
  const searchesForOffsets = [...(plan?.searches || [])];
  if (extraFocus.length) {
    searchesForOffsets.push({
      keywords: extraFocus,
      evidenceKinds: Object.fromEntries(extraFocus.map(keyword => [keyword, 'text'])),
    });
  }
  const offsets = collectPlanKeywordOffsets(text, searchesForOffsets, file);
  if (!offsets.size) return null;

  const renderKeywords = (plan?.searches || [])
    .filter(search => searchLayer(search) === 'render')
    .flatMap(search => search.keywords || []);
  const focusPriority = focusFromState.length
    ? focusFromState
    : (inherited.length ? inherited : renderKeywords);
  const focusKeywords = focusPriority.filter(keyword => offsets.has(keyword));

  const allOffsets = [...offsets.values()].flat();
  const contextCentroid = allOffsets.reduce((sum, value) => sum + value, 0) / allOffsets.length;

  let bestOffset;
  let anchor = '';
  if (focusKeywords.length) {
    const focusOffsets = focusKeywords.flatMap(keyword => offsets.get(keyword).map(offset => ({ keyword, offset })));
    const others = [...offsets.entries()]
      .filter(([keyword]) => !focusKeywords.includes(keyword))
      .flatMap(([, list]) => list);
    const pick = focusOffsets.reduce((best, item) => {
      const distance = others.length
        ? Math.min(...others.map(other => Math.abs(other - item.offset)))
        : Math.abs(item.offset - contextCentroid);
      return distance < best.distance ? { ...item, distance } : best;
    }, { offset: focusOffsets[0].offset, keyword: focusOffsets[0].keyword, distance: Infinity });
    bestOffset = pick.offset;
    anchor = pick.keyword;
  } else {
    bestOffset = Math.round(contextCentroid);
  }

  const { line, column } = offsetToLineColumn(text, bestOffset);
  return { file, offset: bestOffset, line, column, anchor, snippet: makeSnippet(text, bestOffset, 0) };
}

// 把细定位结果写回主渲染命中与 composite.render（供前端跳转到精确行）。
// 在源码里从一个开标签位置起，做同名标签配平，返回该元素 [start,end) 偏移。
function matchElementSpan(text, openIdx, tag) {
  const pattern = new RegExp(`<${escapeRegExp(tag)}\\b|</${escapeRegExp(tag)}\\s*>`, 'gi');
  pattern.lastIndex = openIdx;
  let depth = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match[0][1] === '/') {
      depth -= 1;
      if (depth === 0) return { start: openIdx, end: match.index + match[0].length };
    } else {
      const gt = text.indexOf('>', match.index);
      if (gt === -1) return null;
      if (text[gt - 1] !== '/') depth += 1;
      pattern.lastIndex = gt + 1;
    }
    if (depth < 0) return null;
  }
  return null;
}

// 从选区 DOM 取「根元素 + 后代稳定锚点（可见文案 + 业务 class）」。
function selectionRootAndAnchors(body) {
  const markup = selectionList(body).map(selectionMarkup).find(Boolean) || '';
  if (!markup) return null;
  const root = (parseHtmlLite(markup).children || []).find(child => child.type === 'element');
  if (!root) return null;
  const rootBusinessClasses = classTokens(root.attrs).filter(token => token && !isLikelyRuntimeClassToken(token));
  const texts = [];
  const subtreeClasses = [];       // 整个选区子树里的所有 class（含框架 class，用于组件标签消歧）
  const subtreeBusinessClasses = []; // 子树里的业务 class（保留给上游其它用途）
  (function walk(node) {
    if (node.type === 'text') {
      const value = stableDomSearchText(node.text);
      if (value) texts.push(value);
      return;
    }
    for (const token of classTokens(node.attrs || {})) {
      if (!token) continue;
      subtreeClasses.push(token);
      if (!isLikelyRuntimeClassToken(token)) subtreeBusinessClasses.push(token);
    }
    for (const child of node.children || []) walk(child);
  })(root);
  return {
    tag: root.tag,
    rootBusinessClasses,
    subtreeClasses: uniq(subtreeClasses),
    subtreeBusinessClasses: uniq(subtreeBusinessClasses),
    texts: uniq(texts),
  };
}

// script/style/template 是「语言区域分隔标签」（其内容分别是 JS/CSS/HTML），本身不是要对齐的 DOM 节点，跳过。
const REGION_DELIMITER_TAG = /^(?:script|style|template)$/i;

function allOccurrences(text, value) {
  const out = [];
  let from = 0;
  while (out.length < 50) {
    const index = text.indexOf(value, from);
    if (index === -1) break;
    out.push(index);
    from = index + Math.max(1, value.length);
  }
  return out;
}

// 引号感知的括号配平：从 open 起找到匹配的 close，跳过字符串/模板串里的括号
// （如 style 里的 cubic-bezier(.4, 0, .2, 1) 不应被当成语法括号）。
function matchBalancedSpan(text, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === quote) break;
        i += 1;
      }
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return { start: openIdx, end: i + 1 };
    }
  }
  return null;
}
function matchParenSpan(text, openIdx) {
  return matchBalancedSpan(text, openIdx, '(', ')');
}

// 包含某位置的所有 open/close 配平块（{…} 函数体/对象、[…] 数组）。引号感知，跳过字符串内的括号。
function bracketSpansContaining(text, pos, open, close) {
  const spans = [];
  let scanned = 0;
  for (let i = 0; i <= pos && i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === c) break;
        i += 1;
      }
      continue;
    }
    if (c !== open) continue;
    scanned += 1;
    if (scanned > 4000) break;
    const span = matchBalancedSpan(text, i, open, close);
    if (span && span.end > pos) spans.push(span);
    if (spans.length > 300) break;
  }
  return spans;
}

// 包含某位置的所有 HTML 标签元素（可选：切片须字面含全部 texts）。HTML 标签形态涵盖 Vue template / JSX / 原生 HTML。
function elementSpansContaining(text, pos, texts = []) {
  const openPattern = /<([A-Za-z][\w-]*)\b[^>]*?>/g;
  const spans = [];
  let match;
  let scanned = 0;
  while ((match = openPattern.exec(text)) && scanned < 4000) {
    scanned += 1;
    if (match.index > pos) break;
    if (/\/>\s*$/.test(match[0]) || REGION_DELIMITER_TAG.test(match[1])) continue;
    const span = matchElementSpan(text, match.index, match[1]);
    if (span && span.start <= pos && span.end >= pos) {
      const slice = text.slice(span.start, span.end);
      if (texts.every(value => slice.includes(value))) spans.push(span);
    }
    if (spans.length > 200) break;
  }
  return spans;
}

// 包含某位置的所有 JS 渲染调用（可选：切片须字面含全部 texts）。渲染调用形态涵盖 Vue render / React / JSX 产物。
const RENDER_CALL_RE = /(?<![\w.$])(?:h|createElement|jsx|jsxs|_jsx|_jsxs)\s*\(|(?<![\w$])React\.createElement\s*\(/g;
function renderCallSpansContaining(text, pos, texts = []) {
  RENDER_CALL_RE.lastIndex = 0;
  const spans = [];
  let match;
  let scanned = 0;
  while ((match = RENDER_CALL_RE.exec(text)) && scanned < 8000) {
    scanned += 1;
    const callStart = match.index;
    if (callStart > pos) break;               // 之后的调用都起始于 pos 之后，不可能包含它
    const span = matchParenSpan(text, callStart + match[0].length - 1);
    if (span && span.end > pos) {
      const slice = text.slice(callStart, span.end);
      if (texts.every(value => slice.includes(value))) spans.push({ start: callStart, end: span.end });
    }
    if (spans.length > 400) break;
  }
  return spans;
}

// 包含某位置、且切片字面含全部锚点的最小 DOM 节点表达（标签或渲染调用，取更小）。
function smallestUnitContainingAllAt(text, pos, anchors) {
  const spans = [...elementSpansContaining(text, pos, anchors), ...renderCallSpansContaining(text, pos, anchors)];
  spans.sort((a, b) => (a.end - a.start) - (b.end - b.start));
  return spans[0] || null;
}

// 本地判定 exact 的「诚实门槛」：一组锚点是否「唯一、无歧义」地钉住一个 DOM 节点表达。
// 以最稀有锚点的每个出现位置为锚，取「含全部锚点的最小 DOM 单元」，去重后必须只剩唯一一个才算钉住。
// 多义（同名文案出现多处等）一律不算 —— 交给 LLM，而不是本地硬凑一个。
function uniquePinnedSpan(text, anchors) {
  if (!anchors.length) return null;
  const withPositions = anchors.map(value => ({ value, positions: allOccurrences(text, value) }));
  if (withPositions.some(item => !item.positions.length)) return null;   // 有锚点根本不在源码 → 不算钉住
  const rarest = withPositions.slice().sort((a, b) => a.positions.length - b.positions.length)[0];
  const found = [];
  const seen = new Set();
  for (const pos of rarest.positions) {
    const span = smallestUnitContainingAllAt(text, pos, anchors);
    if (!span) continue;
    const key = `${span.start}:${span.end}`;
    if (!seen.has(key)) { seen.add(key); found.push(span); }
  }
  return found.length === 1 ? found[0] : null;
}

// 拿不准时交给 LLM 的「上下文区域」：包含某位置、长度不超过 cap 的「最大」配平单元。
// 除了标签/渲染调用，还纳入 {…}/[…] 块（如整个 render 函数体/列配置），这样即使定位点被兄弟带偏，
// 仍能把兄弟邻域一并带上（如 ¥3 那格里同时看到 ¥itemCost / ¥expressCost / 查看），供 LLM 结构对齐。
function enclosingRegionAt(text, pos, cap) {
  const spans = [
    ...elementSpansContaining(text, pos),
    ...renderCallSpansContaining(text, pos),
    ...bracketSpansContaining(text, pos, '{', '}'),
    ...bracketSpansContaining(text, pos, '[', ']'),
  ];
  if (!spans.length) return null;
  const underCap = spans.filter(span => span.end - span.start <= cap);
  if (underCap.length) return underCap.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  return spans.sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
}

// 包含整个 [lo,hi] 区间的「最小」配平块（元素 / 渲染调用 / {…} / […]，长度 ≤ cap）。
function smallestBlockContainingRange(text, lo, hi, cap) {
  const spans = [
    ...elementSpansContaining(text, lo),
    ...renderCallSpansContaining(text, lo),
    ...bracketSpansContaining(text, lo, '{', '}'),
    ...bracketSpansContaining(text, lo, '[', ']'),
  ].filter(span => span.start <= lo && span.end >= hi && (span.end - span.start) <= cap);
  spans.sort((a, b) => (a.end - a.start) - (b.end - b.start));
  return spans[0] || null;
}

// 按「容器锚点」（如选区所在列的 data-col-key 值 cost）定位选区大致所在的源码区块。
// 容器标识在源码里往往在「它的定义/渲染块」内密集出现（cost 列的配置里同时有 key:'cost'/itemCost/expressCost/handleViewCost）：
// 取密度最高的那簇，返回「恰好包住整簇的最小配平块」（= 那一列的配置对象/渲染块，而不是整个 columns 数组）。
// 这样即使选区自身没有锚点，也能把 LLM 引到正确的那一列区块里去判定。成功返回 { snippet, startLine, endLine }。
function regionByContainerAnchors(project, file, anchors, textCache) {
  const fileObj = (project.files || []).find(item => item.path === file);
  if (!fileObj) return null;
  const text = readProjectText(project, fileObj, textCache);
  if (!text) return null;
  const present = uniq((Array.isArray(anchors) ? anchors : [])
    .map(value => String(value || '').trim())
    .filter(value => value.length >= 2 && text.includes(value)));
  if (!present.length) return null;
  const positions = [];
  for (const value of present) for (const pos of allOccurrences(text, value)) positions.push(pos);
  if (!positions.length) return null;
  let best = positions[0];
  let bestCount = -1;
  for (const pos of positions) {
    const count = positions.filter(other => Math.abs(other - pos) <= 1200).length;
    if (count > bestCount) { bestCount = count; best = pos; }
  }
  const cluster = positions.filter(pos => Math.abs(pos - best) <= 1200);
  const lo = Math.min(...cluster);
  const hi = Math.max(...cluster);
  const region = smallestBlockContainingRange(text, lo, hi, MAX_EXCERPT_CHARS)
    || enclosingRegionAt(text, best, MAX_EXCERPT_CHARS);
  if (!region) return null;
  return {
    snippet: text.slice(region.start, region.end),
    startLine: offsetToLineColumn(text, region.start).line,
    endLine: offsetToLineColumn(text, region.end).line,
  };
}

// DOM 对齐的源码「修改范围」，带诚实置信度。
// DOM 是最终产物：源码无论写成 HTML 标签形态（<div>…，涵盖 Vue template/JSX/原生 HTML）还是
// JS 渲染调用形态（h('div',…)/createElement/jsx），描述的都是同一个 DOM 节点；两种形态统一处理。
// 三档诚实分流（只认「原始选区自身」的锚点，扩区带进来的兄弟文案绝不作数）：
//   · exact：原始选区锚点在源码里「唯一、无歧义」钉住一个 DOM 节点 → 本地权威定位，后链路可直接用；
//   · approximate：原始选区有锚点但多义/动态 → 定位点已被原始锚点锚定，回「含兄弟邻域的 render 区域」交 LLM 对齐；
//   · unlocated：原始选区没有任何能命中源码的锚点（如纯运行时数值 ¥3）→ 本地无法可靠定位。
//     此时绝不用扩区后的选区/整行检索词硬凑一个区域（那会漂到别的列，误导后链路），
//     而是明确告诉后链路「没定位到」，让变更计划 LLM 依据原始选区身份(值/样式/所在容器)+完整文件自己定位。
// 返回 { alignment, needsAlign, startLine, endLine, snippet }；file 读不到时返回 null。
function computeSourceScope(project, file, body, textCache, location, focusAnchors = []) {
  const fileObj = (project.files || []).find(item => item.path === file);
  if (!fileObj) return null;
  const text = readProjectText(project, fileObj, textCache);
  if (!text) return null;

  const unlocated = { alignment: 'unlocated', needsAlign: true, startLine: 0, endLine: 0, snippet: '' };
  const originAnchors = uniq((Array.isArray(focusAnchors) ? focusAnchors : [])
    .map(value => String(value || '').trim())
    .filter(value => value.length >= 2 && text.includes(value)));
  if (!originAnchors.length) return unlocated;   // 原始选区无可命中锚点 → 不硬凑，交给 LLM

  const pinned = uniquePinnedSpan(text, originAnchors);
  if (pinned) {
    const snippet = text.slice(pinned.start, pinned.end);
    return {
      alignment: 'exact',
      needsAlign: false,
      startLine: offsetToLineColumn(text, pinned.start).line,
      endLine: offsetToLineColumn(text, pinned.end).line,
      snippet: snippet.length > MAX_EXCERPT_CHARS ? snippet.slice(0, MAX_EXCERPT_CHARS) : snippet,
    };
  }

  // 有锚点但多义/动态：定位点已被原始锚点锚定，取含邻域的区域交 LLM。
  if (!location || !Number.isInteger(location.offset)) return unlocated;
  const region = enclosingRegionAt(text, location.offset, MAX_EXCERPT_CHARS);
  if (!region) return unlocated;
  return {
    alignment: 'approximate',
    needsAlign: true,
    startLine: offsetToLineColumn(text, region.start).line,
    endLine: offsetToLineColumn(text, region.end).line,
    snippet: text.slice(region.start, region.end),
  };
}

function attachFineLocation(result, project, plan, agentState, textCache, body = null) {
  const file = result?.composite?.render?.file || result?.hits?.[0]?.file;
  if (!file || !plan) return result;
  const location = computeFineLocation(project, file, plan, agentState, textCache);
  const scope = computeSourceScope(project, file, body, textCache, location, focusAnchorsFromState(agentState || body?.agentState || null));
  if (!location && !scope) return result;
  const topHit = (result.hits || []).find(hit => hit.file === file);
  if (topHit) {
    if (location) {
      topHit.line = location.line;
      topHit.column = location.column;
      topHit.preciseOffset = location.offset;
      topHit.locatedAnchor = location.anchor;
    }
    // DOM 对齐范围优先作为精确片段（= 修改范围）；对不齐时退回 fine-location 的锚点片段。
    if (scope) {
      topHit.preciseSnippet = scope.snippet;
      topHit.scopeStartLine = scope.startLine;
      topHit.scopeEndLine = scope.endLine;
      topHit.scopeAlignment = scope.alignment;   // 'exact' | 'approximate'：告知后链路该范围可信度
      topHit.scopeNeedsAlign = !!scope.needsAlign; // approximate 时为 true：该片段是待对齐区域，非精确节点
      if (!location) topHit.line = scope.startLine;
    } else if (location?.snippet) {
      topHit.preciseSnippet = location.snippet;
      topHit.scopeAlignment = 'approximate';     // 仅锚点附近片段，非 DOM 对齐，弱证据
      topHit.scopeNeedsAlign = true;
    }
  }
  if (result.composite && result.composite.render && result.composite.render.file === file) {
    if (location) {
      result.composite.render.line = location.line;
      result.composite.render.column = location.column;
      result.composite.render.anchor = location.anchor;
    }
    if (scope) {
      result.composite.render.scopeStartLine = scope.startLine;
      result.composite.render.scopeEndLine = scope.endLine;
      result.composite.render.scopeAlignment = scope.alignment;
      result.composite.render.scopeNeedsAlign = !!scope.needsAlign;
    }
  }
  return result;
}

function normalizeJudge(parsed, project, allowedFiles = []) {
  const fileSet = new Set((project.files || []).map(file => file.path));
  const allowed = new Set(allowedFiles);
  const files = (Array.isArray(parsed?.files) ? parsed.files : [])
    .map(item => ({
      file: String(item?.file || '').replace(/^\/+/, ''),
      role: ['render', 'definition', 'assembly'].includes(item?.role) ? item.role : 'render',
      confidence: normalizeConfidence(item?.confidence),
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
  const renderCandidates = (inspection.candidates || []).filter(isRenderCandidate);
  const hasPrimaryCandidate = renderCandidates.length > 0;
  let selected;
  if (judge?.files?.length) {
    // 只丢弃「真正的参考文件」；planned-group 命中的候选即便标了 referenceOnly 也保留为渲染结果。
    selected = judge.files.filter(item => {
      const candidate = candidateByFile.get(item.file);
      return isRenderCandidate(candidate) || !hasPrimaryCandidate;
    });
  } else {
    selected = [];
  }
  // 无有效 Judge 结论时的兜底：从「渲染候选」里挑，而不是直接用可能是参考文件(如路由配置)的最高分 selectedFile。
  if (!selected.length) {
    const renderPick = dominantRenderCandidate(inspection)
      || renderCandidates.sort((a, b) => b.score - a.score)[0]
      || (inspection.status === 'unique'
        ? candidateByFile.get(inspection.selectedFile)
        : null);
    if (renderPick) {
      selected = [{ file: renderPick.file, role: 'render', confidence: 85, reason: '本地渲染候选事实收敛（排除定义/参考文件）' }];
    }
  }
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

function isRouteOnlyLocalHit(hit) {
  const reasons = (hit?.reasons || []).map(String);
  return reasons.some(reason => reason.includes('只有路由命中，缺少本文件局部证据'))
    || (reasons.some(reason => reason.includes('强证据命中(route)：route-hit'))
      && !reasons.some(reason => /强证据命中\((?:text|class|attr|dom|component)\)/.test(reason)));
}

function hasDirectLocalUiEvidence(hit) {
  if (!hit || STYLE_EXTENSIONS.has(path.posix.extname(hit.file || ''))) return false;
  if (isRouteOnlyLocalHit(hit)) return false;
  const reasons = (hit.reasons || []).map(String);
  return reasons.some(reason => /强证据命中\((?:text|class|attr|dom|component)\)/.test(reason))
    || reasons.some(reason => reason.includes('DOM 分组链路确认'))
    || reasons.some(reason => reason.includes('同窗口共现'))
    || reasons.some(reason => reason.includes('L0 当前页面模块闭包：仅用当前选区文案/class 初始命中'));
}

function hasCurrentPageRelation(hit) {
  const reasons = (hit?.reasons || []).map(String);
  return reasons.some(reason => reason.includes('检索层级：L0 当前页面模块闭包'))
    || reasons.some(reason => reason.includes('页面引用链'))
    || reasons.some(reason => reason.includes('当前页面源码闭包'))
    || reasons.some(reason => reason.includes('路径精确匹配'));
}

function selectionMarkupTotalLength(body) {
  return selectionList(body).reduce((total, selection) => total + selectionMarkup(selection).length, 0);
}

function localPreflightConvergence(project, body, onLog) {
  if (selectionMarkupTotalLength(body) > DEFAULT_DOM_AGENT_THRESHOLD) {
    return null;
  }
  onLog('DOM Agent 前置本地检索：searchProjectWithMeta(body)');
  const localResult = searchProjectWithMeta(project, body);
  const hits = localResult.hits || [];
  onLog(`DOM Agent 前置本地输出：${JSON.stringify({
    candidateCount: hits.length,
    route: localResult.routeResolver?.bestPageFile || '',
    files: hits.slice(0, 8).map(hit => ({
      file: hit.file,
      score: hit.score,
      routeOnly: isRouteOnlyLocalHit(hit),
      directEvidence: hasDirectLocalUiEvidence(hit),
      currentPageRelation: hasCurrentPageRelation(hit),
    })),
  }, null, 2)}`);
  if (!localResult.routeResolver?.matched) return null;
  const directHits = hits.filter(hit => hasDirectLocalUiEvidence(hit) && hasCurrentPageRelation(hit));
  if (!directHits.length || directHits.length > 2 || hits.length > 6) return null;
  const rankedHits = [
    ...directHits.map((hit, index) => ({
      ...hit,
      score: 1600 - index * 50 + Math.min(80, Math.round((hit.score || 0) / 10)),
      stage: 'local-preflight',
      sourceRole: 'render',
      preciseEvidence: true,
      reasons: uniq([
        'DOM Agent 前置本地收敛：当前页面闭包内存在直接 UI 证据，跳过模型 Planner',
        ...(hit.reasons || []),
      ]).slice(0, 12),
    })),
    ...hits
      .filter(hit => !directHits.some(direct => direct.file === hit.file))
      .map(hit => ({
        ...hit,
        score: Math.min(hit.score || 0, isRouteOnlyLocalHit(hit) ? 240 : 900),
        stage: hit.stage || 'local-preflight-context',
        sourceRole: isRouteOnlyLocalHit(hit) ? 'assembly' : (hit.sourceRole || ''),
        reasons: uniq([
          isRouteOnlyLocalHit(hit)
            ? 'DOM Agent 前置本地收敛：路由入口仅作为装配上下文'
            : 'DOM Agent 前置本地收敛：相关上下文候选',
          ...(hit.reasons || []),
        ]).slice(0, 12),
      })),
  ].sort((a, b) => b.score - a.score);
  return {
    ...localResult,
    hits: rankedHits,
    agent: {
      enabled: true,
      localPreflight: true,
      reason: '当前路由闭包内少量候选已由本地直接 UI 证据收敛',
      directFiles: directHits.map(hit => hit.file),
    },
  };
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

  // Stage0：运行时组件链已解析到真实源码文件（__file）——这是最确定的信号，
  // 直接产出组合结果并返回，跳过 Planner / 检索 / Judge 全部 LLM 调用。
  const chainProjectFiles = resolveChainToProjectFiles(project, body);
  if (chainProjectFiles.length) {
    onLog(`DOM Agent Stage0：运行时组件链命中源码文件，确定性收敛，跳过 LLM：${chainProjectFiles.join(' -> ')}`);
    const composite = buildStage0Composite(chainProjectFiles);
    const hits = chainProjectFiles.map((file, index) => ({
      file,
      score: 4000 - index * 100,
      stage: 'dom-agent-stage0',
      preciseEvidence: index === 0,
      sourceRole: index === 0 ? 'render' : 'assembly',
      modelConfidence: index === 0 ? 100 : 0,
      reasons: ['DOM Agent Stage0：运行时组件链 __file 直接命中源码，无需模型参与'],
    }));
    return {
      hits,
      composite,
      routeResolver: null,
      apiTrace: null,
      i18nTrace: null,
      definitionTrace: null,
      agent: {
        enabled: true,
        trigger,
        stage0: true,
        componentFiles: chainProjectFiles,
      },
    };
  }

  const localPreflight = localPreflightConvergence(project, body, onLog);
  if (localPreflight) {
    onLog(`DOM Agent 前置本地收敛：命中文件 ${localPreflight.agent.directFiles.join('、')}；跳过 Planner/Judge`);
    return localPreflight;
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
  const plannerSystemPrompt = buildLocatorSystemPrompt(locatorTechnicalStackMarkdown(project));
  onLog(`DOM Agent System Prompt（${plannerSystemPrompt.length} 字符）:\n${plannerSystemPrompt}`);
  onLog(`DOM Agent Planner 输入（${plannerPrompt.length} 字符）:\n${plannerPrompt}`);
  const plannerResult = await invokeModel(body.adapter, plannerPrompt, project.path, {
    signal,
    onLog,
    systemPrompt: plannerSystemPrompt,
    temperature: 0.2,
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
  let executionPlan = plan;
  let fallbackPlan = null;
  if (!plan.searches.length) {
    const derivedPlan = annotatePlanKeywordTypes(deriveLocalDomSearchPlan(body), body);
    if (derivedPlan.searches.length) {
      onLog('本地调用：deriveLocalDomSearchPlan(body)');
      onLog(`本地输出：${JSON.stringify(derivedPlan, null, 2)}`);
      onLog('DOM Agent Planner 未返回可执行检索词，本地派生计划作为兜底执行。');
      executionPlan = derivedPlan;
      fallbackPlan = derivedPlan;
    }
  }
  const inheritedKeywords = inheritedSearchKeywords(body?.agentState || null);
  if (inheritedKeywords.length) {
    onLog(`DOM Agent 扩区保留上一轮检索锚点用于引用链验证：${inheritedKeywords.join('、')}`);
  }
  const combinedPlan = expansionCombinedSearchPlan(executionPlan, body?.agentState || null);
  if (!executionPlan.searches.length) {
    if (executionPlan.needMoreDom || plan.needMoreDom) {
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
          plan: executionPlan,
          modelPlan: plan,
          fallbackPlan,
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

  onLog(`本地调用：executeSearchPlan(project, ${JSON.stringify(executionPlan)})`);
  const currentCandidates = executeSearchPlan(project, executionPlan, textCache);
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
      ...executionPlan.searches,
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
    const composite = buildComposite(inspection, [], localRouteDecision.files[0].file);
    onLog(`DOM Agent 本地关系裁决：${localRouteDecision.files[0].reason}`);
    onLog(`DOM Agent 最终输出：${JSON.stringify({
      status: localRouteDecision.status,
      files: hits.map(hit => ({
        file: hit.file,
        score: hit.score,
        role: hit.sourceRole || '',
      })),
    }, null, 2)}`);
    return attachFineLocation({
      hits,
      composite,
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
    }, project, executionPlan, body?.agentState || null, textCache, body);
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

  // 原始选区关系校验：扩区是为了找文件，但最终文件必须与「用户最初选中的那块」有渲染/引用关系。
  // 剔除那些只命中了扩区大区域、却与原始选区锚点毫无关系的渲染候选。
  const originAnchors = focusAnchorsFromState(body?.agentState || null);
  if (originAnchors.length) {
    const renderCandidates = inspection.candidates.filter(isRenderCandidate);
    const validRenderFiles = new Set(
      renderCandidates
        .filter(candidate => validateOriginRelation(project, candidate.file, originAnchors, textCache).valid)
        .map(candidate => candidate.file)
    );
    if (renderCandidates.length && !validRenderFiles.size) {
      onLog(`DOM Agent 原始选区关系校验：全部渲染候选都与最初选区锚点(${originAnchors.join('、')})无渲染/引用关系，判定为「扩区命中了别处、并非你选的那块」`);
      return {
        hits: [],
        composite: null,
        routeResolver: routeResult.trace,
        apiTrace: null,
        i18nTrace: null,
        definitionTrace: null,
        needMoreDom: true,
        needsMoreEvidence: true,
        agent: {
          enabled: true,
          trigger,
          plan: executionPlan,
          modelPlan: plan,
          inspection: compactInspectionForModel(inspection),
          definitionResolution,
          originMismatch: true,
          originAnchors,
          evidence: {
            insufficient: true,
            reason: '扩区命中的文件与原始选区无渲染/引用关系，真正渲染该区域的组件可能在被压缩省略的部分，请直接选中该区域本身重试',
          },
          needMoreDom: true,
        },
      };
    }
    if (validRenderFiles.size && validRenderFiles.size < renderCandidates.length) {
      // 只保留与原始选区相关的渲染候选；参考/子组件/定义候选保留以维持引用链。
      inspection = {
        ...inspection,
        candidates: inspection.candidates.filter(candidate =>
          !isRenderCandidate(candidate) || validRenderFiles.has(candidate.file)),
      };
      onLog(`DOM Agent 原始选区关系校验：保留与最初选区相关的渲染候选 ${[...validRenderFiles].join('、')}`);
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

  // 本地已存在明显占优的渲染候选（稀有锚点共现）——直接收敛，不再调用 Judge。
  // Judge 仅在下面「本地无法收敛的真歧义」时才触发。
  const localDominant = dominantRenderCandidate(inspection);
  if (localDominant && !options.forceJudge) {
    const decision = {
      status: 'unique',
      files: [{
        file: localDominant.file,
        role: 'render',
        confidence: 95,
        reason: '判别性稀有锚点在同一渲染源码内共现，本地唯一收敛，无需模型裁决',
      }],
      source: 'local-dominant',
    };
    const hits = agentHits(inspection, decision, ownership);
    const composite = buildComposite(inspection, ownership, localDominant.file);
    onLog(`DOM Agent 本地收敛（跳过 Judge）：${localDominant.file}`);
    onLog(`DOM Agent 组合结果：${JSON.stringify(composite, null, 2)}`);
    return attachFineLocation({
      hits,
      composite,
      routeResolver: routeResult.trace,
      apiTrace: null,
      i18nTrace: null,
      definitionTrace: null,
      agent: {
        enabled: true,
        trigger,
        plan: executionPlan,
        modelPlan: plan,
        fallbackPlan,
        inspection: compactInspectionForModel(inspection),
        definitionResolution,
        evidence,
        judge: decision,
        localConverged: true,
      },
    }, project, executionPlan, body?.agentState || null, textCache, body);
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
  const composite = buildComposite(
    inspection,
    ownership,
    judge?.status === 'unique' && judge.files[0] ? judge.files[0].file : ''
  );
  onLog(`DOM Agent 最终输出：${JSON.stringify({
    status: judge?.status || inspection.status,
    files: hits.slice(0, 6).map(hit => ({
      file: hit.file,
      score: hit.score,
      role: hit.sourceRole || '',
    })),
  }, null, 2)}`);
  return attachFineLocation({
    hits,
    composite,
    routeResolver: routeResult.trace,
    apiTrace: null,
    i18nTrace: null,
    definitionTrace: null,
    agent: {
      enabled: true,
      trigger,
      plan: executionPlan,
      modelPlan: plan,
      fallbackPlan,
      inspection: compactInspectionForModel(inspection),
      definitionResolution,
      evidence,
      routeRelations,
      judge,
    },
  }, project, executionPlan, body?.agentState || null, textCache, body);
}

module.exports = {
  DEFAULT_DOM_AGENT_THRESHOLD,
  DF_SCOPE_LIMIT,
  compressDomMarkup,
  analyzeEvidenceSufficiency,
  dominantRenderCandidate,
  buildComposite,
  computeFineLocation,
  computeSourceScope,
  regionByContainerAnchors,
  offsetToLineColumn,
  validateOriginRelation,
  normalizeConfidence,
  domAgentTrigger,
  executeSearchPlan,
  inspectCandidates,
  resolveByRouteRelation,
  runAgentSearch,
  traceCandidateOwners,
  traceRouteCandidateRelations,
  validateJudgeRouteDecision,
};
