'use strict';

// 选区 DOM 上下文调试摘要：把每个选区（含祖先/扩区）markup 的根 tag、class、data-v 作用域、
// 可见直文本样本汇总出来，并按关键词回溯命中的文字结构，供日志/排查用。
const { uniq } = require('../utils');
const { parseHtmlLite, directText, classTokens, compactWhitespace } = require('./parser');
const { selectionList, selectionContextMarkupEntries } = require('./selection');

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
  domContextDebugSummary,
};
