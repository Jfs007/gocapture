'use strict';

// 轻量 HTML 解析 + 节点原语：把选区 markup 解析成简单节点树，并从节点/属性里抽取
// 稳定文字、class、稳定属性等锚点。纯函数，无 project / 无 LLM。
const { uniq } = require('../utils');

function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isVoidTag(tag) {
  return new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']).has(tag);
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

function classTokens(attrs) {
  return String(attrs?.class || '').split(/\s+/).map(item => item.trim()).filter(Boolean);
}

function looksRuntimeValue(value) {
  const text = String(value || '');
  if (/^[a-f0-9]{6,}$/i.test(text)) return true;
  if (/^[a-z]+-[a-f0-9]{5,}$/i.test(text)) return true;
  return false;
}

function isRuntimeAttr(key, value) {
  if (/^data-v-[\w-]+$/i.test(key)) return true;
  if (/^data-[\w-]*id$/i.test(key) && looksRuntimeValue(value)) return true;
  if (/^aria-(?:labelledby|describedby|controls|owns|activedescendant)$/i.test(key)) return true;
  if (key === 'id' && looksRuntimeValue(value)) return true;
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

module.exports = {
  compactWhitespace,
  isVoidTag,
  escapeAttr,
  parseAttributes,
  parseHtmlLite,
  classTokens,
  compactStyle,
  isRuntimeAttr,
  looksRuntimeValue,
  stableAttrs,
  directText,
  descendantText,
  descendantAnchorAttrs,
  nodeSignature,
};
