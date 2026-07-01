const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');
const tls = require('tls');
const { isTextFile, readProjectText } = require('../core/fs-utils');
const {
  enhanceLocatedPrompt,
  fallbackEnhancedPrompt,
} = require('../experience/prompt-enhancer');
const { findClassTokenIndex } = require('../search/evidence');
const { escapeRegExp, tokenize, uniq } = require('../utils');

function optionalRequire(name) {
  try {
    return require(name);
  } catch (error) {
    return null;
  }
}

const babelParser = optionalRequire('@babel/parser');
const vueCompilerSfc = optionalRequire('@vue/compiler-sfc');
const vueCompilerDom = optionalRequire('@vue/compiler-dom');

const MAX_MODEL_FILES = 4;
const MAX_FILE_CHARS = 18000;
const MAX_TOTAL_FILE_CHARS = 64000;
const MAX_FOCUSED_FILE_CHARS = 5200;
const MAX_MODEL_BATCH_TOKENS = 30000;
const TOKEN_ESTIMATE_CHARS = 3;
const MODEL_RESULT_SNIPPET_CHARS = 1400;
const MIN_FOCUSED_WINDOW_SCORE = 90;
const DEFAULT_TIMEOUT_MS = 120000;
const PRUNED_MODEL_FILE_CHARS = 10000;
const DIRECT_RELATED_CHARS = 5200;
const GENERIC_MODEL_SYMBOLS = new Set([
  'api',
  'app',
  'config',
  'data',
  'fetch',
  'http',
  'index',
  'item',
  'list',
  'params',
  'request',
  'response',
  'result',
  'service',
  'state',
  'store',
  'value',
]);
const MARKUP_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.vue',
  '.svelte',
  '.astro',
  '.wxml',
  '.xml',
]);
const SCRIPT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
]);
const STYLE_EXTENSIONS = new Set([
  '.css',
  '.less',
  '.scss',
  '.sass',
  '.styl',
]);
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function splitCommandLine(value) {
  const input = String(value || '').trim();
  const result = [];
  let token = '';
  let quote = '';
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = '';
      else token += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (token) {
        result.push(token);
        token = '';
      }
      continue;
    }
    token += char;
  }
  if (token) result.push(token);
  return result;
}

function normalizeAdapter(raw) {
  const adapter = raw && typeof raw === 'object' ? raw : {};
  const type = adapter.type === 'api' ? 'api' : 'exec';
  const normalizedName = adapter.name === 'Exec 模型' ? 'Cli 模型' : adapter.name;
  return {
    id: String(adapter.id || ''),
    name: String(normalizedName || (type === 'api' ? 'API 模型' : 'Cli 模型')),
    type,
    command: String(adapter.command || ''),
    endpoint: String(adapter.endpoint || ''),
    apiKey: String(adapter.apiKey || ''),
    model: String(adapter.model || ''),
    proxyUrl: String(adapter.proxyUrl || ''),
    timeoutMs: Math.max(5000, Math.min(Number(adapter.timeoutMs || DEFAULT_TIMEOUT_MS), 300000)),
  };
}

function compact(value, limit = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function clipText(value, limit = 1200) {
  const text = String(value || '').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function stringList(value, limit = 12) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[,，\s]+/);
  return uniq(list
    .map(item => String(item || '').trim())
    .filter(item => item.length >= 1 && item.length <= 80))
    .slice(0, limit);
}

function safeJson(value) {
  return JSON.stringify(value || null, null, 2);
}

function appendLog(logs, text) {
  if (!Array.isArray(logs) || !text) return;
  logs.push(text);
  if (typeof logs.onAppend === 'function') {
    logs.onAppend(text, logs.slice());
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error('模型定位已停止');
    error.name = 'AbortError';
    throw error;
  }
}

function safeUrlLabel(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch (error) {
    return String(value || '-');
  }
}

function normalizeProxyUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  const url = new URL(withProtocol);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('代理地址只支持 http:// 或 https://');
  }
  return url;
}

function proxyAuthHeader(proxyUrl) {
  if (!proxyUrl || (!proxyUrl.username && !proxyUrl.password)) return '';
  const username = decodeURIComponent(proxyUrl.username || '');
  const password = decodeURIComponent(proxyUrl.password || '');
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function projectFile(project, filePath) {
  const normalized = normalizeModelFilePath(filePath);
  return (project.files || []).find(file => file.path === normalized);
}

function numericStyleValue(value) {
  const matched = String(value || '').trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return matched ? matched[1] : '';
}

function pruneEvidencePriority(label) {
  const text = String(label || '');
  if (/桥接|dataIndex|key/.test(text)) return 6;
  if (/文案|文本|精确|唯一/.test(text)) return 5;
  if (/class|样式|宽度|高度|objectFit|object-fit|background|borderRadius|border-radius|css/i.test(text)) return 4;
  if (/属性|attr|data-|href|key|value|role|title|aria/i.test(text)) return 3;
  if (/图片|资源|img|image|src|poster/i.test(text)) return 2;
  if (/片段/.test(text)) return 1;
  return 0;
}

function addNeedle(map, needle, weight, label, priority = pruneEvidencePriority(label)) {
  const value = String(needle || '').trim();
  if (!value || value.length < 2) return;
  const key = value.toLowerCase();
  const old = map.get(key);
  if (!old || old.priority < priority || (old.priority === priority && old.weight < weight)) {
    map.set(key, { needle: value, weight, label, priority });
  }
}

function normalizeModelFilePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

const MEDIA_ATTR_KEYS = new Set(['src', 'srcset', 'poster', 'data-src', 'data-original', 'data-lazy-src']);

function resourceSeedValuesFromInfo(info) {
  const attrs = info?.attrs || {};
  const style = info?.computedStyle || {};
  const values = [];
  if (String(info?.tag || '').toLowerCase() === 'img') {
    values.push('img', 'image', 'src');
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (!value) continue;
    const lowerKey = key.toLowerCase();
    if (MEDIA_ATTR_KEYS.has(lowerKey)) {
      values.push(lowerKey, 'image', lowerKey === 'poster' ? 'poster' : 'src');
    } else if (lowerKey === 'magnus-media' && String(value).toLowerCase() === 'image') {
      values.push('img', 'image', 'src');
    } else if (/^(alt|title|aria-label|placeholder|role)$/i.test(key)) {
      values.push(value);
    }
  }
  if (style.backgroundImage && style.backgroundImage !== 'none') {
    values.push('background-image', 'backgroundImage', 'background', 'image');
  }
  if (String(info?.inlineStyle || '').includes('url(')) {
    values.push('background-image', 'background', 'image');
  }
  return uniq(values
    .map(value => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(value => value.length >= 3 && value.length <= 80 && !/^\d+(?:px)?$/i.test(value) && value !== '[present]'))
    .slice(0, 24);
}

function sanitizeModelInlineStyle(value) {
  return String(value || '').replace(/url\([^)]*\)/gi, 'url([runtime])');
}

function usefulAttrSeedsFromInfo(info, limit = 24) {
  const attrs = info?.attrs || {};
  const result = [];
  for (const [key, rawValue] of Object.entries(attrs)) {
    const attrKey = String(key || '').trim();
    const value = String(rawValue || '').replace(/\s+/g, ' ').trim();
    if (!attrKey || attrKey === 'class' || /^data-v-/i.test(attrKey)) continue;
    if (attrKey.length >= 2 && attrKey.length <= 80) result.push({ value: attrKey, label: '选区属性名' });
    if (value && value !== '[present]' && value.length <= 180) {
      result.push({ value, label: '选区属性值' });
      result.push({ value: `${attrKey}=${value}`, label: '选区属性 key=value' });
    }
  }
  return uniq(result.map(item => JSON.stringify(item))).map(item => JSON.parse(item)).slice(0, limit);
}

function usefulStyleSeedsFromStyle(style = {}, inlineStyle = '', limit = 24) {
  const result = [];
  const add = value => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || text === '[present]' || text.length < 2 || text.length > 180) return;
    if (/^(auto|none|normal|static|relative|absolute|flex|block|inline|table|hidden|visible|center|left|right|top|bottom|nowrap|fill)$/i.test(text)) return;
    if (/^rgba?\(0,\s*0,\s*0,\s*0\)$/i.test(text)) return;
    result.push(text);
  };
  add(sanitizeModelInlineStyle(inlineStyle));
  for (const [key, rawValue] of Object.entries(style || {})) {
    const value = String(rawValue || '').trim();
    if (!value) continue;
    add(value);
    add(`${key}: ${sanitizeModelInlineStyle(value)}`);
  }
  return uniq(result).slice(0, limit);
}

function findSnippetIndex(text, snippet) {
  const content = String(text || '');
  const raw = String(snippet || '').trim();
  if (!content || !raw) return -1;
  const exactIndex = content.indexOf(raw);
  if (exactIndex !== -1) return exactIndex;

  const lines = raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length >= 6)
    .sort((a, b) => b.length - a.length);
  for (const line of lines) {
    const index = content.indexOf(line);
    if (index !== -1) return index;
  }

  const lowerText = content.toLowerCase();
  const tokens = tokenize(raw)
    .filter(token => token.length >= 4)
    .sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    const index = lowerText.indexOf(token.toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
}

function findAllNeedleIndexes(text, needle, limit = 12) {
  const content = String(text || '');
  const value = String(needle || '').trim();
  if (!content || !value) return [];
  const result = [];
  let index = 0;
  while (result.length < limit && index < content.length) {
    const found = content.indexOf(value, index);
    if (found === -1) break;
    result.push({
      index: found,
      length: value.length,
      needle: value,
    });
    index = found + Math.max(1, value.length);
  }
  return result;
}

function findAllClassNeedleIndexes(text, needle, limit = 12) {
  const content = String(text || '');
  const value = String(needle || '').trim();
  if (!content || !value) return [];
  const result = [];
  let index = 0;
  while (result.length < limit && index < content.length) {
    const found = findClassTokenIndex(content, value, index);
    if (found === -1) break;
    result.push({
      index: found,
      length: value.length,
      needle: value,
    });
    index = found + Math.max(1, value.length);
  }
  return result;
}

function isClassSeedLabel(label) {
  return /class/i.test(String(label || ''));
}

function findAllSeedIndexes(text, seed, limit = 12) {
  if (isClassSeedLabel(seed?.label)) {
    return findAllClassNeedleIndexes(text, seed?.text, limit);
  }
  return findAllNeedleIndexes(text, seed?.text, limit);
}

function weakSelectionSeed(value) {
  return /^(?:img|image|src|poster|background|backgroundImage|background-image|\[present\]|fill|auto|none|normal|static|relative|absolute|flex|block|inline|table|hidden|visible|center|left|right|top|bottom|nowrap)$/i.test(String(value || '').trim());
}

function addSubtreeNeedles(map, subtree, prefix, weights = {}) {
  if (!subtree || typeof subtree !== 'object') return;
  for (const className of (subtree.classNames || []).slice(0, 16)) {
    addNeedle(map, className, weights.classWeight || 64, `${prefix} class`);
  }
  for (const text of (subtree.texts || []).slice(0, 12)) {
    addNeedle(map, text, weights.textWeight || 84, `${prefix}文案`);
  }
  for (const attr of (subtree.attrs || []).slice(0, 16)) {
    const key = String(attr?.key || '');
    const value = String(attr?.value || '');
    if (!key && !value) continue;
    if (MEDIA_ATTR_KEYS.has(key.toLowerCase()) || key === 'magnus-media') {
      addNeedle(map, 'image', weights.resourceWeight || 72, `${prefix}图片/资源`);
      addNeedle(map, 'src', weakSelectionSeed('src') ? 24 : (weights.resourceWeight || 72), `${prefix}图片/资源`);
    } else {
      addNeedle(map, key, weights.attrWeight || 56, `${prefix}特殊属性`);
      addNeedle(map, value, weights.attrWeight || 56, `${prefix}特殊属性`);
    }
  }
  for (const item of (subtree.styles || []).slice(0, 12)) {
    const style = item?.style || {};
    for (const [key, value] of Object.entries(style).slice(0, 8)) {
      if (!value) continue;
      addNeedle(map, key, weights.styleWeight || 42, `${prefix}样式`);
      addNeedle(map, value, weights.styleWeight || 42, `${prefix}样式`);
    }
  }
}

function rangeExcerpt(text, start, end, maxChars) {
  const content = String(text || '');
  if (!content) return '';
  const safeStart = Math.max(0, Math.min(start, content.length));
  const safeEnd = Math.max(safeStart, Math.min(end, content.length));
  if (safeEnd - safeStart >= maxChars) {
    const clipped = content.slice(safeStart, safeStart + maxChars);
    return `${safeStart > 0 ? '...<omitted before excerpt>\n' : ''}${clipped}${safeStart + maxChars < content.length ? '\n...<omitted after excerpt>' : ''}`;
  }
  const remaining = maxChars - (safeEnd - safeStart);
  const before = Math.floor(remaining * 0.35);
  const after = remaining - before;
  const finalStart = Math.max(0, safeStart - before);
  const finalEnd = Math.min(content.length, safeEnd + after);
  return `${finalStart > 0 ? '...<omitted before excerpt>\n' : ''}${content.slice(finalStart, finalEnd)}${finalEnd < content.length ? '\n...<omitted after excerpt>' : ''}`;
}

function aroundIndexExcerpt(text, index, tokenLength, maxChars) {
  return rangeExcerpt(text, index, index + Math.max(1, tokenLength), maxChars);
}

function pairedRanges(text, openChar, closeChar) {
  const content = String(text || '');
  const ranges = [];
  const stack = [];
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    const next = content[index + 1] || '';
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index++;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index++;
      continue;
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) {
      stack.push(index);
      continue;
    }
    if (char === closeChar && stack.length) {
      const start = stack.pop();
      ranges.push({ start, end: index + 1, type: `${openChar}${closeChar}` });
    }
  }

  return ranges;
}

