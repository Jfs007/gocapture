const {
  compactWhitespace,
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

module.exports = {
  stableDomSearchText,
  isLikelyRuntimeClassToken,
};
