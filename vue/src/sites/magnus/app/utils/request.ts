export function flattenKeys(value: unknown, prefix = '', result: string[] = [], depth = 0, limit = 36) {
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

export function flattenPrimitiveValues(value: unknown, result: string[] = [], depth = 0, limit = 80) {
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

export function normalizeHeaders(value: unknown) {
  if (!value) return {};
  if (typeof Headers !== 'undefined' && value instanceof Headers) {
    const result: Record<string, string> = {};
    value.forEach((headerValue, headerKey) => {
      result[String(headerKey).toLowerCase()] = String(headerValue || '');
    });
    return result;
  }
  if (Array.isArray(value)) {
    return value.reduce<Record<string, string>>((result, item) => {
      if (Array.isArray(item) && item.length >= 2) {
        result[String(item[0]).toLowerCase()] = String(item[1] || '');
      }
      return result;
    }, {});
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, string>>((result, [key, headerValue]) => {
      result[String(key).toLowerCase()] = String(headerValue || '');
      return result;
    }, {});
  }
  return {};
}

export function normalizeRequestInfo(raw: any, baseUrl: string) {
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
    headers: normalizeHeaders(data.request?.headers || data.headers),
    requestKeys: flattenKeys(data.request?.body || {}, '', [], 0, 28),
    responseKeys: flattenKeys(data.result || {}, '', [], 0, 36),
    responseValues: flattenPrimitiveValues(data.result || {}, [], 0, 80),
    capturedAt: Date.now()
  };
}