function markupTagRangeAt(text, index) {
  const content = String(text || '');
  if (!content || index < 0) return null;
  const before = content.lastIndexOf('<', index);
  if (before === -1) return null;

  const openTag = parseMarkupTagAt(content, before);
  if (!openTag || openTag.type !== 'tag') return null;
  const after = openTag.end;
  if (index > after) return null;
  const openText = content.slice(before, after + 1);
  const openMatch = openText.match(/^<\/?\s*([A-Za-z][\w:.-]*)\b/);
  if (!openMatch) return null;
  const tagName = openMatch[1];
  if (/^<\//.test(openText)) return { start: before, end: after + 1, type: 'tag' };
  if (/\/\s*>$/.test(openText) || VOID_TAGS.has(tagName.toLowerCase())) {
    return { start: before, end: after + 1, type: 'tag' };
  }

  const closePattern = new RegExp(`</\\s*${escapeRegExp(tagName)}\\s*>`, 'ig');
  closePattern.lastIndex = after + 1;
  const close = closePattern.exec(content);
  if (!close) return { start: before, end: after + 1, type: 'tag' };
  const fullEnd = close.index + close[0].length;
  if (fullEnd - before > DIRECT_RELATED_CHARS * 2) {
    return { start: before, end: after + 1, type: 'tag' };
  }
  return { start: before, end: fullEnd, type: 'tag-block' };
}

function pushAstNode(nodes, node) {
  if (!node || node.end <= node.start) return;
  nodes.push(node);
}

function parseMarkupAstNodes(text, offset = 0, rootType = 'html') {
  const content = String(text || '');
  const nodes = [];
  const stack = [];
  for (let index = 0; index < content.length; index++) {
    if (content[index] !== '<') continue;
    const tag = parseMarkupTagAt(content, index);
    if (!tag) continue;
    const start = offset + index;
    const end = offset + tag.end + 1;
    if (tag.type !== 'tag') {
      pushAstNode(nodes, { start, end, type: `${rootType}-${tag.type}`, name: tag.type, depth: stack.length });
      index = tag.end;
      continue;
    }
    if (tag.closing) {
      const stackIndex = stack.map(item => item.name).lastIndexOf(tag.name);
      if (stackIndex !== -1) {
        const open = stack.splice(stackIndex)[0];
        pushAstNode(nodes, {
          start: open.start,
          end,
          type: `${rootType}-tag`,
          name: tag.name,
          depth: open.depth,
        });
      } else {
        pushAstNode(nodes, { start, end, type: `${rootType}-tag`, name: tag.name, depth: stack.length });
      }
      index = tag.end;
      continue;
    }
    if (tag.selfClosing) {
      pushAstNode(nodes, { start, end, type: `${rootType}-tag`, name: tag.name, depth: stack.length });
      index = tag.end;
      continue;
    }
    stack.push({
      start,
      openEnd: end,
      name: tag.name,
      depth: stack.length,
    });
    index = tag.end;
  }
  for (const open of stack) {
    pushAstNode(nodes, {
      start: open.start,
      end: open.openEnd,
      type: `${rootType}-tag`,
      name: open.name,
      depth: open.depth,
    });
  }
  return nodes;
}

function babelPluginsForFile(filePath = '') {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  const plugins = [
    'decorators-legacy',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'objectRestSpread',
    'optionalChaining',
    'nullishCoalescingOperator',
    'dynamicImport',
    'importMeta',
    'topLevelAwait',
  ];
  if (ext === '.ts' || ext === '.tsx' || ext === '.vue') plugins.push('typescript');
  if (ext === '.jsx' || ext === '.tsx' || ext === '.vue') plugins.push('jsx');
  return plugins;
}

function parseBabelAst(text, filePath = '') {
  if (!babelParser) return null;
  try {
    return babelParser.parse(String(text || ''), {
      sourceType: 'unambiguous',
      errorRecovery: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      plugins: babelPluginsForFile(filePath),
    });
  } catch (error) {
    return null;
  }
}

function isBabelNode(value) {
  return value && typeof value.type === 'string'
    && typeof value.start === 'number'
    && typeof value.end === 'number';
}

function babelNodeName(node) {
  if (!node) return '';
  if (node.id?.name) return node.id.name;
  if (node.key?.name) return node.key.name;
  if (node.key?.value) return String(node.key.value);
  return node.type || '';
}

function babelRangeType(node) {
  const type = String(node?.type || '');
  if (/^(VariableDeclaration|FunctionDeclaration|ClassDeclaration|ExportDefaultDeclaration|ExportNamedDeclaration)$/.test(type)) return 'babel-declaration';
  if (/^(ObjectMethod|ClassMethod|ClassPrivateMethod)$/.test(type)) return 'babel-method';
  if (/^(ObjectProperty|ClassProperty|ClassPrivateProperty)$/.test(type)) return 'babel-property';
  if (/^(ObjectExpression|ArrayExpression)$/.test(type)) return 'babel-collection';
  if (/^(CallExpression|NewExpression)$/.test(type)) return 'babel-call';
  if (/^(JSXElement|JSXFragment)$/.test(type)) return 'babel-jsx';
  if (/^(FunctionExpression|ArrowFunctionExpression)$/.test(type)) return 'babel-function';
  return '';
}

function traverseBabelAst(root, visitor, parent = null) {
  if (!root || typeof root !== 'object') return;
  if (isBabelNode(root)) visitor(root, parent);
  for (const [key, value] of Object.entries(root)) {
    if (
      key === 'loc' ||
      key === 'start' ||
      key === 'end' ||
      key === 'leadingComments' ||
      key === 'trailingComments' ||
      key === 'innerComments' ||
      key === 'extra'
    ) continue;
    if (Array.isArray(value)) {
      for (const item of value) traverseBabelAst(item, visitor, root);
      continue;
    }
    if (value && typeof value === 'object') traverseBabelAst(value, visitor, root);
  }
}

function parseBabelAstNodes(text, offset = 0, filePath = '') {
  const ast = parseBabelAst(text, filePath);
  if (!ast) return [];
  const nodes = [];
  traverseBabelAst(ast, (node, parent) => {
    const rangeType = babelRangeType(node);
    if (!rangeType) return;
    let start = node.start;
    let end = node.end;
    if (
      (node.type === 'ObjectExpression' || node.type === 'ArrayExpression' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') &&
      parent?.type === 'VariableDeclarator'
    ) {
      const declaration = parent.__parentDeclaration;
      if (declaration?.start != null && declaration?.end != null) {
        start = declaration.start;
        end = declaration.end;
      }
    }
    nodes.push({
      start: offset + start,
      end: offset + end,
      type: rangeType,
      name: babelNodeName(node),
      depth: 0,
      rank: 0,
      ast: 'babel',
    });
  });
  return nodes;
}

function parseBabelDeclarationNodes(text, offset = 0, filePath = '') {
  const ast = parseBabelAst(text, filePath);
  if (!ast) return [];
  const declarationByDeclarator = new WeakMap();
  traverseBabelAst(ast, node => {
    if (node.type !== 'VariableDeclaration') return;
    for (const declarator of node.declarations || []) {
      declarationByDeclarator.set(declarator, node);
      declarator.__parentDeclaration = node;
    }
  });
  const nodes = [];
  traverseBabelAst(ast, (node, parent) => {
    if (node.type === 'VariableDeclarator') {
      const declaration = declarationByDeclarator.get(node) || parent;
      if (declaration?.start != null && declaration?.end != null) {
        nodes.push({
          start: offset + declaration.start,
          end: offset + declaration.end,
          type: 'babel-declaration',
          name: node.id?.name || '',
          depth: 0,
          rank: 0,
          ast: 'babel',
        });
      }
      return;
    }
    if (!/^(FunctionDeclaration|ClassDeclaration|ExportDefaultDeclaration|ExportNamedDeclaration)$/.test(node.type)) return;
    nodes.push({
      start: offset + node.start,
      end: offset + node.end,
      type: 'babel-declaration',
      name: babelNodeName(node),
      depth: 0,
      rank: 0,
      ast: 'babel',
    });
  });
  return nodes;
}

function parseScriptAstNodes(text, offset = 0, includeJsx = false) {
  const content = String(text || '');
  const nodes = parseBabelAstNodes(content, offset, includeJsx ? '.tsx' : '.ts');
  const ranges = [
    ...pairedRanges(content, '{', '}').map(range => ({ ...range, type: '{}', rank: 70 })),
    ...pairedRanges(content, '[', ']').map(range => ({ ...range, type: '[]', rank: 64 })),
    ...pairedRanges(content, '(', ')').map(range => ({ ...range, type: '()', rank: 58 })),
  ];
  for (const range of ranges) {
    const withPrefix = includeDeclarationPrefix(content, range);
    pushAstNode(nodes, {
      start: offset + withPrefix.start,
      end: offset + withPrefix.end,
      type: `script-${range.type}`,
      name: range.type,
      depth: 0,
      rank: range.rank,
    });
  }

  const callRanges = ranges
    .filter(range => range.type === '()')
    .map(range => callRangeForIndex(content, range.start + 1, ranges))
    .filter(Boolean);
  for (const range of callRanges) {
    pushAstNode(nodes, {
      start: offset + range.start,
      end: offset + range.end,
      type: 'script-call',
      name: 'call',
      depth: 0,
      rank: 92,
    });
  }

  if (includeJsx) {
    nodes.push(...parseMarkupAstNodes(content, offset, 'jsx'));
  }
  return nodes;
}

function parseStyleAstNodes(text, offset = 0) {
  const content = String(text || '');
  return pairedRanges(content, '{', '}').map(range => {
    const start = Math.max(0, content.lastIndexOf('\n', range.start) + 1);
    return {
      start: offset + start,
      end: offset + range.end,
      type: 'style-rule',
      name: 'style',
      depth: 0,
      rank: 86,
    };
  });
}

function parseVueSfcAstNodes(text) {
  const content = String(text || '');
  if (vueCompilerSfc) {
    try {
      const parsed = vueCompilerSfc.parse(content, { pad: false });
      const descriptor = parsed.descriptor || {};
      const nodes = [];
      for (const block of [descriptor.template, descriptor.script, descriptor.scriptSetup, ...(descriptor.styles || [])].filter(Boolean)) {
        const start = block.loc?.start?.offset ?? content.indexOf(block.content);
        const end = block.loc?.end?.offset ?? (start + String(block.content || '').length);
        if (start < 0 || end <= start) continue;
        pushAstNode(nodes, {
          start,
          end,
          type: `vue-${block.type || 'block'}`,
          name: block.type || 'block',
          depth: 0,
          rank: 45,
        });
        if (block.type === 'template') {
          if (vueCompilerDom) {
            try {
              const ast = vueCompilerDom.parse(block.content || '');
              traverseVueDomAst(ast, node => {
                const loc = node.loc || {};
                const nodeStart = loc.start?.offset;
                const nodeEnd = loc.end?.offset;
                if (typeof nodeStart === 'number' && typeof nodeEnd === 'number' && nodeEnd > nodeStart) {
                  pushAstNode(nodes, {
                    start: start + nodeStart,
                    end: start + nodeEnd,
                    type: 'vue-template-tag',
                    name: node.tag || node.type || 'template',
                    depth: 0,
                    rank: 100,
                  });
                }
              });
            } catch (error) {
              nodes.push(...parseMarkupAstNodes(block.content || '', start, 'vue-template'));
            }
          } else {
            nodes.push(...parseMarkupAstNodes(block.content || '', start, 'vue-template'));
          }
        }
        if (block.type === 'script') nodes.push(...parseScriptAstNodes(block.content || '', start, true));
        if (block.type === 'style') nodes.push(...parseStyleAstNodes(block.content || '', start));
      }
      return mergeAstNodes(nodes);
    } catch (error) {
    }
  }
  const nodes = [];
  const regex = /<(template|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let match;
  while ((match = regex.exec(content))) {
    const blockText = match[0];
    const blockStart = match.index;
    const openTag = parseMarkupTagAt(content, blockStart);
    if (!openTag) continue;
    const innerStart = blockStart + openTag.end - blockStart + 1;
    const closeStart = blockStart + blockText.lastIndexOf(`</${match[1]}`);
    const blockEnd = blockStart + blockText.length;
    const type = String(match[1] || '').toLowerCase();
    pushAstNode(nodes, {
      start: blockStart,
      end: blockEnd,
      type: `vue-${type}`,
      name: type,
      depth: 0,
      rank: 45,
    });
    const innerText = content.slice(innerStart, closeStart);
    if (type === 'template') nodes.push(...parseMarkupAstNodes(innerText, innerStart, 'vue-template'));
    if (type === 'script') nodes.push(...parseScriptAstNodes(innerText, innerStart, true));
    if (type === 'style') nodes.push(...parseStyleAstNodes(innerText, innerStart));
  }
  return nodes;
}

function traverseVueDomAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const child of node.children || []) traverseVueDomAst(child, visitor);
}

function parseSourceAstNodes(filePath, text) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  const content = String(text || '');
  const nodes = [];
  if (ext === '.vue') {
    nodes.push(...parseVueSfcAstNodes(content));
  } else if (MARKUP_EXTENSIONS.has(ext)) {
    nodes.push(...parseMarkupAstNodes(content, 0, 'html'));
  } else if (SCRIPT_EXTENSIONS.has(ext)) {
    nodes.push(...parseScriptAstNodes(content, 0, ext === '.jsx' || ext === '.tsx'));
  } else if (STYLE_EXTENSIONS.has(ext)) {
    nodes.push(...parseStyleAstNodes(content));
  } else {
    nodes.push(...parseScriptAstNodes(content, 0, true));
    nodes.push(...parseMarkupAstNodes(content, 0, 'html'));
  }
  return mergeAstNodes(nodes);
}

function astNodeRank(node) {
  const type = String(node?.type || '');
  if (type === 'babel-declaration') return 128;
  if (type === 'babel-jsx') return 116;
  if (type.includes('call')) return 110;
  if (type === 'babel-method' || type === 'babel-function') return 108;
  if (type.includes('tag')) return 100;
  if (type === 'babel-property') return 96;
  if (type.includes('style-rule')) return 92;
  if (type === 'babel-collection') return 88;
  if (type.includes('{}')) return 82;
  if (type.includes('[]')) return 76;
  if (type.includes('()')) return 64;
  if (type.startsWith('vue-')) return 42;
  return node?.rank || 20;
}

