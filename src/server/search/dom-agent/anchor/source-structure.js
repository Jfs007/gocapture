const { escapeRegExp, uniq } = require('../../../utils');
const {
  NATIVE_HTML_TAGS,
  parseAttributes,
  compactWhitespace,
  classTokens,
  selectionList,
  selectionMarkup,
  domDirectTextStructures,
} = require('./dom-utils');
const {
  classTokenIndexes,
  textEvidenceIndexes,
} = require('../candidate/search-executor');

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
    // 承载可见文案的「属性」：不枚举具体属性名（label/title/placeholder…），任何 X="文案" 皆可命中。
    // DOM 已经告诉我们可见文案是什么；它在源码里由哪个属性名承载不该写死——新组件可能用 heading/caption/content…。
    // 值须恰好等于该文案（引号内精确匹配），避免误配。
    new RegExp(`\\b[\\w:-]+\\s*=\\s*["']${escaped}["']`, 'g'),
    // 对象字面量里承载文案的属性：同理不枚举 key 名，值须恰好等于该文案。
    new RegExp(`\\b[\\w-]+\\s*:\\s*["'\`]${escaped}["'\`]`, 'g'),
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

module.exports = {
  directTextStructureMismatch,
  domTextAnchors,
  sourceDomTextCoverage,
  originalDomClassTokens,
  sourceDomClassCoverage,
};
