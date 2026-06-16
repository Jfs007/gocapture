export function round(value) {
  return Math.round(value);
}

export function compactText(text, limit = 240) {
  let value = String(text || '').replace(/\s+/g, ' ').trim();
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
  return {
    display: style.display,
    position: style.position,
    color: style.color,
    backgroundColor: style.backgroundColor,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    margin: style.margin,
    padding: style.padding,
    width: style.width,
    height: style.height
  };
}

export function getAncestorInfo(element) {
  const result = [];
  let node = element.parentElement;
  while (node && node !== document.body && result.length < 4) {
    result.push({
      tag: node.tagName.toLowerCase(),
      className: getClassName(node),
      text: compactText(node.innerText || node.textContent || '', 120)
    });
    node = node.parentElement;
  }
  return result;
}

export function getElementInfo(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    tag: element.tagName.toLowerCase(),
    className: getClassName(element),
    text: getElementText(element),
    computedStyle: getStyleInfo(element),
    ancestors: getAncestorInfo(element),
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