function mergeAstNodes(nodes) {
  const seen = new Set();
  return (nodes || [])
    .filter(node => node && node.end > node.start)
    .map(node => ({
      ...node,
      rank: astNodeRank(node),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end || b.rank - a.rank)
    .filter(node => {
      const key = `${node.start}:${node.end}:${node.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function astNodeRangeForAnchor(astNodes, anchor) {
  const start = anchor?.index || 0;
  const end = start + Math.max(1, anchor?.length || 1);
  const candidates = (astNodes || [])
    .filter(node => node.start <= start && end <= node.end)
    .filter(node => node.end - node.start <= Math.max(PRUNED_MODEL_FILE_CHARS, DIRECT_RELATED_CHARS * 2))
    .sort((a, b) => b.rank - a.rank || (a.end - a.start) - (b.end - b.start));
  return candidates[0] || null;
}

function callRangeForIndex(text, index, ranges) {
  const content = String(text || '');
  const parens = (ranges || [])
    .filter(range => range.type === '()' && range.start <= index && index < range.end)
    .sort((a, b) => (a.end - a.start) - (b.end - b.start));
  for (const range of parens) {
    const prefix = content.slice(Math.max(0, range.start - 80), range.start);
    const calleeMatch = prefix.match(/([A-Za-z_$][\w$.\])]*\s*)$/);
    if (!calleeMatch) continue;
    if (range.end - range.start > DIRECT_RELATED_CHARS * 2) continue;
    return includeDeclarationPrefix(content, {
      ...range,
      start: range.start - calleeMatch[1].length,
    });
  }
  return null;
}

function enclosingSyntaxRange(text, index) {
  const content = String(text || '');
  if (!content || index < 0) return null;
  const markupRange = markupTagRangeAt(content, index);
  if (markupRange) return markupRange;
  const lineStart = content.lastIndexOf('\n', index) + 1;
  const lineEndIndex = content.indexOf('\n', index);
  const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
  const lineRange = { start: lineStart, end: lineEnd, type: 'line' };
  const ranges = [
    ...pairedRanges(content, '{', '}'),
    ...pairedRanges(content, '[', ']'),
    ...pairedRanges(content, '(', ')'),
  ]
    .filter(range => range.start <= index && index < range.end)
    .sort((a, b) => (a.end - a.start) - (b.end - b.start));
  const callRange = callRangeForIndex(content, index, ranges);
  if (callRange) return callRange;
  const syntaxRange = ranges.find(range => range.end - range.start <= DIRECT_RELATED_CHARS * 2) || ranges[0];
  if (!syntaxRange) return lineRange;
  return includeDeclarationPrefix(content, syntaxRange);
}

function declarationRanges(content) {
  const source = String(content || '');
  const ranges = [
    ...pairedRanges(source, '{', '}'),
    ...pairedRanges(source, '[', ']'),
    ...pairedRanges(source, '(', ')'),
  ];
  const result = [];
  const declarationPattern = /\b(?:export\s+)?(?:default\s+)?(?:(?:async\s+)?function\s+[A-Za-z_$][\w$]*|class\s+[A-Za-z_$][\w$]*|(?:const|let|var)\s+[A-Za-z_$][\w$]*)\b/g;
  let match;
  while ((match = declarationPattern.exec(source))) {
    const headStart = match.index;
    const headEnd = match.index + match[0].length;
    const declarationText = match[0] || '';
    const searchStart = /\b(?:function|class)\b/.test(declarationText)
      ? headEnd
      : (() => {
        const eq = source.indexOf('=', headEnd);
        const lineEnd = source.indexOf('\n', headEnd);
        if (eq !== -1 && (lineEnd === -1 || eq < lineEnd)) return eq + 1;
        return headEnd;
      })();
    const structural = ranges
      .filter(range => range.start >= searchStart && range.start - searchStart < 2000)
      .filter(range => {
        if (/\b(?:function|class)\b/.test(declarationText)) return range.type === '{}';
        return true;
      })
      .sort((a, b) => a.start - b.start)[0];
    if (!structural) {
      const lineEndIndex = source.indexOf('\n', headEnd);
      result.push({
        start: headStart,
        end: lineEndIndex === -1 ? source.length : lineEndIndex,
        type: 'declaration-line',
      });
      continue;
    }
    let end = structural.end;
    while (end < source.length && /[\s;,\)]/.test(source[end] || '') && source[end] !== '\n') end++;
    result.push({
      start: headStart,
      end,
      type: 'declaration',
    });
  }
  return result;
}

function enclosingDeclarationRange(content, index, maxChars = PRUNED_MODEL_FILE_CHARS) {
  const source = String(content || '');
  if (!source || index < 0) return null;
  return declarationRanges(source)
    .filter(range => range.start <= index && index < range.end)
    .filter(range => range.end - range.start <= maxChars)
    .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0] || null;
}

function enclosingAstDeclarationRange(astNodes, index, maxChars = PRUNED_MODEL_FILE_CHARS) {
  return (astNodes || [])
    .filter(node => node.type === 'babel-declaration')
    .filter(node => node.start <= index && index < node.end)
    .filter(node => node.end - node.start <= maxChars)
    .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0] || null;
}

function includeDeclarationPrefix(content, range) {
  const source = String(content || '');
  if (!range || range.start <= 0) return range;
  let start = range.start;
  let cursor = start - 1;
  for (let depth = 0; depth < 4 && cursor >= 0; depth++) {
    const lineStart = source.lastIndexOf('\n', cursor) + 1;
    const fragment = source.slice(lineStart, start);
    const trimmed = fragment.trim();
    if (!trimmed) {
      cursor = lineStart - 2;
      continue;
    }
    const looksLikeDeclaration = /(?:\b(?:export\s+)?(?:const|let|var|return|function|class)\b|=\s*$|:\s*$|=>\s*$)/.test(trimmed);
    if (!looksLikeDeclaration) break;
    start = lineStart;
    cursor = lineStart - 2;
  }
  return { ...range, start };
}

function mergeRanges(ranges, limit = MAX_MODEL_FILES) {
  const sorted = ranges
    .filter(range => range && range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }
    last.end = Math.max(last.end, range.end);
    if ((range.anchorWeight || 0) > (last.anchorWeight || 0)) {
      last.anchorWeight = range.anchorWeight;
      last.anchorLabel = range.anchorLabel || last.anchorLabel;
      last.anchorNeedle = range.anchorNeedle || last.anchorNeedle;
    }
  }
  return merged.slice(0, limit);
}

function candidateHitForFile(body, filePath) {
  const normalized = normalizeModelFilePath(filePath);
  const pools = [
    body.selectedCandidateHits || [],
    body.candidateHits || [],
    body.routeResolver?.hits || [],
  ];
  for (const pool of pools) {
    const hit = pool.find(item => String(item?.file || '').replace(/\\/g, '/').replace(/^\/+/, '') === normalized);
    if (hit) return hit;
  }
  return null;
}

function routeEntryFiles(body) {
  const hits = Array.isArray(body?.routeResolver?.hits) ? body.routeResolver.hits : [];
  return uniq(hits
    .map(hit => normalizeModelFilePath(hit?.file))
    .filter(Boolean))
    .slice(0, 4);
}

function hitStages(hit) {
  return uniq([...(hit?.stages || []), hit?.stage].filter(Boolean));
}

function isPageScopedHit(hit, routeEntries) {
  if (!hit?.file || !routeEntries?.length) return true;
  const file = normalizeModelFilePath(hit.file);
  const routeSet = new Set(routeEntries);
  if (routeSet.has(file)) return true;
  const chain = (hit.importChain || []).map(normalizeModelFilePath).filter(Boolean);
  if (chain.some(item => routeSet.has(item))) return true;
  if (routeSet.has(normalizeModelFilePath(hit.anchorFile))) return true;
  return hitStages(hit).includes('route-import-chain');
}

function hasStrongSelectionEvidence(hit) {
  if (!hit) return false;
  if (hit.preciseEvidence || hit.uniqueMatchText) return true;
  if ((hit.contextScore || 0) >= 42 && (hit.contextStrongMatchCount || 0) >= 2) return true;
  if ((hit.contextScore || 0) >= 34 && (hit.contextReasons || []).some(reason => /资源线索|className|样式|属性/.test(reason))) return true;
  if ((hit.contextScore || 0) >= 24 && (hit.contextReasons || []).some(reason => /className/.test(reason))) return true;
  if ((hit.exactMatchCount || 0) === 1 && (hit.contextScore || 0) >= 18) return true;
  return false;
}

function hasDirectSelectionEvidence(hit) {
  if (!hit) return false;
  if (hit.preciseEvidence) return true;
  if (hit.exactMatchText || hit.uniqueMatchText) return true;
  if ((hit.contextScore || 0) > 0 || (hit.contextStrongMatchCount || 0) > 0) return true;
  if ((hit.contextReasons || []).length) return true;
  return false;
}

function stableLocalModelCandidate(body) {
  const byFile = new Map();
  for (const hit of [...(body.selectedCandidateHits || []), ...(body.candidateHits || [])]) {
    const file = normalizeModelFilePath(hit?.file);
    if (!file || !isSelectionMatchedHit(hit)) continue;
    const stages = hitStages(hit);
    if (stages.includes('context-hypothesis-demoted')) continue;
    if (stages.includes('context-hypothesis-related') && !stages.includes('original-selection-verified')) continue;
    if (hitStages(hit).includes('route-resolver') && !(hit.contextScore || hit.preciseEvidence || hit.exactMatchText)) continue;
    const old = byFile.get(file);
    if (!old || Number(old.score || 0) < Number(hit.score || 0)) {
      byFile.set(file, { ...hit, file });
    }
  }
  const sorted = Array.from(byFile.values()).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const top = sorted[0];
  const second = sorted[1];
  if (!top) return null;
  if (top.relationshipPromoted) return null;
  if (top.i18nEvidence || top.i18nDefinitionFile || hitStages(top).some(stage => /^i18n-/.test(stage))) return null;
  const hasPreciseLocalEvidence = top.preciseEvidence
    || top.exactMatchText
    || top.uniqueMatchText
    || Number(top.contextStrongMatchCount || 0) >= 2;
  if (!hasPreciseLocalEvidence) return null;
  const topScore = Number(top.score || 0);
  const secondScore = Number(second?.score || 0);
  if (topScore >= 220 && (!second || topScore - secondScore >= 60)) {
    return top;
  }
  return null;
}

function i18nRelatedCandidateHits(body) {
  const trace = body?.i18nTrace;
  if (!trace?.active) return [];
  const hits = [];
  for (const definition of trace.definitions || []) {
    const file = normalizeModelFilePath(definition?.file);
    if (!file) continue;
    hits.push({
      file,
      score: 260,
      stage: 'i18n-definition-context',
      stages: ['i18n-definition-context'],
      from: '',
      i18nEvidence: true,
      i18nKey: definition.keyPath || '',
      i18nText: definition.phrase || '',
      i18nDefinitionFile: file,
      preciseEvidence: true,
      exactMatchText: definition.phrase || '',
      uniqueMatchText: definition.phrase || '',
      snippet: definition.snippet || '',
      preciseSnippet: definition.snippet || '',
      uniqueSnippet: definition.snippet || '',
      contextScore: 80,
      contextReasons: [`国际化定义上下文：${definition.keyPath || ''} = ${definition.phrase || ''}`],
      reasons: [
        `国际化定义文件：${file}`,
        `国际化 key：${definition.keyPath || ''} = ${definition.phrase || ''}`,
      ],
    });
  }
  for (const usage of trace.usages || []) {
    const file = normalizeModelFilePath(usage?.file);
    if (!file) continue;
    hits.push({
      ...usage,
      file,
      stage: usage.stage || 'i18n-usage-context',
      stages: mergeList(usage.stages || usage.stage, 'i18n-usage-context'),
      score: Math.max(usage.score || 0, 300),
      preciseEvidence: true,
    });
  }
  return hits;
}

function definitionRelatedCandidateHits(body) {
  const hits = [];
  const trace = body?.definitionTrace;
  for (const definition of trace?.definitions || []) {
    const file = normalizeModelFilePath(definition?.file);
    if (!file) continue;
    hits.push({
      file,
      score: 240,
      stage: 'definition-context',
      stages: ['definition-context'],
      from: '',
      definitionEvidence: true,
      definitionFile: file,
      definitionSymbol: definition.symbol || '',
      definitionKeyPath: definition.keyPath || '',
      definitionText: definition.phrase || '',
      preciseEvidence: true,
      exactMatchText: definition.phrase || '',
      uniqueMatchText: definition.phrase || '',
      snippet: definition.snippet || '',
      preciseSnippet: definition.snippet || '',
      uniqueSnippet: definition.snippet || '',
      contextScore: 70,
      contextReasons: [`字面量定义上下文：${definition.symbol || definition.keyPath || ''}`],
      reasons: [
        `字面量定义文件：${file}`,
        definition.symbol ? `定义符号：${definition.symbol}` : '',
        definition.keyPath ? `定义 key：${definition.keyPath}` : '',
        `定义文案：${definition.phrase || ''}`,
      ].filter(Boolean),
    });
  }
  for (const hit of [...(body?.selectedCandidateHits || []), ...(body?.candidateHits || [])]) {
    const file = normalizeModelFilePath(hit?.definitionFile);
    if (!file) continue;
    hits.push({
      file,
      score: 240,
      stage: 'definition-context',
      stages: ['definition-context'],
      from: normalizeModelFilePath(hit.file),
      definitionEvidence: true,
      definitionFile: file,
      definitionSymbol: hit.definitionSymbol || '',
      definitionKeyPath: hit.definitionKeyPath || '',
      definitionText: hit.definitionText || hit.exactMatchText || '',
      preciseEvidence: true,
      exactMatchText: hit.definitionText || hit.exactMatchText || '',
      uniqueMatchText: hit.definitionText || hit.uniqueMatchText || '',
      snippet: hit.exactSnippet || hit.uniqueSnippet || hit.snippet || '',
      preciseSnippet: hit.exactSnippet || hit.uniqueSnippet || hit.snippet || '',
      uniqueSnippet: hit.uniqueSnippet || hit.exactSnippet || hit.snippet || '',
      contextScore: 70,
      contextReasons: [`字面量定义上下文：${hit.definitionSymbol || hit.definitionKeyPath || ''}`],
      reasons: [
        `字面量定义文件：${file}`,
        hit.definitionSymbol ? `定义符号：${hit.definitionSymbol}` : '',
        hit.definitionKeyPath ? `定义 key：${hit.definitionKeyPath}` : '',
        hit.definitionText ? `定义文案：${hit.definitionText}` : '',
      ].filter(Boolean),
    });
  }
  return hits;
}

function modelCandidateHits(body, logs) {
  const routeEntries = body?.routeResolver?.matched ? routeEntryFiles(body) : [];
  const selectedSet = new Set((body.selectedCandidateHits || []).map(hit => normalizeModelFilePath(hit?.file)).filter(Boolean));
  const directEvidenceExists = [...(body.selectedCandidateHits || []), ...(body.candidateHits || [])]
    .some(hit => hasDirectSelectionEvidence(hit));
  const merged = [];
  const skipped = [];
  const seen = new Set();
  const push = (hit, source) => {
    const file = normalizeModelFilePath(hit?.file);
    if (!file || seen.has(file)) return;
    const normalizedHit = { ...hit, file };
    const pageScoped = isPageScopedHit(normalizedHit, routeEntries);
    const strong = hasStrongSelectionEvidence(normalizedHit);
    const direct = hasDirectSelectionEvidence(normalizedHit);
    const routeEntry = routeEntries.includes(file);
    if (routeEntries.length && !pageScoped && !direct && !routeEntry) {
      skipped.push(file);
      return;
    }
    seen.add(file);
    merged.push({
      ...normalizedHit,
      modelCandidateSource: source,
      pageScoped,
      directSelectionEvidence: direct,
      strongSelectionEvidence: strong,
      selectedForModel: selectedSet.has(file),
    });
  };

  const stableLocalHit = stableLocalModelCandidate(body);
  if (stableLocalHit) {
    push(stableLocalHit, 'stable-local');
    if (Array.isArray(logs)) {
      appendLog(logs, `本地稳定候选：${stableLocalHit.file}；分数 ${stableLocalHit.score || 0}，模型只读取该文件以避免同名候选干扰`);
    }
    return merged;
  }

  if (routeEntries.length) {
    for (const file of routeEntries) {
      const hit = candidateHitForFile(body, file) || {
        file,
        score: 0,
        stage: 'route-resolver',
        stages: ['route-resolver'],
        reasons: ['页面源码入口'],
      };
      if (directEvidenceExists && !hasDirectSelectionEvidence(hit) && !selectedSet.has(file)) {
        skipped.push(file);
        continue;
      }
      push(hit, 'route-entry');
    }
  }
  for (const hit of body.selectedCandidateHits || []) push(hit, 'selected');
  for (const hit of body.candidateHits || []) {
    if (!routeEntries.length && !isSelectionMatchedHit(hit)) continue;
    if (routeEntries.length && !isSelectionMatchedHit(hit) && !isPageScopedHit(hit, routeEntries)) continue;
    push(hit, 'candidate');
  }
  for (const hit of i18nRelatedCandidateHits(body)) push(hit, 'i18n-context');
  for (const hit of definitionRelatedCandidateHits(body)) push(hit, 'definition-context');

  if (routeEntries.length && Array.isArray(logs)) {
    appendLog(logs, `页面源码范围：${routeEntries.join('，')}；模型只读取页面入口、页面 import 链路或强选区证据候选`);
    if (skipped.length) {
      appendLog(logs, `页面范围过滤：跳过 ${uniq(skipped).length} 个弱关联候选：${uniq(skipped).slice(0, 8).join('；')}`);
    }
  }
  return merged;
}

function isSelectionMatchedHit(hit) {
  if (!hit || !hit.file) return false;
  if (hit.preciseEvidence || hit.exactMatchText || hit.uniqueMatchText) return true;
  if ((hit.contextScore || 0) > 0 || (hit.contextStrongMatchCount || 0) > 0) return true;
  if ((hit.contextReasons || []).length) return true;
  return (hit.stages || [hit.stage].filter(Boolean)).includes('keyword');
}

function buildExcerptNeedles(payload, hit) {
  const map = new Map();

  addNeedle(map, hit?.preciseSnippet, 520, '精准片段');
  addNeedle(map, hit?.uniqueSnippet, 500, '唯一片段');
  addNeedle(map, hit?.snippet, 260, '候选片段');
  addNeedle(map, hit?.exactMatchText, 920, '精确文案');
  addNeedle(map, hit?.uniqueMatchText, 900, '唯一文案');

  for (const item of hit?.matched || []) {
    const evidence = item?.evidence || {};
    const value = evidence.value;
    if (!value) continue;
    const label = evidence.label || `本地命中证据(${evidence.kind || 'unknown'})`;
    const bridge = /桥接证据/.test(String(label || ''));
    const exact = evidence.kind === 'text' || evidence.kind === 'attr';
    addNeedle(map, value, bridge ? 1060 : exact ? 900 : 620, label);
    addNeedle(map, item.snippet, bridge ? 980 : 520, `${label}片段`);
  }
  for (const seed of reasonAnchorSeeds(hit?.reasons || [])) {
    addNeedle(map, seed.text, seed.weight, seed.label);
  }

  for (const selection of payload?.selections || []) {
    const info = selection?.element || {};
    const expandedInfos = [
      selection?.asset,
      selection?.expanded,
      selection?.expandedContext,
    ].filter(Boolean);
    const tag = String(info.tag || '').toLowerCase();
    const attrs = info.attrs || {};
    const style = info.computedStyle || {};

    addNeedle(map, info.text, 880, '选区文案');
    addNeedle(map, info.className, 720, '选区 className');
    for (const token of tokenize(info.className).slice(0, 8)) {
      addNeedle(map, token, 620, '选区 class token');
    }
    for (const seed of usefulAttrSeedsFromInfo(info, 18)) {
      addNeedle(map, seed.value, 520, seed.label);
    }
    for (const seed of usefulStyleSeedsFromStyle(style, info.inlineStyle, 18)) {
      addNeedle(map, seed, 600, '选区 CSS/样式');
    }
    for (const seed of resourceSeedValuesFromInfo(info).slice(0, 12)) {
      addNeedle(map, seed, weakSelectionSeed(seed) ? 40 : 420, '选区图片/资源线索');
    }
    addSubtreeNeedles(map, info.subtree, '选区向下', {
      classWeight: 620,
      textWeight: 760,
      attrWeight: 500,
      styleWeight: 560,
      resourceWeight: 400,
    });

    for (const expanded of expandedInfos) {
      addNeedle(map, expanded?.text || expanded?.searchText, 760, '扩区文案');
      addNeedle(map, expanded?.className, 560, '扩区 className');
      for (const token of tokenize(expanded?.className).slice(0, 8)) {
        addNeedle(map, token, 500, '扩区 class token');
      }
      for (const seed of usefulAttrSeedsFromInfo(expanded, 12)) {
        addNeedle(map, seed.value, 420, `扩区${seed.label.replace(/^选区/, '')}`);
      }
      for (const seed of usefulStyleSeedsFromStyle(expanded?.computedStyle || {}, expanded?.inlineStyle || '', 12)) {
        addNeedle(map, seed, 460, '扩区 CSS/样式');
      }
      addSubtreeNeedles(map, expanded?.subtree, '扩区向下', {
        classWeight: 500,
        textWeight: 680,
        attrWeight: 420,
        styleWeight: 420,
        resourceWeight: 340,
      });
    }

    for (const ancestor of (info.ancestors || []).slice(0, 4)) {
      addNeedle(map, ancestor?.text, 700, '父级文案');
      addNeedle(map, ancestor?.className, 560, '父级 className');
      for (const token of tokenize(ancestor?.className).slice(0, 6)) {
        addNeedle(map, token, 500, '父级 class token');
      }
      for (const seed of usefulAttrSeedsFromInfo(ancestor, 12)) {
        addNeedle(map, seed.value, 420, `父级${seed.label.replace(/^选区/, '')}`);
      }
      for (const seed of usefulStyleSeedsFromStyle(ancestor?.computedStyle || {}, ancestor?.inlineStyle || '', 12)) {
        addNeedle(map, seed, 460, '父级 CSS/样式');
      }
      for (const seed of resourceSeedValuesFromInfo(ancestor).slice(0, 8)) {
        addNeedle(map, seed, weakSelectionSeed(seed) ? 32 : 340, '父级图片/资源线索');
      }
      addSubtreeNeedles(map, ancestor?.subtree, '父级向下', {
        classWeight: 460,
        textWeight: 620,
        attrWeight: 380,
        styleWeight: 420,
        resourceWeight: 320,
      });
    }

    const widthValues = uniq([
      attrs.width,
      numericStyleValue(style.width),
    ]).filter(Boolean);
    const heightValues = uniq([
      attrs.height,
      numericStyleValue(style.height),
    ]).filter(Boolean);

    for (const value of widthValues) {
      addNeedle(map, `width: ${value}`, 620, '宽度样式');
      addNeedle(map, `width="${value}"`, 520, '宽度属性');
      addNeedle(map, `width: '${value}px'`, 640, '宽度样式');
      addNeedle(map, `width: "${value}px"`, 640, '宽度样式');
    }
    for (const value of heightValues) {
      addNeedle(map, `height: ${value}`, 620, '高度样式');
      addNeedle(map, `height="${value}"`, 520, '高度属性');
      addNeedle(map, `height: '${value}px'`, 640, '高度样式');
      addNeedle(map, `height: "${value}px"`, 640, '高度样式');
    }

    if (style.objectFit) {
      addNeedle(map, `objectFit: '${style.objectFit}'`, 560, 'objectFit 样式');
      addNeedle(map, `objectFit: "${style.objectFit}"`, 560, 'objectFit 样式');
      addNeedle(map, `object-fit: ${style.objectFit}`, 540, 'object-fit 样式');
    }
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      addNeedle(map, 'backgroundImage', 520, 'backgroundImage 样式');
      addNeedle(map, 'background-image', 520, 'background-image 样式');
      addNeedle(map, 'background', 420, 'background 样式');
      addNeedle(map, 'image', 300, 'background image');
    }
    if (style.backgroundSize) {
      addNeedle(map, `backgroundSize: '${style.backgroundSize}'`, 500, 'backgroundSize 样式');
      addNeedle(map, `background-size: ${style.backgroundSize}`, 480, 'background-size 样式');
    }
    if (style.borderRadius) {
      addNeedle(map, `borderRadius: '${style.borderRadius}'`, 500, 'borderRadius 样式');
      addNeedle(map, `borderRadius: "${style.borderRadius}"`, 500, 'borderRadius 样式');
      addNeedle(map, `border-radius: ${style.borderRadius}`, 480, 'border-radius 样式');
    }

    if (tag === 'img') {
      addNeedle(map, 'NImage', 420, '图片组件');
      addNeedle(map, 'h(NImage', 430, '图片 render 组件');
      addNeedle(map, `h('img'`, 400, 'img render');
      addNeedle(map, '<img', 380, 'img tag');
      addNeedle(map, 'n-image', 360, 'img wrapper');
    }
  }

  return Array.from(map.values())
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || b.weight - a.weight || b.needle.length - a.needle.length)
    .slice(0, 48);
}

function scoreNeedleMatches(text, needles) {
  const lowerText = String(text || '').toLowerCase();
  if (!lowerText || !needles.length) return 0;
  let score = 0;
  let matchedCount = 0;
  for (const item of needles) {
    if (!lowerText.includes(item.needle.toLowerCase())) continue;
    score += item.weight;
    matchedCount++;
  }
  if (matchedCount >= 3) score += Math.min(60, matchedCount * 10);
  return score;
}

function bestWindowExcerpt(text, needles, maxChars) {
  const content = String(text || '');
  if (!content || !needles.length) return null;
  const lines = content.split('\n');
  if (!lines.length) return null;
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }

  const windowSize = 28;
  let best = null;
  for (let start = 0; start < lines.length; start++) {
    const end = Math.min(lines.length, start + windowSize);
    const windowText = lines.slice(start, end).join('\n');
    const lowerWindow = windowText.toLowerCase();
    const matched = [];
    const score = scoreNeedleMatches(windowText, needles);
    for (const item of needles) {
      if (!lowerWindow.includes(item.needle.toLowerCase())) continue;
      matched.push(`${item.label}:${item.needle}`);
    }
    if (matched.length < 2 && score < 180) continue;
    if (!best || score > best.score) {
      best = {
        score,
        start: offsets[start],
        end: offsets[end - 1] + lines[end - 1].length,
        matched: matched.slice(0, 6),
      };
    }
  }

  if (!best || best.score < MIN_FOCUSED_WINDOW_SCORE) return null;
  return {
    text: rangeExcerpt(content, best.start, best.end, maxChars),
    mode: 'focused-window',
    note: `命中锚点 ${best.matched.join('；')}`,
    score: best.score,
  };
}

function pickRelevantExcerpt(text, payload, hit, maxChars) {
  const content = String(text || '');
  if (!content) {
    return { text: '', mode: 'empty', note: '' };
  }
  if (content.length <= maxChars) {
    return {
      text: content,
      mode: 'full',
      note: '文件较小，直接使用完整内容',
      score: scoreNeedleMatches(content, buildExcerptNeedles(payload, hit)),
    };
  }

  const snippetSeeds = [
    hit?.preciseSnippet,
    hit?.uniqueSnippet,
    hit?.snippet,
    hit?.exactMatchText,
    hit?.uniqueMatchText,
  ].filter(Boolean);
  const needles = buildExcerptNeedles(payload, hit);

  for (const seed of snippetSeeds) {
    const index = findSnippetIndex(content, seed);
    if (index === -1) continue;
    const excerptText = aroundIndexExcerpt(content, index, String(seed).trim().length, maxChars);
    return {
      text: excerptText,
      mode: 'focused-snippet',
      note: '围绕候选命中片段截取',
      score: scoreNeedleMatches(excerptText, needles),
    };
  }

  const window = bestWindowExcerpt(content, needles, maxChars);
  if (window) return window;

  const headText = rangeExcerpt(content, 0, Math.min(content.length, maxChars), maxChars);
  return {
    text: headText,
    mode: 'head',
    note: '未找到稳定锚点，回退为文件头片段',
    score: scoreNeedleMatches(headText, needles),
  };
}

function parseMarkupTagAt(content, index) {
  if (content[index] !== '<') return null;
  if (content.startsWith('<!--', index)) {
    const end = content.indexOf('-->', index + 4);
    return {
      end: end === -1 ? content.length - 1 : end + 2,
      type: 'comment',
    };
  }
  if (content[index + 1] === '!' || content[index + 1] === '?') {
    const end = content.indexOf('>', index + 1);
    return {
      end: end === -1 ? content.length - 1 : end,
      type: 'meta',
    };
  }
  let quote = '';
  let escaped = false;
  let braceDepth = 0;
  let tagEnd = -1;
  for (let cursor = index + 1; cursor < content.length; cursor++) {
    const char = content[cursor];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      braceDepth++;
      continue;
    }
    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (char === '>' && braceDepth === 0) {
      tagEnd = cursor;
      break;
    }
  }
  if (tagEnd === -1) return null;
  const raw = content.slice(index, tagEnd + 1);
  const match = raw.match(/^<\/?\s*([A-Za-z][\w:.-]*)\b/);
  if (!match) return null;
  const name = String(match[1] || '').toLowerCase();
  const closing = /^<\//.test(raw);
  const selfClosing = /\/\s*>$/.test(raw) || VOID_TAGS.has(name);
  return {
    start: index,
    end: tagEnd,
    type: 'tag',
    name,
    closing,
    selfClosing,
  };
}

function cleanModelSymbol(value) {
  const symbol = String(value || '').trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(symbol)) return '';
  if (symbol.length < 3 || symbol.length > 80) return '';
  if (GENERIC_MODEL_SYMBOLS.has(symbol.toLowerCase())) return '';
  return symbol;
}

function styleSeedValuesFromInfo(info) {
  const style = info?.computedStyle || {};
  return uniq([
    ...usefulStyleSeedsFromStyle(style, info?.inlineStyle, 18),
    style.objectFit,
    style.borderRadius,
    style.backgroundSize,
    style.backgroundPosition,
    style.backgroundRepeat,
    ...(style.backgroundImage && style.backgroundImage !== 'none' ? ['background-image', 'backgroundImage', 'background', 'image'] : []),
    ...resourceSeedValuesFromInfo(info),
  ]
    .map(value => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(value => value.length >= 3 && value.length <= 180 && value !== '[present]' && !/^\d+(?:px)?$/i.test(value)))
    .slice(0, 24);
}

function selectionAnchorSeedItems(payload) {
  const items = [];
  const add = (value, weight, label) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2 || text.length > 180 || text === '[present]' || /^\d+(?:px)?$/i.test(text)) return;
    items.push({ text, weight, label, priority: pruneEvidencePriority(label) });
  };
  for (const selection of payload?.selections || []) {
      const infos = [
        selection?.element,
        selection?.asset,
        ...(selection?.element?.ancestors || []),
      ].filter(Boolean);
      for (const info of infos) {
        add(infoSearchText(info), 760, '选区/父级文案');
        for (const token of tokenize(infoSearchText(info)).slice(0, 16)) add(token, 460, '选区/父级文本 token');
        add(info?.className, 620, '选区/父级 CSS class');
        for (const token of tokenize(info?.className).slice(0, 10)) add(token, 520, '选区/父级 CSS class token');
        for (const seed of usefulStyleSeedsFromStyle(info?.computedStyle || {}, info?.inlineStyle || '', 18)) add(seed, 560, '选区/父级 CSS/样式');
        for (const seed of usefulAttrSeedsFromInfo(info, 18)) add(seed.value, 430, seed.label.replace(/^选区/, '选区/父级'));
        for (const seed of resourceSeedValuesFromInfo(info).slice(0, 12)) add(seed, weakSelectionSeed(seed) ? 36 : 360, '选区/父级资源');
        for (const node of (info?.subtree?.nodes || []).slice(0, 24)) {
          add(infoSearchText(node), 640, '扩区子节点文案');
          for (const token of tokenize(infoSearchText(node)).slice(0, 8)) add(token, 380, '扩区子节点文本 token');
          add(node?.className, 460, '扩区子节点 CSS class');
          for (const token of tokenize(node?.className).slice(0, 6)) add(token, 400, '扩区子节点 CSS class token');
          for (const seed of usefulAttrSeedsFromInfo(node, 8)) add(seed.value, 340, seed.label.replace(/^选区/, '扩区子节点'));
          for (const seed of usefulStyleSeedsFromStyle(node?.computedStyle || {}, node?.inlineStyle || '', 8)) add(seed, 360, '扩区子节点 CSS/样式');
        }
      }
  }
  const merged = new Map();
  for (const item of items) {
    const key = item.text.toLowerCase();
    const old = merged.get(key);
    if (!old || old.priority < item.priority || (old.priority === item.priority && old.weight < item.weight)) {
      merged.set(key, item);
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => b.priority - a.priority || b.weight - a.weight || b.text.length - a.text.length)
    .slice(0, 80);
}

function selectionAnchorSeeds(payload) {
  return selectionAnchorSeedItems(payload).map(item => item.text);
}

function completeRangeText(content, range) {
  const source = String(content || '');
  if (!range || range.end <= range.start) return '';
  return source.slice(Math.max(0, range.start), Math.min(source.length, range.end)).trim();
}

function isCommentOnlyRangeText(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return text.startsWith('//') || text.startsWith('/*') || text.startsWith('<!--');
}

function weightedAnchorSeeds(hit, payload, needles) {
  const map = new Map();
  const add = (seed, weight, label) => {
    const raw = String(seed || '').trim();
    const text = /片段/.test(String(label || '')) ? raw : raw.replace(/\s+/g, ' ').trim();
    if (!text || text === '[present]' || text.length < 2) return;
    const key = text.toLowerCase();
    const old = map.get(key);
    const priority = pruneEvidencePriority(label);
    if (!old || old.priority < priority || (old.priority === priority && old.weight < weight)) {
      map.set(key, { text, weight, label, priority });
    }
  };

  add(hit?.preciseSnippet, 1000, '本地精准片段');
  add(hit?.uniqueSnippet, 940, '本地唯一片段');
  add(hit?.exactMatchText, 880, '精确文案');
  add(hit?.uniqueMatchText, 860, '唯一文案');
  add(hit?.snippet, 520, '候选片段');

  for (const item of hit?.matched || []) {
    const evidence = item?.evidence || {};
    const value = evidence.value;
    if (!value) continue;
    const label = evidence.label || `本地命中证据(${evidence.kind || 'unknown'})`;
    const bridge = /桥接证据/.test(String(label || ''));
    const exact = evidence.kind === 'text' || evidence.kind === 'attr';
    add(value, bridge ? 1060 : exact ? 900 : 620, label);
    if (item.snippet) add(item.snippet, bridge ? 980 : 520, `${label}片段`);
  }
  for (const seed of reasonAnchorSeeds(hit?.reasons || [])) {
    add(seed.text, seed.weight, seed.label);
  }

  for (const seed of selectionAnchorSeedItems(payload)) {
    add(seed.text, weakSelectionSeed(seed.text) ? 18 : seed.weight, seed.label);
  }
  for (const item of needles || []) {
    add(item.needle, item.weight || 0, item.label || '检索锚点');
  }

  return Array.from(map.values())
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || b.weight - a.weight || b.text.length - a.text.length)
    .slice(0, 80);
}

function reasonAnchorSeeds(reasons) {
  const seeds = [];
  for (const reason of reasons || []) {
    const text = String(reason || '');
    const matched = text.match(/强证据命中\((text|attr)\)：(.+)$/);
    if (matched && matched[2]) {
      seeds.push({
        text: matched[2].trim(),
        weight: 1040,
        label: '本地候选原因桥接证据',
      });
    }
  }
  return seeds;
}

function semanticRangeKey(range) {
  if (!range) return '';
  return `${range.start}:${range.end}`;
}

function rangeAroundAnchor(rawText, astNodes, anchor) {
  const bridgeAnchor = /桥接证据/.test(String(anchor?.label || ''))
    || /^(?:key|dataIndex)\s*:/.test(String(anchor?.needle || '').trim());
  if (bridgeAnchor) {
    const objectRange = enclosingObjectRange(rawText, anchor?.index || 0);
    if (objectRange) return objectRange;
  }
  const astRange = astNodeRangeForAnchor(astNodes, anchor);
  const syntaxRange = astRange || enclosingSyntaxRange(rawText, anchor.index);
  const baseRange = syntaxRange || { start: anchor.index, end: anchor.index + anchor.length };
  const siblingRange = siblingContextRange(rawText, baseRange, anchor);
  if (siblingRange) return siblingRange;
  const declarationRange = enclosingAstDeclarationRange(astNodes, anchor.index) || enclosingDeclarationRange(rawText, anchor.index);
  if (!declarationRange) return baseRange;
  if (declarationRange.start <= baseRange.start && baseRange.end <= declarationRange.end) {
    return declarationRange;
  }
  return baseRange;
}

function siblingContextRange(text, baseRange, anchor) {
  const source = String(text || '');
  if (!source || !baseRange || baseRange.end <= baseRange.start) return null;
  const label = String(anchor?.label || '');
  if (!/(文案|结构化证据|资源)/.test(label) || /CSS|样式|class/i.test(label)) return null;
  const baseSize = baseRange.end - baseRange.start;
  if (baseSize > 1600) return null;
  const parents = [
    ...pairedRanges(source, '[', ']'),
    ...pairedRanges(source, '(', ')'),
    ...pairedRanges(source, '{', '}'),
  ]
    .filter(range => range.start <= baseRange.start && baseRange.end <= range.end)
    .filter(range => {
      const size = range.end - range.start;
      if (size <= baseSize || size > 3600) return false;
      const inner = source.slice(range.start, range.end);
      return inner.includes(',') || inner.includes('\n');
    })
    .sort((a, b) => (a.end - a.start) - (b.end - b.start));
  const parent = parents[0];
  return parent ? includeDeclarationPrefix(source, parent) : null;
}

function enclosingObjectRange(text, index, maxChars = PRUNED_MODEL_FILE_CHARS) {
  const content = String(text || '');
  if (!content || index < 0) return null;
  const range = pairedRanges(content, '{', '}')
    .filter(item => item.start <= index && index < item.end)
    .filter(item => item.end - item.start <= maxChars)
    .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
  if (!range) return null;
  return includeDeclarationPrefix(content, range);
}

function declaredSymbolsFromText(value, limit = 12) {
  const source = String(value || '');
  const ast = parseBabelAst(source, '.ts');
  if (ast) {
    const result = [];
    const seen = new Set();
    traverseBabelAst(ast, node => {
      if (result.length >= limit) return;
      let symbol = '';
      if (node.type === 'VariableDeclarator') symbol = node.id?.name || '';
      if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') symbol = node.id?.name || '';
      symbol = cleanModelSymbol(symbol);
      if (!symbol || seen.has(symbol)) return;
      seen.add(symbol);
      result.push(symbol);
    });
    if (result.length) return result;
  }
  const result = [];
  const seen = new Set();
  const patterns = [
    /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g,
    /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/g,
    /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) && result.length < limit) {
      const symbol = cleanModelSymbol(match[1]);
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      result.push(symbol);
    }
  }
  return result;
}

function babelIdentifierPositions(text, symbols, filePath = '.ts') {
  const symbolSet = new Set((symbols || []).map(cleanModelSymbol).filter(Boolean));
  if (!symbolSet.size) return [];
  const ast = parseBabelAst(text, filePath);
  if (!ast) return [];
  const positions = [];
  traverseBabelAst(ast, (node, parent) => {
    if (node.type !== 'Identifier') return;
    const name = cleanModelSymbol(node.name);
    if (!name || !symbolSet.has(name)) return;
    if (parent?.type === 'VariableDeclarator' && parent.id === node) return;
    if ((parent?.type === 'FunctionDeclaration' || parent?.type === 'ClassDeclaration') && parent.id === node) return;
    positions.push({
      index: node.start,
      length: Math.max(1, node.end - node.start),
      symbol: name,
    });
  });
  return positions;
}

function symbolUsageRanges(rawText, astNodes, symbols, existingRanges) {
  const source = String(rawText || '');
  const existing = existingRanges || [];
  const ranges = [];
  const seen = new Set();
  const insideCompactExisting = index => existing.some(range => {
    const size = range.end - range.start;
    return size <= DIRECT_RELATED_CHARS * 2 && range.start <= index && index < range.end;
  });
  const usageItems = babelIdentifierPositions(source, symbols).length
    ? babelIdentifierPositions(source, symbols)
    : (symbols || []).map(cleanModelSymbol).filter(Boolean).slice(0, 12).flatMap(symbol => {
      const items = [];
      const pattern = new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'g');
      let match;
      while ((match = pattern.exec(source)) && items.length < 8) {
        items.push({ index: match.index, length: symbol.length, symbol });
      }
      return items;
    });
  const countBySymbol = new Map();
  for (const item of usageItems) {
      const count = countBySymbol.get(item.symbol) || 0;
      if (count >= 8) continue;
      if (insideCompactExisting(item.index)) continue;
      const range = rangeAroundAnchor(source, astNodes, {
        index: item.index,
        length: item.length,
        needle: item.symbol,
        weight: 780,
        label: '定义符号的一层使用',
      });
      const key = semanticRangeKey(range);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      ranges.push({
        ...range,
        anchorWeight: 780,
        anchorLabel: '定义符号的一层使用',
        anchorNeedle: item.symbol,
      });
      countBySymbol.set(item.symbol, count + 1);
  }
  return ranges.slice(0, 16);
}

function pruneFileForModel(project, filePath, hit, payload, textCache) {
  const file = projectFile(project, filePath);
  if (!file || !isTextFile(file.path)) return null;
  const rawText = readProjectText(project, file, textCache || new Map());
  if (!rawText) return null;
  const astNodes = parseSourceAstNodes(file.path, rawText);
  const needles = buildExcerptNeedles(payload, hit);
  const seedItems = weightedAnchorSeeds(hit, payload, needles);

  const anchors = [];
  const seenAnchors = new Set();
  const addAnchor = (index, length, seed) => {
    if (index < 0) return;
    const key = `${index}:${length}`;
    if (seenAnchors.has(key)) return;
    seenAnchors.add(key);
    anchors.push({
      index,
      length: Math.max(1, length || 1),
      needle: seed.text,
      weight: seed.weight || 0,
      label: seed.label || '',
    });
  };

  for (const seed of seedItems) {
    const useSnippetSearch = seed.text.length > 220 || seed.text.includes('\n');
    if (useSnippetSearch) {
      const index = findSnippetIndex(rawText, seed.text);
      addAnchor(index, String(seed.text).trim().length || 1, seed);
      continue;
    }
    const limit = weakSelectionSeed(seed.text) ? 4 : 10;
    for (const item of findAllSeedIndexes(rawText, seed, limit)) {
      addAnchor(item.index, item.length, seed);
    }
  }

  const sortedAnchors = anchors
    .sort((a, b) => b.weight - a.weight || b.length - a.length || a.index - b.index);
  const nodeAnchors = sortedAnchors
    .filter(anchor => anchor.weight >= 90 || !weakSelectionSeed(anchor.needle));
  const preferredAnchors = nodeAnchors.length ? nodeAnchors : sortedAnchors.slice(0, 12);
  const selectedRanges = [];
  const selectedKeys = new Set();
  const addAnchorRange = anchor => {
    const range = rangeAroundAnchor(rawText, astNodes, anchor);
    const key = semanticRangeKey(range);
    if (!key || selectedKeys.has(key)) return;
    const rangeSize = range.end - range.start;
    const contained = selectedRanges.some(old => old.start >= range.start && old.end <= range.end);
    if (contained) {
      const smallestContained = selectedRanges
        .filter(old => old.start >= range.start && old.end <= range.end)
        .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
      const oldSize = smallestContained ? smallestContained.end - smallestContained.start : rangeSize;
      if ((anchor.weight || 0) <= (smallestContained?.anchorWeight || 0) && rangeSize > oldSize * 3) return;
    }
    selectedKeys.add(key);
    const rangeText = completeRangeText(rawText, range);
    const anchorWeight = isCommentOnlyRangeText(rangeText)
      ? Math.floor((anchor.weight || 0) * 0.15)
      : (anchor.weight || 0);
    selectedRanges.push({
      ...range,
      anchorWeight,
      anchorLabel: anchor.label || '',
      anchorNeedle: anchor.needle || '',
    });
  };

  for (const anchor of preferredAnchors.slice(0, 64)) addAnchorRange(anchor);

  const exactTextSeeds = seedItems
    .filter(seed => /文案|选区结构化证据/.test(seed.label || '') && !weakSelectionSeed(seed.text))
    .sort((a, b) => b.weight - a.weight || b.text.length - a.text.length)
    .slice(0, 12);
  for (const seed of exactTextSeeds) {
    for (const item of findAllNeedleIndexes(rawText, seed.text, 24)) {
      addAnchorRange({
        index: item.index,
        length: item.length,
        needle: seed.text,
        weight: seed.weight,
        label: seed.label,
      });
    }
  }

  const declaredSymbols = uniq(selectedRanges
    .flatMap(range => declaredSymbolsFromText(completeRangeText(rawText, range), 8)))
    .slice(0, 16);
  for (const range of symbolUsageRanges(rawText, astNodes, declaredSymbols, selectedRanges)) {
    const key = semanticRangeKey(range);
    if (!key || selectedKeys.has(key)) continue;
    selectedKeys.add(key);
    selectedRanges.push(range);
  }

  const anchorRanges = mergeRanges(selectedRanges
    .sort((a, b) => (b.anchorWeight || 0) - (a.anchorWeight || 0) || (a.end - a.start) - (b.end - b.start) || a.start - b.start)
    .slice(0, 72), 72)
    .sort((a, b) => (b.anchorWeight || 0) - (a.anchorWeight || 0) || (a.end - a.start) - (b.end - b.start) || a.start - b.start);
  let anchorText = '';
  let skippedCompleteBlocks = 0;
  if (anchorRanges.length) {
    const anchorBlocks = [];
    let anchorSize = 0;
    for (const [index, range] of anchorRanges.entries()) {
      const excerpt = completeRangeText(rawText, range);
      if (!excerpt) continue;
      const block = `// anchor ${index + 1}: complete syntax unit around matched selection evidence\n${excerpt}`;
      if (!anchorBlocks.length || anchorSize + block.length <= PRUNED_MODEL_FILE_CHARS) {
        anchorBlocks.push(block);
        anchorSize += block.length;
      } else {
        skippedCompleteBlocks++;
      }
    }
    anchorText = anchorBlocks.join('\n\n');
  } else {
    anchorText = String(
      hit?.preciseSnippet
      || hit?.uniqueSnippet
      || hit?.snippet
      || ''
    ).trim();
  }
  let text = anchorText;
  if (skippedCompleteBlocks) {
    text = `${text}\n\n// pruned ${skippedCompleteBlocks} additional complete syntax unit(s) after budget`;
  }
  return {
    file: file.path,
    text,
    mode: 'pruned-chain',
    note: '按 AST/结构节点仅保留直接支撑本地命中的完整语法块',
    rawLength: rawText.length,
    tokenEstimate: estimateModelTokens(text),
    chunkIndex: 1,
    chunkTotal: 1,
    start: 0,
    end: rawText.length,
  };
}

function estimateModelTokens(value) {
  return Math.max(1, Math.ceil(String(value || '').length / TOKEN_ESTIMATE_CHARS));
}

function collectModelFiles(project, body, textCache, logs) {
  const files = [];
  const seen = new Set();
  const add = filePath => {
    const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || seen.has(normalized)) return;
    if (!projectFile(project, normalized)) return;
    seen.add(normalized);
    files.push(normalized);
  };

  const modelHits = modelCandidateHits(body, logs);
  for (const item of modelHits) {
    add(item.file);
  }
  for (const item of body.extraFiles || []) add(item);

  const blocks = [];
  const localMap = localCandidateMap(body);
  for (const file of files.slice(0, MAX_MODEL_FILES)) {
    const pruned = pruneFileForModel(
      project,
      file,
      localMap.get(file) || candidateHitForFile(body, file) || { file },
      body.searchPayload || {},
      textCache
    );
    const block = pruned;
    if (!block) continue;
    block.tokenEstimate = block.tokenEstimate || estimateModelTokens(block.text);
    blocks.push(block);
    appendLog(logs, pruned
      ? `读取候选文件：${file}（原始 ${block.rawLength} 字符；AST 剪枝后 ${block.text.length} 字符；估算 ${block.tokenEstimate} tokens；文件不切片）`
      : `读取候选文件：${file}（完整 ${block.rawLength} 字符；估算 ${block.tokenEstimate} tokens；文件不切片）`);
  }
  appendLog(
    logs,
    `候选文件内容：纳入 ${blocks.length} 个依据源码剪枝块 / ${files.length} 个候选文件；定位模型不读取完整文件`
  );
  return blocks;
}

function conciseClassName(value) {
  return uniq(String(value || '').split(/\s+/).filter(Boolean)).slice(0, 4).join(' ');
}

function infoSearchText(info) {
  return String(info?.searchText || info?.text || info?.innerText || '').trim();
}

function generatedAttribute(key, value) {
  const name = String(key || '').toLowerCase();
  const text = String(value || '');
  if (!name || name === 'class' || name === 'style') return true;
  if (/^data-v-[a-f0-9]+$/i.test(name)) return true;
  if (/^data-(?:react|vue|n)-?(?:id|uid|key)$/i.test(name)) return true;
  if (name === 'tabindex' || (name.startsWith('aria-') && name !== 'aria-label')) return true;
  if (/^(?:id|aria-controls|aria-describedby|aria-labelledby|aria-activedescendant)$/i.test(name)
    && /(?:^|[-_:])[a-f0-9]{7,}(?:$|[-_:])/i.test(text)) {
    return true;
  }
  return false;
}

function conciseAttrs(attrs) {
  const result = {};
  for (const [key, value] of Object.entries(attrs || {})) {
    if (generatedAttribute(key, value)) continue;
    result[key] = compact(value || '[present]', 10);
    if (Object.keys(result).length >= 6) break;
  }
  return result;
}

function conciseNode(node) {
  if (!node || typeof node !== 'object') return null;
  const tag = String(node.tag || '').toLowerCase();
  const className = conciseClassName(node.className || node.firstClassName || '');
  const text = compact(node.text || '', 24);
  const attrs = conciseAttrs(node.attrs);
  if (!tag && !className && !text && !Object.keys(attrs).length) return null;
  return {
    ...(tag ? { tag } : {}),
    ...(className ? { className } : {}),
    ...(text ? { text } : {}),
    ...(Object.keys(attrs).length ? { attrs } : {}),
  };
}

function conciseSubtree(subtree) {
  const groups = new Map();
  for (const node of (subtree?.nodes || []).slice(0, 80)) {
    const value = conciseNode(node);
    if (!value) continue;
    const key = JSON.stringify(value);
    const old = groups.get(key);
    if (old) {
      old.count += 1;
    } else {
      groups.set(key, { ...value, count: 1 });
    }
  }
  return Array.from(groups.values())
    .sort((a, b) => Number(b.count || 1) - Number(a.count || 1))
    .slice(0, 12)
    .map(item => item.count > 1 ? item : Object.fromEntries(
      Object.entries(item).filter(([key]) => key !== 'count')
    ));
}

function conciseSelectionSummary(searchPayload) {
  const instructions = new Map(
    (searchPayload.selectionInstructions || [])
      .map(item => [Number(item?.index || 0), String(item?.instruction || '')])
      .filter(item => item[0] > 0 && item[1])
  );
  return (searchPayload.selections || []).map(item => {
    const info = item.element || {};
    const asset = item.asset || {};
    const self = conciseNode(info) || {};
    const expanded = conciseNode(asset);
    const subtree = conciseSubtree(info.subtree);
    return {
      index: item.index,
      instruction: instructions.get(Number(item.index || 0)) || '',
      self,
      ...(subtree.length ? { subtree } : {}),
      ...(expanded ? { expanded } : {}),
    };
  });
}

function mergeList(...lists) {
  return uniq(lists.flatMap(list => Array.isArray(list) ? list : [list]).filter(Boolean));
}

function cleanLocateSource(value) {
  return String(value || '')
    .split('\n')
    .filter(line => {
      const text = line.trim();
      return !/^\/\/\s*(imports directly related to visible symbols|selection\/code anchor|anchor\s+\d+:|one-hop direct definition\/usage)/i.test(text)
        && !/^\/\/\s*pruned\s+\d+/i.test(text);
    })
    .join('\n')
    .trim();
}

function locateHitsForPrompt(files, body) {
  const localMap = localCandidateMap(body);
  return files.map(file => {
    const local = localMap.get(normalizeModelFilePath(file.file))
      || candidateHitForFile(body, file.file)
      || {};
    return {
      file: file.file,
      evidence: uniq([
        ...(local.reasons || []),
        ...(local.contextReasons || []),
      ]).slice(0, 6),
      code: cleanLocateSource(file.text),
    };
  });
}

function buildModelPrompt(project, body, textCache, logs, options = {}) {
  const payload = body.searchPayload || {};
  const files = options.files || collectModelFiles(project, body, textCache, logs);
  const batchIndex = Math.max(1, Number(options.batchIndex || 1));
  const batchTotal = Math.max(batchIndex, Number(options.batchTotal || 1));
  const previousItems = Array.isArray(options.previousItems) ? options.previousItems : [];
  const hits = locateHitsForPrompt(files, body);

  return [
    '你只负责从本地候选中选出最可能对应当前页面选区的源码文件，并给出粗源码依据。',
    '规则：',
    '- 只能返回 hit 中存在的 file。',
    '- 结合 evidence、code、selection 和 requirement 判断文件。',
    '- sourceType=code 时，source 必须从对应 hit.code 中摘取关键连续片段，不需要定位精确修改位置。',
    '- 如果无法在 hit.code 中判断出可靠源码片段，但文件仍最可能相关，sourceType=selection，source 返回简化后的相关选区信息。',
    '- 不生成修改方案，不解释。',
    '- 可以返回多个确实相关的文件；完全无法判断返回空 items。',
    '返回严格 JSON：{"items":[{"file":"src/...","sourceType":"code|selection","source":"源码片段或选区摘要"}]}',
    batchTotal > 1 ? `batch: ${batchIndex}/${batchTotal}` : '',
    previousItems.length ? `previousFiles: ${safeJson(previousItems.map(item => item.file).filter(Boolean))}` : '',
    `hit: ${safeJson(hits)}`,
    `selection: ${safeJson(conciseSelectionSummary(payload))}`,
    `requirement: ${payload.userPrompt || '-'}`,
  ].join('\n');
}

function parseModelJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (error) {
    }
  }
  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
    } catch (error) {
    }
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (error) {
    }
  }
  return null;
}

