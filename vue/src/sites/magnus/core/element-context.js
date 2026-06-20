export function round(value) {
  return Math.round(value);
}

export function compactText(text, limit = 240) {
  let value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length > limit) value = `${value.slice(0, limit)}...`;
  return value;
}

export function compactMarkup(text, limit = 720) {
  let value = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
  if (value.length > limit) value = `${value.slice(0, limit)}...`;
  return value;
}

export function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function flattenKeys(value, prefix = '', result = [], depth = 0, limit = 36) {
  if (!value || typeof value !== 'object' || depth > 2 || result.length >= limit) return result;
  const entries = Array.isArray(value)
    ? value.slice(0, 1).map((item, index) => [String(index), item])
    : Object.entries(value).slice(0, 18);
  for (const [key, child] of entries) {
    if (result.length >= limit) break;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    result.push(fullKey);
    if (child && typeof child === 'object') flattenKeys(child, fullKey, result, depth + 1, limit);
  }
  return result;
}

export function flattenPrimitiveValues(value, result = [], depth = 0, limit = 80) {
  if (result.length >= limit || depth > 3 || value == null) return result;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (text.length >= 2 && text.length <= 80 && !/^(true|false|null|undefined)$/i.test(text)) {
      result.push(text);
    }
    return result;
  }
  if (typeof value !== 'object') return result;
  const entries = Array.isArray(value)
    ? value.slice(0, 8).map((item, index) => [String(index), item])
    : Object.entries(value).slice(0, 28);
  for (const [, child] of entries) {
    if (result.length >= limit) break;
    flattenPrimitiveValues(child, result, depth + 1, limit);
  }
  return result;
}

export function normalizeRequestInfo(raw, baseUrl) {
  const data = raw || {};
  let pathname = data.url || '';
  try {
    pathname = new URL(data.url, baseUrl).pathname;
  } catch (error) {
  }
  return {
    url: data.url || '',
    pathname,
    method: data.method || 'GET',
    requestKeys: flattenKeys(data.request?.body || {}, '', [], 0, 28),
    responseKeys: flattenKeys(data.result || {}, '', [], 0, 36),
    responseValues: flattenPrimitiveValues(data.result || {}, [], 0, 80),
    capturedAt: Date.now()
  };
}

export function getClassName(element) {
  if (!element) return '';
  const value = element.getAttribute ? element.getAttribute('class') : element.className;
  return compactText(typeof value === 'string' ? value : '', 320);
}

export function getElementText(element) {
  return compactText(element.innerText || element.textContent || '', 320);
}

export function getComparableElementText(element, normalizeText, limit = 1200) {
  const raw = String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (typeof normalizeText === 'function') {
    return String(normalizeText(raw, limit) || '').replace(/\s+/g, ' ').trim();
  }
  return compactText(raw, limit);
}

export function extractSearchTerms(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  const pieces = value
    .split(/[\n\r\t,，。；;|/\\()[\]{}<>:：]+|\s{2,}/)
    .map(item => item.trim())
    .filter(Boolean);
  const result = [];
  for (const piece of pieces) {
    if (result.length >= 24) break;
    if (/^\d+$/.test(piece)) continue;
    if (/^id[:：]?\s*\d+$/i.test(piece)) continue;
    if (piece.length < 2 || piece.length > 16) continue;
    result.push(piece);
  }
  return Array.from(new Set(result));
}

export function getStyleInfo(element) {
  const style = window.getComputedStyle(element);
  const hasBackgroundImage = style.backgroundImage && style.backgroundImage !== 'none';
  return {
    display: style.display,
    position: style.position,
    color: style.color,
    backgroundColor: style.backgroundColor,
    backgroundImage: hasBackgroundImage ? '[present]' : '',
    backgroundSize: style.backgroundSize,
    backgroundPosition: style.backgroundPosition,
    backgroundRepeat: style.backgroundRepeat,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    textAlign: style.textAlign,
    border: style.border,
    borderRadius: style.borderRadius,
    margin: style.margin,
    padding: style.padding,
    gap: style.gap,
    alignItems: style.alignItems,
    justifyContent: style.justifyContent,
    objectFit: style.objectFit,
    width: style.width,
    height: style.height
  };
}

export function getFirstClassName(element) {
  const list = Array.from(element?.classList || []);
  return compactText(list[0] || '', 120);
}

