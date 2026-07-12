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

module.exports = {
  stableDomSearchText,
};