function modelOutputItems(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.map(item => typeof item === 'string' ? { path: item } : item);
  }
  if (Array.isArray(parsed?.files)) return parsed.files.map(file => ({ path: file }));
  if (Array.isArray(parsed?.hit)) {
    return parsed.hit.map(item => typeof item === 'string' ? { path: item } : item);
  }
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed?.edits)) return parsed.edits;
  if (Array.isArray(parsed?.results)) return parsed.results;
  if (Array.isArray(parsed?.targetFiles)) {
    return parsed.targetFiles.map(item => ({
      path: item.path || item.file,
      'code片段': item['code片段'] || item['位置'] || item.codeSnippet || item.location || item.snippet || '',
      '推测方向': item['推测方向'] || item.directionGuess || item.guess || item.suggestion || '',
      '提示词': item['提示词'] || item.prompt || item.reason || parsed.summary || '',
      confidence: item.confidence,
      selectionEvidence: item.selectionEvidence || item.match || item.evidence,
    }));
  }
  return [];
}

function chunkFileBlocks(blocks, maxTokens = MAX_MODEL_BATCH_TOKENS, logs = null) {
  const batches = [];
  let current = [];
  let currentTokens = 0;
  for (const block of blocks || []) {
    const tokens = block?.tokenEstimate || estimateModelTokens(block?.text || '');
    if (current.length && currentTokens + tokens > maxTokens) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    if (!current.length && tokens > maxTokens) {
      appendLog(logs, `模型分批：${block.file} 估算 ${tokens} tokens，超过单批预算 ${maxTokens}，将单独请求且不截断文件`);
    }
    current.push(block);
    currentTokens += tokens;
  }
  if (current.length) batches.push(current);
  return batches.length ? batches : [[]];
}