export function getDirectText(element) {
  if (!element || !element.childNodes) return '';
  const text = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.nodeValue || '')
    .join(' ');
  return compactText(text, 160);
}

export function getSubtreeStyleEvidence(element) {
  if (!element) return null;
  const inlineStyle = compactText(element.getAttribute?.('style') || '', 240);
  const style = getStyleInfo(element);
  const result = {};
  const backgroundColor = String(style.backgroundColor || '').trim();
  const color = String(style.color || '').trim();

  if (inlineStyle) result.inlineStyle = inlineStyle;
  if (style.display && /flex|grid|table|inline-flex|inline-grid/i.test(style.display)) result.display = style.display;
  if (style.position && /absolute|fixed|sticky/i.test(style.position)) result.position = style.position;
  if (color && !/^rgb\(0,\s*0,\s*0\)$/i.test(color)) result.color = color;
  if (backgroundColor && !/^(rgba\(0,\s*0,\s*0,\s*0\)|transparent)$/i.test(backgroundColor)) {
    result.backgroundColor = backgroundColor;
  }
  if (style.backgroundImage && style.backgroundImage !== 'none') result.backgroundImage = '[present]';
  if (style.backgroundSize && style.backgroundSize !== 'auto') result.backgroundSize = style.backgroundSize;
  if (style.backgroundPosition && style.backgroundPosition !== '0% 0%') result.backgroundPosition = style.backgroundPosition;
  if (style.fontSize) result.fontSize = style.fontSize;
  if (style.fontWeight && !/^400$|^normal$/i.test(style.fontWeight)) result.fontWeight = style.fontWeight;
  if (style.textAlign && !/^start|left$/i.test(style.textAlign)) result.textAlign = style.textAlign;
  if (style.borderRadius && !/^0(px)?$/i.test(style.borderRadius)) result.borderRadius = style.borderRadius;
  if (style.objectFit && style.objectFit !== 'fill') result.objectFit = style.objectFit;
  if (style.width && !/^auto$/i.test(style.width)) result.width = style.width;
  if (style.height && !/^auto$/i.test(style.height)) result.height = style.height;

  return Object.keys(result).length ? result : null;
}

export function getSubtreeEvidence(element, options = {}) {
  if (!element) {
    return {
      classNames: [],
      texts: [],
      attrs: [],
      styles: [],
      nodeCount: 0
    };
  }

  const nodeLimit = options.nodeLimit || 80;
  const queue = [element];
  const classNames = [];
  const texts = [];
  const attrs = [];
  const styles = [];
  const nodes = [];
  let inspected = 0;

  const addUnique = (list, value, limit) => {
    const text = compactText(value, 240);
    if (!text || list.includes(text) || list.length >= limit) return;
    list.push(text);
  };

  while (queue.length && inspected < nodeLimit) {
    const node = queue.shift();
    if (!node || node.nodeType !== 1) continue;
    const tag = String(node.tagName || '').toLowerCase();
    if (['script', 'style', 'noscript', 'template'].includes(tag)) continue;
    inspected++;

    const className = getClassName(node);
    const firstClassName = getFirstClassName(node);
    const directText = getDirectText(node);
    const attrInfo = getElementAttrs(node);
    const styleInfo = getSubtreeStyleEvidence(node);

    addUnique(classNames, firstClassName, options.classLimit || 48);

    if (node === element) addUnique(texts, getElementText(node), options.textLimit || 48);
    addUnique(texts, directText, options.textLimit || 48);

    for (const [key, value] of Object.entries(attrInfo)) {
      if (!value || attrs.length >= (options.attrLimit || 48)) continue;
      attrs.push({
        tag,
        className: firstClassName,
        key,
        value: compactText(value, 240)
      });
    }

    if (styleInfo && styles.length < (options.styleLimit || 36)) {
      styles.push({
        tag,
        className: firstClassName,
        style: styleInfo
      });
    }

    if (nodes.length < (options.nodeSummaryLimit || 48)) {
      nodes.push({
        tag,
        className,
        firstClassName,
        text: directText,
        attrs: attrInfo,
        style: styleInfo || null
      });
    }

    for (const child of Array.from(node.children || [])) {
      if (queue.length + inspected >= nodeLimit) break;
      queue.push(child);
    }
  }

  return {
    classNames,
    texts,
    attrs,
    styles,
    nodes,
    nodeCount: inspected
  };
}

