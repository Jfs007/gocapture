export function compactText(text: unknown, limit = 240) {
  let value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length > limit) value = `${value.slice(0, limit)}...`;
  return value;
}

export function escapeRegExp(value: unknown) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSearchTerms(text: unknown) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  const pieces = value
    .split(/[\n\r\t,，。；;|/\\()[\]{}<>:：]+|\s{2,}/)
    .map(item => item.trim())
    .filter(Boolean);
  const result: string[] = [];
  for (const piece of pieces) {
    if (result.length >= 24) break;
    if (/^\d+$/.test(piece)) continue;
    if (/^id[:：]?\s*\d+$/i.test(piece)) continue;
    if (piece.length < 2 || piece.length > 16) continue;
    result.push(piece);
  }
  return Array.from(new Set(result));
}