function localCandidateMap(body) {
  const map = new Map();
  for (const hit of [...(body.selectedCandidateHits || []), ...(body.candidateHits || [])]) {
    if (!hit?.file) continue;
    const hitFile = normalizeModelFilePath(hit.file);
    if (!map.has(hitFile)) map.set(hitFile, { ...hit, file: hitFile });
    const chain = Array.isArray(hit.importChain) ? hit.importChain : [];
    if (chain.length <= 1) continue;
    chain.forEach((file, index) => {
      const normalized = normalizeModelFilePath(file);
      if (!normalized || map.has(normalized)) return;
      map.set(normalized, {
        file: normalized,
        score: Math.max(0, (hit.score || 0) - Math.max(12, index * 18)),
        stage: hit.stage || 'route-import-chain',
        stages: mergeList(hit.stages || hit.stage, 'import-chain-context'),
        reasons: mergeList(
          `引用链路上下文：${chain.join(' -> ')}`,
          index === chain.length - 1 ? '链路终点命中文件' : '链路中间文件，可能包含真实使用/渲染逻辑',
          (hit.reasons || []).slice(0, 4)
        ),
        contextScore: hit.contextScore || 0,
        contextReasons: hit.contextReasons || [],
        preciseEvidence: !!hit.preciseEvidence && index === chain.length - 1,
      });
    });
  }
  return map;
}

