'use strict';

// 从请求 body 读取 DOM 选区，并整理成模型输入（plannerDomInput）：每个选区含 tag/selector/
// 可见文字/压缩后 markup 等事实。
const { parseHtmlLite, directText, compactWhitespace } = require('./parser');
const { compressDomMarkup } = require('./compressor');

const MAX_DOM_INPUT_CHARS = 180000;

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

module.exports = {
  MAX_DOM_INPUT_CHARS,
  selectionList,
  selectionMarkup,
  selectionContextMarkupEntries,
  plannerDomInput,
};
