'use strict';

// DOM markup 压缩：折叠重复子结构（列表/表格行）为 <magnus-repeat> 摘要，并在字符预算内序列化，
// 避免把上千行同构 DOM 原样喂给模型。
const { uniq } = require('../utils');
const {
  parseHtmlLite,
  stableAttrs,
  classTokens,
  compactWhitespace,
  escapeAttr,
  descendantText,
  descendantAnchorAttrs,
  nodeSignature,
} = require('./parser');

const MAX_COMPRESSED_DOM_CHARS = 30000;

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

module.exports = {
  MAX_COMPRESSED_DOM_CHARS,
  compressDomMarkup,
};