function modelItemRank(item) {
  const localScore = Math.min(120, Math.round((item.localScore || 0) / 6));
  const selectionScore = Math.round((item.selectionEvidenceScore || 0) * 0.8);
  const contextScore = Math.min(80, item.localContextScore || 0);
  return (item.confidence || 0) + selectionScore + contextScore + localScore + (item.localPreciseEvidence ? 48 : 0) + (item.snippetVerified ? 18 : 0);
}

function hasRouteOrApiSupport(item) {
  return (item.localStages || []).some(stage => {
    return stage === 'route'
      || stage === 'route-import-chain'
      || stage === 'import-chain'
      || stage === 'import-chain-context'
      || stage === 'api-endpoint'
      || stage === 'api-usage'
      || stage === 'api-upstream';
  });
}

function hasLocalCandidateSupport(item) {
  if (!item) return false;
  if (item.localPreciseEvidence) return true;
  if ((item.localScore || 0) > 0) return true;
  if ((item.localContextScore || 0) > 0) return true;
  if ((item.localReasons || []).length) return true;
  if ((item.localContextReasons || []).length) return true;
  if ((item.localStages || []).length) return true;
  return false;
}

function shouldDowngradeUnverifiedExactToDirection(item) {
  if (!item?.exists) return false;
  if (item.locateLevel === 'direction') return false;
  if (item.snippetVerified) return false;
  if (!String(item.rawCodeSnippet || '').trim()) return false;
  if ((item.confidence || 0) < 85) return false;
  if ((item.selectionEvidenceScore || 0) < 85) return false;
  return hasLocalCandidateSupport(item);
}

