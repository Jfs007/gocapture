import { extractSearchTerms } from '../utils/text';

export function createSearchContextTools({ denoiseTextByApi }: { denoiseTextByApi: (text: string, limit?: number) => string }) {
  function contextTextTerms(info: any) {
    return extractSearchTerms(denoiseTextByApi(info?.text || ''));
  }

  function contextClassTerms(info: any) {
    return extractSearchTerms(info?.className || '');
  }

  function contextAttrTerms(info: any) {
    const attrs = info?.attrs || {};
    const terms: string[] = [];
    for (const [key, value] of Object.entries(attrs)) {
      if (String(value || '').trim() === '[present]') continue;
      terms.push(...extractSearchTerms(key));
      terms.push(...extractSearchTerms(value));
    }
    return Array.from(new Set(terms));
  }

  function contextStyleTerms(info: any) {
    const style = info?.computedStyle || {};
    const terms: string[] = [];
    for (const key of ['width', 'height', 'objectFit', 'fontSize', 'fontWeight', 'backgroundSize', 'backgroundPosition']) {
      terms.push(...extractSearchTerms(style[key] || ''));
    }
    return Array.from(new Set(terms));
  }

  function searchContextTerms(info: any) {
    return Array.from(new Set([
      ...contextTextTerms(info),
      ...contextClassTerms(info),
      ...contextAttrTerms(info),
      ...contextStyleTerms(info)
    ]));
  }

  function hasUsefulExpandedFallback(selfInfo: any, expandedInfo: any) {
    const selfText = String(denoiseTextByApi(selfInfo?.text || '') || '').replace(/\s+/g, ' ').trim();
    const expandedText = String(denoiseTextByApi(expandedInfo?.text || '') || '').replace(/\s+/g, ' ').trim();
    const selfTerms = new Set(searchContextTerms(selfInfo));
    const expandedTerms = searchContextTerms(expandedInfo);
    const addedTerms = expandedTerms.filter(term => !selfTerms.has(term));
    if (addedTerms.length >= 2) return true;
    if (contextTextTerms(expandedInfo).some(term => !selfTerms.has(term))
      && [
        ...contextClassTerms(expandedInfo),
        ...contextAttrTerms(expandedInfo),
        ...contextStyleTerms(expandedInfo)
      ].some(term => !selfTerms.has(term))) return true;
    if (selfText && expandedText && expandedText.length > selfText.length && expandedText.length <= 260) return true;
    if (!selfText && expandedText && expandedText.length <= 220) return true;
    return false;
  }

  function searchContextSpecificityScore(info: any) {
    const phrase = String(denoiseTextByApi(info?.text || '') || '').trim();
    const phraseScore = phrase.length >= 2 && phrase.length <= 32
      ? 14
      : phrase.length > 32
        ? 8
        : 0;
    return phraseScore
      + contextTextTerms(info).length * 6
      + contextClassTerms(info).length * 6
      + contextAttrTerms(info).length * 8
      + contextStyleTerms(info).length * 4;
  }

  function searchContextBreadthScore(info: any) {
    const subtree = info?.subtree || {};
    const nodeCount = Number(subtree.nodeCount || 0);
    const textCount = Array.isArray(subtree.texts) ? subtree.texts.length : 0;
    const attrCount = Array.isArray(subtree.attrs) ? subtree.attrs.length : 0;
    const styleCount = Array.isArray(subtree.styles) ? subtree.styles.length : 0;
    const textLength = String(denoiseTextByApi(info?.text || '') || '').length;
    const boxWidth = Number(info?.box?.width || 0);
    const boxHeight = Number(info?.box?.height || 0);
    const area = Math.max(0, boxWidth * boxHeight);
    return nodeCount * 2
      + textCount * 3
      + attrCount
      + styleCount
      + Math.min(30, Math.floor(textLength / 12))
      + Math.min(40, Math.floor(area / 50000));
  }

  function shouldKeepExpandedSearchContext(selfInfo: any, expandedInfo: any) {
    if (!selfInfo || !expandedInfo) return false;
    if (hasUsefulExpandedFallback(selfInfo, expandedInfo)) return true;
    const selfSpecificity = searchContextSpecificityScore(selfInfo);
    if (selfSpecificity < 18) return true;

    const selfTerms = new Set(searchContextTerms(selfInfo));
    const expandedTerms = searchContextTerms(expandedInfo);
    const novelTerms = expandedTerms.filter(term => !selfTerms.has(term));
    const breadthGap = searchContextBreadthScore(expandedInfo) - searchContextBreadthScore(selfInfo);

    if (novelTerms.length >= 4 && breadthGap <= 18) return true;
    return breadthGap <= 12;
  }

  return {
    shouldKeepExpandedSearchContext
  };
}