export function getElementAttrs(element) {
  if (!element || !element.tagName) return {};
  const tag = element.tagName.toLowerCase();
  const attrs = {};
  const commonAttrs = ['id', 'name', 'role', 'title', 'aria-label', 'placeholder', 'href'];
  for (const key of commonAttrs) {
    const value = element.getAttribute?.(key);
    if (value) attrs[key] = compactText(value, 240);
  }
  for (const attr of Array.from(element.attributes || [])) {
    const key = String(attr.name || '').toLowerCase();
    if (!key.startsWith('data-') || /^data-v-/.test(key)) continue;
    const value = element.getAttribute?.(key);
    attrs[key] = value ? compactText(value, 240) : '[present]';
  }
  let hasMediaSource = false;
  for (const key of ['src', 'srcset', 'poster', 'data-src', 'data-original', 'data-lazy-src']) {
    const value = element.getAttribute?.(key);
    if (value) {
      attrs[key] = '[present]';
      hasMediaSource = true;
    }
  }
  if (tag === 'img') {
    if (element.currentSrc || element.src) {
      attrs.src = '[present]';
      hasMediaSource = true;
    }
    if (element.alt) attrs.alt = compactText(element.alt, 240);
    if (element.getAttribute?.('width')) attrs.width = compactText(element.getAttribute('width'), 40);
    if (element.getAttribute?.('height')) attrs.height = compactText(element.getAttribute('height'), 40);
  }
  if (tag === 'img' || hasMediaSource) attrs['magnus-media'] = 'image';
  return attrs;
}

export function getSelectorPart(element) {
  if (!element || !element.tagName) return '';
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = Array.from(element.classList || []).slice(0, 3).map(name => `.${name}`).join('');
  return `${tag}${id}${classes}`;
}

export function getSelectorPath(element, limit = 4) {
  const parts = [];
  let node = element;
  while (node && node.nodeType === 1 && parts.length < limit) {
    parts.unshift(getSelectorPart(node));
    if (node.id) break;
    node = node.parentElement;
  }
  return parts.join(' > ');
}

function addEvidenceTerms(target, values, perValueLimit = 12, totalLimit = 72) {
  if (!(target instanceof Set) || target.size >= totalLimit) return;
  for (const value of values) {
    if (target.size >= totalLimit) break;
    for (const term of extractSearchTerms(value).slice(0, perValueLimit)) {
      target.add(term);
      if (target.size >= totalLimit) break;
    }
  }
}

function evidenceGrowth(baseSet, nextSet) {
  let added = 0;
  let duplicated = 0;
  for (const item of nextSet || []) {
    if (baseSet?.has(item)) duplicated++;
    else added++;
  }
  return { added, duplicated };
}

export function getContextEvidence(element, options = {}) {
  if (!element) {
    return {
      text: '',
      nodeCount: 0,
      textTerms: new Set(),
      classTerms: new Set(),
      attrTerms: new Set(),
      styleTerms: new Set()
    };
  }
  const normalizeText = options.normalizeText;
  const subtree = getSubtreeEvidence(element, options.subtreeOptions || {
    nodeLimit: 40,
    classLimit: 24,
    textLimit: 24,
    attrLimit: 24,
    styleLimit: 16
  });
  const attrs = getElementAttrs(element);
  const text = getComparableElementText(element, normalizeText, options.textLimit || 1200);
  const textTerms = new Set();
  const classTerms = new Set();
  const attrTerms = new Set();
  const styleTerms = new Set();

  addEvidenceTerms(textTerms, [text, ...subtree.texts], 12, 36);
  addEvidenceTerms(classTerms, [getClassName(element), ...subtree.classNames], 8, 24);
  addEvidenceTerms(attrTerms, Object.entries(attrs).flatMap(([key, value]) => [key, value]), 8, 24);
  addEvidenceTerms(attrTerms, subtree.attrs.flatMap(item => [item?.key, item?.value]), 8, 36);
  addEvidenceTerms(styleTerms, subtree.styles.flatMap(item => {
    return Object.entries(item?.style || {}).flatMap(([key, value]) => [key, value]);
  }), 8, 24);

  return {
    text,
    nodeCount: subtree.nodeCount || 0,
    textTerms,
    classTerms,
    attrTerms,
    styleTerms
  };
}