function normalizeModelLocateLevel(item) {
  if (!shouldDowngradeUnverifiedExactToDirection(item)) return item;
  return {
    ...item,
    locateLevel: 'direction',
    codeSnippet: item.codeSnippet || item.rawCodeSnippet,
    snippetSource: 'unverified-direction-snippet',
    downgradedToDirection: true,
  };
}

function modelItemAccepted(item) {
  if (!item?.exists) return false;
  if (item.fileOnly) return hasLocalCandidateSupport(item);
  if (item.selectionFallback) return hasLocalCandidateSupport(item);
  const directionLevel = item.locateLevel === 'direction';
  if (!directionLevel && (!item.snippetVerified || !item.codeSnippet)) return false;
  if (!directionLevel && item.snippetVerified && item.codeSnippet && hasLocalCandidateSupport(item)) return true;
  const semanticDirection = !!item.downgradedToDirection
    && (item.confidence || 0) >= 85
    && (item.selectionEvidenceScore || 0) >= 85
    && hasLocalCandidateSupport(item);
  if (directionLevel && !(semanticDirection || item.localPreciseEvidence || (item.localContextScore || 0) >= 42 || (item.localScore || 0) >= 180)) return false;
  if (item.localPreciseEvidence) return true;
  if ((item.localContextScore || 0) >= 42) return true;
  if ((item.selectionEvidenceScore || 0) >= 70) return true;
  if (hasRouteOrApiSupport(item) && (item.confidence || 0) >= 70 && (item.selectionEvidenceScore || 0) >= 45) return true;
  return false;
}

function reconcileModelItems(items, body) {
  const localMap = localCandidateMap(body);
  const merged = new Map();

  for (const item of items || []) {
    if (!item?.file) continue;
    const local = localMap.get(item.file);
    const enriched = {
      ...item,
      localScore: local?.score || 0,
      localPreciseEvidence: !!local?.preciseEvidence,
      localStages: mergeList(local?.stages || local?.stage, item.localStages || []),
      localReasons: mergeList((local?.reasons || []).slice(0, 6), item.localReasons || []),
      localContextReasons: mergeList((local?.contextReasons || []).slice(0, 4), item.localContextReasons || []),
      localContextScore: Math.max(local?.contextScore || 0, item.localContextScore || 0),
    };
    const normalized = normalizeModelLocateLevel(enriched);
    const old = merged.get(item.file);
    if (!old || modelItemRank(normalized) > modelItemRank(old)) {
      merged.set(item.file, normalized);
      continue;
    }
    merged.set(item.file, {
      ...old,
      confidence: Math.max(old.confidence || 0, normalized.confidence || 0),
      prompt: old.prompt || normalized.prompt,
      reason: old.reason || normalized.reason,
      directionGuess: old.directionGuess || normalized.directionGuess,
      codeSnippet: old.codeSnippet || normalized.codeSnippet,
      rawCodeSnippet: old.rawCodeSnippet || normalized.rawCodeSnippet,
      snippetVerified: !!(old.snippetVerified || normalized.snippetVerified),
      snippetSource: old.snippetSource || normalized.snippetSource,
      locateLevel: old.locateLevel === 'direction' || normalized.locateLevel === 'direction' ? 'direction' : old.locateLevel,
      downgradedToDirection: !!(old.downgradedToDirection || normalized.downgradedToDirection),
      localScore: Math.max(old.localScore || 0, normalized.localScore || 0),
      localPreciseEvidence: !!(old.localPreciseEvidence || normalized.localPreciseEvidence),
      localStages: mergeList(old.localStages || [], normalized.localStages || []),
      localReasons: mergeList(old.localReasons || [], normalized.localReasons || []),
      localContextReasons: mergeList(old.localContextReasons || [], normalized.localContextReasons || []),
      localContextScore: Math.max(old.localContextScore || 0, normalized.localContextScore || 0),
      selectionEvidenceScore: Math.max(old.selectionEvidenceScore || 0, normalized.selectionEvidenceScore || 0),
      selectionEvidenceReasons: mergeList(old.selectionEvidenceReasons || [], normalized.selectionEvidenceReasons || []),
      fileOnly: !!(old.fileOnly || normalized.fileOnly),
    });
  }

  return Array.from(merged.values())
    .sort((a, b) => modelItemRank(b) - modelItemRank(a));
}

function exactSnippetIndex(text, snippet) {
  const content = String(text || '');
  const raw = String(snippet || '').trim();
  if (!content || !raw) return -1;
  if (raw.includes('...<omitted') || raw.includes('<omitted')) return -1;
  const direct = content.indexOf(raw);
  if (direct !== -1) return direct;
  return content.replace(/\r\n/g, '\n').indexOf(raw.replace(/\r\n/g, '\n'));
}

function stripPrunedHelperComments(snippet) {
  return String(snippet || '')
    .split('\n')
    .filter(line => {
      const text = line.trim();
      return !/^\/\/\s*(imports directly related to visible symbols|selection\/code anchor|anchor\s+\d+:)/i.test(text);
    })
    .join('\n')
    .trim();
}

function stripLeadingImports(snippet) {
  const lines = String(snippet || '').split('\n');
  let index = 0;
  while (index < lines.length) {
    const text = lines[index].trim();
    if (!text) {
      index++;
      continue;
    }
    if (/^import\b/.test(text)) {
      index++;
      continue;
    }
    break;
  }
  return lines.slice(index).join('\n').trim();
}

function modelSnippetCandidates(snippet) {
  const raw = String(snippet || '').trim();
  const withoutHelpers = stripPrunedHelperComments(raw);
  const withoutImports = stripLeadingImports(withoutHelpers);
  return mergeList(raw, withoutHelpers, withoutImports)
    .map(item => String(item || '').trim())
    .filter(item => item.length >= 24);
}

