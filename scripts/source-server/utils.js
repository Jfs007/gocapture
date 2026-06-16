const { STOP_TOKENS } = require('./config');

function posixPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function uniq(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function hashRoutePath(hash) {
  const value = String(hash || '').replace(/^#/, '');
  if (!value) return '';
  const route = value.startsWith('!/') ? value.slice(1) : value;
  if (!route.startsWith('/')) return '';
  return route.split('?')[0] || '/';
}

function normalizeUrlPath(value) {
  const raw = String(value || '');
  try {
    const url = new URL(raw, 'http://local.invalid');
    return hashRoutePath(url.hash) || url.pathname;
  } catch (error) {
    const [beforeQuery] = raw.split('?');
    const hashIndex = beforeQuery.indexOf('#');
    if (hashIndex !== -1) {
      return hashRoutePath(beforeQuery.slice(hashIndex)) || beforeQuery.slice(0, hashIndex);
    }
    return beforeQuery;
  }
}

function makeSnippet(text, index, tokenLength) {
  const start = Math.max(0, index - 260);
  const end = Math.min(text.length, index + tokenLength + 520);
  return text.slice(start, end);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function kebabCase(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function tokenize(value) {
  return Array.from(new Set(String(value || '')
    .split(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]+/)
    .map(item => item.trim())
    .filter(item => {
      if (item.length < 2 || item.length > 40) return false;
      if (/^\d+$/.test(item)) return false;
      if (STOP_TOKENS.has(item.toLowerCase())) return false;
      return true;
    })));
}

module.exports = {
  escapeRegExp,
  kebabCase,
  makeSnippet,
  normalizeUrlPath,
  posixPath,
  tokenize,
  uniq,
};