export function scoreContextPromotion(baseEvidence, nextEvidence) {
  const textGrowth = evidenceGrowth(baseEvidence?.textTerms, nextEvidence?.textTerms);
  const classGrowth = evidenceGrowth(baseEvidence?.classTerms, nextEvidence?.classTerms);
  const attrGrowth = evidenceGrowth(baseEvidence?.attrTerms, nextEvidence?.attrTerms);
  const styleGrowth = evidenceGrowth(baseEvidence?.styleTerms, nextEvidence?.styleTerms);

  const novelScore = textGrowth.added * 4
    + classGrowth.added * 3
    + attrGrowth.added * 5
    + styleGrowth.added * 2;
  const duplicatePenalty = textGrowth.duplicated
    + classGrowth.duplicated
    + attrGrowth.duplicated
    + styleGrowth.duplicated;
  const breadthPenalty = Math.max(0, Number(nextEvidence?.nodeCount || 0) - Number(baseEvidence?.nodeCount || 0) - 4) * 2;
  const textLengthPenalty = Math.max(0, String(nextEvidence?.text || '').length - String(baseEvidence?.text || '').length - 160) / 24;
  const score = novelScore - duplicatePenalty - breadthPenalty - textLengthPenalty;

  return {
    score,
    novelCount: textGrowth.added + classGrowth.added + attrGrowth.added + styleGrowth.added,
    duplicateCount: duplicatePenalty,
    breadthPenalty
  };
}

export function shouldPromoteContext(baseEvidence, nextEvidence) {
  const result = scoreContextPromotion(baseEvidence, nextEvidence);
  if (result.novelCount <= 0) return false;
  if (result.novelCount >= 3 && result.score >= 6) return true;
  if (result.novelCount >= 2 && result.score >= 8) return true;
  return result.score >= 10;
}

export function getAncestorInfo(element, options = {}) {
  const result = [];
  let node = element.parentElement;
  let currentEvidence = getContextEvidence(element, {
    normalizeText: options.normalizeText,
    subtreeOptions: {
      nodeLimit: 40,
      classLimit: 24,
      textLimit: 24,
      attrLimit: 24,
      styleLimit: 16
    }
  });
  let inspected = 0;
  while (node && node !== document.body && result.length < 4 && inspected < 16) {
    inspected++;
    const nextEvidence = getContextEvidence(node, {
      normalizeText: options.normalizeText,
      subtreeOptions: {
        nodeLimit: 40,
        classLimit: 24,
        textLimit: 24,
        attrLimit: 24,
        styleLimit: 16
      }
    });
    if (!shouldPromoteContext(currentEvidence, nextEvidence)) {
      node = node.parentElement;
      continue;
    }
    const comparableText = nextEvidence.text;
    const rect = node.getBoundingClientRect();
    result.push({
      tag: node.tagName.toLowerCase(),
      selector: getSelectorPath(node),
      className: getClassName(node),
      attrs: getElementAttrs(node),
      text: compactText(comparableText, 180),
      subtree: getSubtreeEvidence(node, {
        nodeLimit: 64,
        classLimit: 36,
        textLimit: 36,
        attrLimit: 36,
        styleLimit: 28
      }),
      inlineStyle: compactText(node.getAttribute?.('style') || '', 240),
      computedStyle: getStyleInfo(node),
      box: {
        x: round(rect.left + window.scrollX),
        y: round(rect.top + window.scrollY),
        width: round(rect.width),
        height: round(rect.height)
      }
    });
    currentEvidence = nextEvidence;
    node = node.parentElement;
  }
  return result;
}

export function getElementInfo(element, options = {}) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    tag: element.tagName.toLowerCase(),
    selector: getSelectorPath(element),
    className: getClassName(element),
    attrs: getElementAttrs(element),
    text: getElementText(element),
    subtree: getSubtreeEvidence(element),
    innerHtml: compactMarkup(element.innerHTML || '', 960),
    outerHtml: compactMarkup(element.outerHTML || '', 1200),
    inlineStyle: compactText(element.getAttribute?.('style') || '', 480),
    computedStyle: getStyleInfo(element),
    ancestors: getAncestorInfo(element, options),
    box: {
      x: round(rect.left + window.scrollX),
      y: round(rect.top + window.scrollY),
      width: round(rect.width),
      height: round(rect.height)
    },
    viewportBox: {
      left: round(rect.left),
      top: round(rect.top),
      width: round(rect.width),
      height: round(rect.height)
    }
  };
}
