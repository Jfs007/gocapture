const { uniq } = require('../../utils');
const {
  selectionList,
  selectionMarkup,
  parseHtmlLite,
  compactWhitespace,
  classTokens,
  domDirectTextStructures,
} = require('./dom-utils');

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

module.exports = {
  stableDomSearchText,
  isLikelyRuntimeClassToken,
  deriveLocalDomSearchPlan,
};