function approximateModelSnippetExcerpt(text, snippet, maxChars = MODEL_RESULT_SNIPPET_CHARS) {
  const source = String(text || '');
  const raw = String(snippet || '').trim();
  if (!source || raw.length < 60) return null;
  const lines = source.split('\n');
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }
  const anchors = uniq([
    ...String(raw).split(/\r?\n/).map(line => line.trim()).filter(line => line.length >= 18 && line.length <= 180),
    ...(raw.match(/\b[A-Za-z_$][\w$]{4,}\b/g) || []).filter(token => !GENERIC_MODEL_SYMBOLS.has(token.toLowerCase())),
    ...(raw.match(/['"`][^'"`]{2,40}['"`]/g) || []).map(item => item.slice(1, -1)),
  ]).slice(0, 40);
  if (anchors.length < 3) return null;

  let best = null;
  for (let start = 0; start < lines.length; start++) {
    const end = Math.min(lines.length, start + 36);
    const windowText = lines.slice(start, end).join('\n');
    let score = 0;
    let count = 0;
    for (const anchor of anchors) {
      if (!anchor || !windowText.includes(anchor)) continue;
      count++;
      score += anchor.length >= 18 ? 8 : 3;
    }
    if (count < 3) continue;
    if (!best || score > best.score) {
      best = {
        score,
        count,
        start: offsets[start],
        end: offsets[end - 1] + lines[end - 1].length,
      };
    }
  }
  if (!best || best.score < 12) return null;
  return rangeExcerpt(source, best.start, best.end, maxChars);
}

function resolveModelSnippet(project, filePath, codeSnippet, body, textCache) {
  const file = projectFile(project, filePath);
  if (!file) {
    return {
      codeSnippet: '',
      snippetVerified: false,
      snippetSource: 'missing-file',
    };
  }

  const text = readProjectText(project, file, textCache || new Map());
  for (const candidate of modelSnippetCandidates(codeSnippet)) {
    const directIndex = exactSnippetIndex(text, candidate);
    if (directIndex !== -1) {
      return {
        codeSnippet: candidate,
        snippetVerified: true,
        snippetSource: candidate === String(codeSnippet || '').trim() ? 'model' : 'normalized-model',
      };
    }
  }

  const approximate = approximateModelSnippetExcerpt(text, codeSnippet);
  if (approximate) {
    return {
      codeSnippet: approximate,
      snippetVerified: true,
      snippetSource: 'approximate-model-anchors',
    };
  }

  return {
    codeSnippet: '',
    snippetVerified: false,
    snippetSource: codeSnippet ? 'unverified-model-snippet' : 'none',
  };
}

function validateModelItems(project, parsed, body, textCache, options = {}) {
  const allowedFiles = new Set((options.allowedFiles || [])
    .map(file => normalizeModelFilePath(file))
    .filter(Boolean));
  return modelOutputItems(parsed).map(item => {
    const file = String(item.path || item.file || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const sourceType = String(item.sourceType || item['sourceType'] || item['来源类型'] || item.type || '').trim().toLowerCase();
    const sourceText = String(item.source || item['源码'] || item['源码方向'] || item.sourceText || '').trim();
    const selectionFallback = sourceType === 'selection' || sourceType === 'select' || sourceType === '选区';
    const rawCodeSnippet = String(
      item['code片段']
      || item['位置']
      || item.codeSnippet
      || item.location
      || item.snippet
      || item.code
      || (selectionFallback ? '' : sourceText)
      || ''
    ).trim();
    const fallbackSelectionSource = selectionFallback ? sourceText : '';
    const directionGuess = String(item['推测方向'] || item.directionGuess || item.guess || item.suggestion || '').trim();
    const prompt = String(item['提示词'] || item.prompt || item.instruction || item.reason || '').trim();
    const locateLevel = selectionFallback || /direction|方向|coarse/i.test(String(item['定位层级'] || item.locateLevel || item.level || item.type || ''))
      ? 'direction'
      : 'exact';
    const selectionEvidence = item.selectionEvidence || item.match || item.evidence || {};
    const selectionEvidenceScore = Math.max(0, Math.min(Number(
      selectionEvidence.score ?? item.selectionEvidenceScore ?? item.matchScore ?? item.score ?? 0
    ), 100));
    const selectionEvidenceReasons = stringList(selectionEvidence.reasons || item.selectionEvidenceReasons || item.matchReasons, 8);
    const confidence = Math.max(0, Math.min(Number(item.confidence ?? item.confidenceScore ?? 0), 100));
    const fileOnly = !rawCodeSnippet && !fallbackSelectionSource && !directionGuess && !prompt;
    const snippetResult = fallbackSelectionSource
      ? {
          codeSnippet: fallbackSelectionSource,
          snippetVerified: false,
          snippetSource: 'selection-fallback',
        }
      : resolveModelSnippet(project, file, rawCodeSnippet, body, textCache);
    return {
      path: file,
      file,
      confidence: fileOnly ? 0 : confidence,
      selectionEvidenceScore,
      selectionEvidenceReasons,
      directionGuess,
      codeSnippet: snippetResult.codeSnippet,
      rawCodeSnippet,
      selectionFallback: !!fallbackSelectionSource,
      prompt,
      reason: prompt || snippetResult.codeSnippet || rawCodeSnippet,
      exists: !!projectFile(project, file),
      snippetVerified: snippetResult.snippetVerified,
      snippetSource: snippetResult.snippetSource,
      locateLevel,
      fileOnly,
      allowed: !allowedFiles.size || allowedFiles.has(file),
    };
  }).filter(item => item.file && item.allowed);
}

function buildCliLocatePrompt(prompt) {
  return [
    '你当前只承担 Magnus 的“源码粗定位”子任务。',
    '',
    '严格约束：',
    '- 不要执行命令。',
    '- 不要修改文件。',
    '- 不要读取本提示词以外的文件。',
    '- 不要联网。',
    '- 不要做项目重构、测试、计划或解释。',
    '- 只基于下面提供的候选源码、选区信息和用户需求判断。',
    '- 只输出符合下方要求的 JSON 对象；无法判断时 files 返回空数组。',
    '',
    '下面是定位任务输入：',
    prompt,
  ].join('\n');
}

function buildCliStructuredPrompt(prompt) {
  return [
    '你当前只承担 Magnus 的结构化分析子任务。',
    '',
    '严格约束：',
    '- 不要执行命令。',
    '- 不要修改文件。',
    '- 不要读取本提示词以外的文件。',
    '- 不要联网。',
    '- 只根据提示词中提供的项目上下文返回要求的 JSON。',
    '',
    prompt,
  ].join('\n');
}

function runExecAdapter(adapter, prompt, cwd, logs, signal, runtimeOptions = {}) {
  const parts = splitCommandLine(adapter.command);
  if (!parts.length) throw new Error('Cli 模型缺少 command，例如：codex exec');
  throwIfAborted(signal);
  const [command, ...args] = parts;
  const env = { ...process.env };
  if (adapter.proxyUrl) {
    env.HTTP_PROXY = adapter.proxyUrl;
    env.HTTPS_PROXY = adapter.proxyUrl;
    env.ALL_PROXY = adapter.proxyUrl;
  }
  appendLog(logs, `Cli 模型启动：${command}${args.length ? ` ${args.join(' ')}` : ''}`);
  appendLog(logs, `执行目录：${cwd}`);
  appendLog(logs, adapter.proxyUrl ? `代理：已写入环境变量 ${safeUrlLabel(adapter.proxyUrl)}` : '代理：未启用');
  appendLog(
    logs,
    runtimeOptions.rawPrompt
      ? `Cli 结构化任务：${runtimeOptions.stage || 'experience'}；仅允许基于提示词内容输出 JSON`
      : 'Cli 轻量定位约束：已启用；仅允许基于提示词内容输出 JSON，不执行命令/改文件/额外读文件'
  );
  const execPrompt = runtimeOptions.rawPrompt
    ? buildCliStructuredPrompt(prompt)
    : buildCliLocatePrompt(prompt);
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`模型执行超过 ${Math.round(adapter.timeoutMs / 1000)} 秒`));
    }, adapter.timeoutMs);
    const abortHandler = () => {
      clearTimeout(timer);
      child.kill('SIGTERM');
      const error = new Error('模型定位已停止');
      error.name = 'AbortError';
      reject(error);
    };
    if (signal) {
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', error => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abortHandler);
      appendLog(logs, `Cli 模型结束：退出码 ${code}，耗时 ${Date.now() - startedAt}ms，stdout ${stdout.length} 字符，stderr ${stderr.length} 字符`);
      if (code !== 0) {
        reject(new Error(stderr || `模型命令退出码 ${code}`));
        return;
      }
      resolve(stdout || stderr);
    });
    child.stdin.end(execPrompt);
  });
}

function requestTextDirect(targetUrl, options) {
  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  return requestTextWithClient(client, {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    method: options.method,
    path: `${url.pathname}${url.search}`,
    headers: options.headers,
    timeoutMs: options.timeoutMs,
    body: options.body,
    signal: options.signal,
  });
}

function requestTextHttpProxy(targetUrl, proxyUrl, options) {
  const url = new URL(targetUrl);
  const proxyClient = proxyUrl.protocol === 'https:' ? https : http;
  const headers = {
    ...options.headers,
    Host: url.host,
  };
  const auth = proxyAuthHeader(proxyUrl);
  if (auth) headers['Proxy-Authorization'] = auth;
  return requestTextWithClient(proxyClient, {
    protocol: proxyUrl.protocol,
    hostname: proxyUrl.hostname,
    port: proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80),
    method: options.method,
    path: url.href,
    headers,
    timeoutMs: options.timeoutMs,
    body: options.body,
    signal: options.signal,
  });
}

function createHttpsProxyAgent(proxyUrl, targetUrl, timeoutMs, signal) {
  const proxyClient = proxyUrl.protocol === 'https:' ? https : http;
  const targetPort = targetUrl.port || 443;
  return new https.Agent({
    keepAlive: false,
    createConnection(options, callback) {
      let settled = false;
      const done = (error, socket) => {
        if (settled) return;
        settled = true;
        callback(error, socket);
      };
      const headers = {
        Host: `${targetUrl.hostname}:${targetPort}`,
      };
      const auth = proxyAuthHeader(proxyUrl);
      if (auth) headers['Proxy-Authorization'] = auth;
      const connectReq = proxyClient.request({
        hostname: proxyUrl.hostname,
        port: proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80),
        method: 'CONNECT',
        path: `${targetUrl.hostname}:${targetPort}`,
        headers,
      });
      connectReq.setTimeout(timeoutMs, () => {
        connectReq.destroy(new Error('代理连接超时'));
      });
      const abortHandler = () => connectReq.destroy(new Error('模型定位已停止'));
      if (signal) {
        if (signal.aborted) {
          abortHandler();
          return;
        }
        signal.addEventListener('abort', abortHandler, { once: true });
      }
      connectReq.on('connect', (res, socket) => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        if (res.statusCode !== 200) {
          socket.destroy();
          done(new Error(`代理 CONNECT 失败：HTTP ${res.statusCode}`));
          return;
        }
        const secureSocket = tls.connect({
          socket,
          servername: targetUrl.hostname,
        }, () => done(null, secureSocket));
        secureSocket.once('error', error => done(error));
      });
      connectReq.once('error', error => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        done(error);
      });
      connectReq.end();
    },
  });
}

function requestTextHttpsProxy(targetUrl, proxyUrl, options) {
  const url = new URL(targetUrl);
  const agent = createHttpsProxyAgent(proxyUrl, url, options.timeoutMs, options.signal);
  return requestTextWithClient(https, {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || 443,
    method: options.method,
    path: `${url.pathname}${url.search}`,
    headers: options.headers,
    timeoutMs: options.timeoutMs,
    body: options.body,
    agent,
    signal: options.signal,
  });
}

function requestTextWithClient(client, options) {
  return new Promise((resolve, reject) => {
    const req = client.request({
      protocol: options.protocol,
      hostname: options.hostname,
      port: options.port,
      method: options.method,
      path: options.path,
      headers: options.headers,
      agent: options.agent,
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        text += chunk;
      });
      response.on('end', () => {
        if (options.signal) options.signal.removeEventListener('abort', abortHandler);
        resolve({
          statusCode: response.statusCode || 0,
          statusMessage: response.statusMessage || '',
          headers: response.headers,
          text,
        });
      });
    });
    req.setTimeout(options.timeoutMs, () => {
      req.destroy(new Error(`API 模型请求超过 ${Math.round(options.timeoutMs / 1000)} 秒`));
    });
    const abortHandler = () => req.destroy(new Error('模型定位已停止'));
    if (options.signal) {
      if (options.signal.aborted) {
        abortHandler();
        return;
      }
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }
    req.once('error', error => {
      if (options.signal) options.signal.removeEventListener('abort', abortHandler);
      reject(error);
    });
    req.end(options.body);
  });
}

function requestApiText(endpoint, options) {
  const proxyUrl = normalizeProxyUrl(options.proxyUrl);
  if (!proxyUrl) return requestTextDirect(endpoint, options);
  const targetUrl = new URL(endpoint);
  if (targetUrl.protocol === 'https:') {
    return requestTextHttpsProxy(endpoint, proxyUrl, options);
  }
  return requestTextHttpProxy(endpoint, proxyUrl, options);
}

async function runApiAdapter(adapter, prompt, logs, signal, runtimeOptions = {}) {
  if (!adapter.endpoint) throw new Error('API 模型缺少 endpoint');
  throwIfAborted(signal);
  const headers = {
    'Content-Type': 'application/json',
  };
  if (adapter.apiKey) headers.Authorization = `Bearer ${adapter.apiKey}`;
  const body = {
    model: adapter.model || undefined,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: runtimeOptions.systemPrompt || '你是严谨的本地源码定位 agent，只返回 JSON。',
      },
      { role: 'user', content: prompt },
    ],
  };
  appendLog(logs, `API 模型请求：${safeUrlLabel(adapter.endpoint)}；模型 ${adapter.model || '-'}`);
  appendLog(logs, adapter.proxyUrl ? `代理：${safeUrlLabel(adapter.proxyUrl)}` : '代理：未启用');
  const startedAt = Date.now();
  const response = await requestApiText(adapter.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeoutMs: adapter.timeoutMs,
    proxyUrl: adapter.proxyUrl,
    signal,
  });
  appendLog(logs, `API 模型响应：HTTP ${response.statusCode}，耗时 ${Date.now() - startedAt}ms，响应 ${response.text.length} 字符`);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(response.text || `API 模型请求失败：${response.statusCode}`);
  }
  try {
    const data = JSON.parse(response.text);
    return data.choices?.[0]?.message?.content || data.output_text || data.text || response.text;
  } catch (error) {
    return response.text;
  }
}

async function runModelTask(rawAdapter, prompt, cwd, options = {}) {
  const logs = [];
  if (typeof options.onLog === 'function') {
    logs.onAppend = options.onLog;
  }
  const adapter = normalizeAdapter(rawAdapter);
  const rawText = adapter.type === 'api'
    ? await runApiAdapter(adapter, prompt, logs, options.signal, {
        systemPrompt: options.systemPrompt || '你是严谨的本地源码检索 agent，只返回 JSON。',
      })
    : await runExecAdapter(adapter, prompt, cwd, logs, options.signal, {
        rawPrompt: true,
      });
  return {
    adapter: {
      id: adapter.id,
      name: adapter.name,
      type: adapter.type,
    },
    rawText,
    logs,
  };
}

async function runModelLocate(project, body, textCache = new Map(), options = {}) {
  if (!project) throw new Error('No project selected.');
  const logs = [];
  if (typeof options.onLog === 'function') {
    logs.onAppend = options.onLog;
  }
  try {
    throwIfAborted(options.signal);
    const adapter = normalizeAdapter(body.adapter);
    appendLog(logs, `模型定位开始：${adapter.name}（${adapter.type}）`);
    appendLog(logs, `本地预检索：候选 ${Array.isArray(body.candidateHits) ? body.candidateHits.length : 0} 个，已选 ${Array.isArray(body.selectedCandidateHits) ? body.selectedCandidateHits.length : 0} 个`);
    appendLog(logs, '缩略图说明：当前模型定位不会发送图片字节；截图只用于前端展示，模型只接收当前选区和扩大选区的结构化信息。');
    const fileBlocks = collectModelFiles(project, body, textCache, logs);
    const batches = chunkFileBlocks(fileBlocks, MAX_MODEL_BATCH_TOKENS, logs);
    appendLog(logs, `模型分批读取：${batches.length} 批；单批预算约 ${MAX_MODEL_BATCH_TOKENS} tokens；文件作为不可拆 block，超预算文件单独请求`);
    const rawTexts = [];
    const parsedList = [];
    let aggregatedItems = [];

    for (let index = 0; index < batches.length; index++) {
      throwIfAborted(options.signal);
      const batchFiles = batches[index];
      appendLog(logs, `开始读取第 ${index + 1}/${batches.length} 批：${batchFiles.map(item => item.file).join('；') || '-'}`);
      const prompt = buildModelPrompt(project, body, textCache, logs, {
        files: batchFiles,
        batchIndex: index + 1,
        batchTotal: batches.length,
        previousItems: aggregatedItems.filter(modelItemAccepted),
      });
      appendLog(logs, `第 ${index + 1}/${batches.length} 批提示词长度：${prompt.length} 字符`);
      appendLog(logs, `模型定位提示词(第 ${index + 1}/${batches.length} 批):\n${prompt}`);
      const rawText = adapter.type === 'api'
        ? await runApiAdapter(adapter, prompt, logs, options.signal)
        : await runExecAdapter(adapter, prompt, project.path, logs, options.signal);
      rawTexts.push(rawText);
      appendLog(logs, `第 ${index + 1}/${batches.length} 批模型原始输出：${rawText.length} 字符`);
      appendLog(logs, `第 ${index + 1}/${batches.length} 批模型原始输出内容:\n${rawText || '-'}`);
      const parsed = parseModelJson(rawText);
      parsedList.push(parsed);
      appendLog(logs, parsed ? `第 ${index + 1}/${batches.length} 批 JSON 解析成功` : `第 ${index + 1}/${batches.length} 批 JSON 解析失败`);
      const batchItems = validateModelItems(project, parsed, body, textCache, {
        allowedFiles: batchFiles.map(item => item.file),
      });
      appendLog(logs, `第 ${index + 1}/${batches.length} 批命中 ${batchItems.length} 个文件`);
      aggregatedItems = reconcileModelItems([...aggregatedItems, ...batchItems], body);
    }

    const allModelItems = reconcileModelItems(aggregatedItems, body);
    const modelItems = allModelItems.filter(modelItemAccepted);
    appendLog(logs, `模型推荐文件：${modelItems.length} 个；AI返回但未通过验证 ${allModelItems.length - modelItems.length} 个`);
    for (const item of allModelItems.filter(item => !modelItemAccepted(item)).slice(0, 8)) {
      appendLog(
        logs,
        `模型结果丢弃：${item.file}；原因：${!item.exists ? '文件不存在' : '不属于当前本地候选或缺少本地候选证据'}`
      );
    }
    for (const item of modelItems.slice(0, 8)) {
      appendLog(
        logs,
        `模型结果接收：${item.file}；本地分数 ${item.localScore || 0}；模型仅负责文件裁决`
      );
    }
    const multiFileMatches = modelItems.filter(item => item.localPreciseEvidence || item.localScore >= 120);
    if (multiFileMatches.length > 1) {
      appendLog(logs, `多文件复核：本地与模型同时支持 ${multiFileMatches.length} 个文件，需保留多文件结果`);
    }
    let experience = {
      enhancedPrompt: fallbackEnhancedPrompt({
        pageUrl: body.searchPayload?.url || body.url || '',
        pagePath: body.pagePath || body.routeResolver?.pagePath || '',
        userRequirement: body.searchPayload?.userPrompt || '',
        targets: modelItems.map(item => ({
          file: item.file,
          locateLevel: item.locateLevel,
          codeSnippet: item.codeSnippet || item.rawCodeSnippet || '',
          directionGuess: item.directionGuess || '',
        })),
      }),
      mode: 'fallback',
      usedSkillIds: [],
    };
    if (modelItems.length) {
      try {
        experience = await enhanceLocatedPrompt({
          project,
          body,
          modelItems,
          textCache,
          log: message => appendLog(logs, message),
          invoke: (stage, prompt) => {
            throwIfAborted(options.signal);
            if (adapter.type === 'api') {
              return runApiAdapter(adapter, prompt, logs, options.signal, {
                stage,
                systemPrompt: '你是 Magnus 项目经验发现与需求增强 agent。严格按用户提示的 JSON 协议返回，不执行代码修改。',
              });
            }
            return runExecAdapter(adapter, prompt, project.path, logs, options.signal, {
              stage,
              rawPrompt: true,
            });
          },
        });
        appendLog(logs, `需求提示词增强完成：mode=${experience.mode}；Skill ${experience.usedSkillIds?.length || 0} 个`);
      } catch (error) {
        appendLog(logs, `需求提示词增强失败，已回退粗定位提示词：${error.message || error}`);
      }
    }
    const enhancedModelItems = modelItems.map(item => ({
      ...item,
      enhancedPrompt: experience.enhancedPrompt,
      experienceMode: experience.mode,
      usedSkillIds: experience.usedSkillIds || [],
    }));
    return {
      adapter: {
        id: adapter.id,
        name: adapter.name,
        type: adapter.type,
      },
      rawText: rawTexts.join('\n\n'),
      parsed: parsedList[0] || null,
      parsedBatches: parsedList,
      modelItems: enhancedModelItems,
      targetFiles: enhancedModelItems.map(item => ({
        file: item.file,
        confidence: item.confidence,
        reason: item.reason,
        codeSnippet: item.codeSnippet,
        snippetSource: item.snippetSource,
        selectionFallback: !!item.selectionFallback,
        snippetVerified: item.snippetVerified,
        downgradedToDirection: !!item.downgradedToDirection,
        prompt: item.prompt,
        enhancedPrompt: item.enhancedPrompt,
        experienceMode: item.experienceMode,
        usedSkillIds: item.usedSkillIds,
        locateLevel: item.locateLevel || 'exact',
        directionGuess: item.directionGuess || '',
        selectionEvidenceScore: item.selectionEvidenceScore,
        selectionEvidenceReasons: item.selectionEvidenceReasons || [],
        localScore: item.localScore,
        localContextScore: item.localContextScore,
        localPreciseEvidence: item.localPreciseEvidence,
        exists: item.exists,
        fileOnly: !!item.fileOnly,
        selectionFallback: !!item.selectionFallback,
      })),
      experience,
      logs,
    };
  } catch (error) {
    appendLog(logs, `模型定位失败：${error.message || error}`);
    error.modelLogs = logs;
    throw error;
  }
}

module.exports = {
  buildModelPrompt,
  runModelLocate,
  runModelTask,
  splitCommandLine,
};
