'use strict';

const path = require('path');
const { registerRelationAdapter } = require('./registry');

const NATIVE_TAGS = new Set([
  'a', 'article', 'aside', 'button', 'div', 'fieldset', 'footer', 'form', 'header', 'img',
  'input', 'label', 'legend', 'li', 'main', 'nav', 'ol', 'option', 'p', 'section', 'select',
  'span', 'table', 'tbody', 'td', 'textarea', 'th', 'thead', 'tr', 'ul', 'template',
]);

function normalizeComponentName(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_.\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function componentNamesForFile(filePath) {
  const ext = path.posix.extname(filePath || '');
  const basename = path.posix.basename(filePath || '', ext);
  const parent = path.posix.basename(path.posix.dirname(filePath || ''));
  const values = basename.toLowerCase() === 'index' ? [parent] : [basename];
  return Array.from(new Set(values.map(normalizeComponentName).filter(Boolean)));
}

function boundAttributes(rawAttributes) {
  const source = String(rawAttributes || '');
  const result = [];
  const patterns = [
    /(?:^|\s):([\w-]+)(?:\.[\w-]+)*\s*=\s*["']([^"']+)["']/g,
    /(?:^|\s)v-bind:([\w-]+)(?:\.[\w-]+)*\s*=\s*["']([^"']+)["']/g,
    /(?:^|\s)\[([\w-]+)\]\s*=\s*["']([^"']+)["']/g,
    /(?:^|\s)bind:([\w-]+)\s*=\s*["']([^"']+)["']/g,
    /(?:^|\s)([\w-]+)\s*=\s*\{([^{}]+)\}/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      result.push({ prop: match[1], expression: match[2].trim() });
    }
  }
  const shorthand = /(?:^|\s)\{([A-Za-z_$][\w$]*)\}(?=\s|$)/g;
  let match;
  while ((match = shorthand.exec(source))) {
    result.push({ prop: match[1], expression: match[1] });
  }
  return result;
}

function extractMarkupBindings({ file, text }) {
  const relations = [];
  const pattern = /<([A-Za-z][\w.-]*)\b([^<>]{0,4000})>/g;
  let match;
  while ((match = pattern.exec(String(text || '')))) {
    const component = normalizeComponentName(match[1]);
    if (!component || NATIVE_TAGS.has(component)) continue;
    const bindings = boundAttributes(match[2]);
    relations.push({
      type: 'uses-component',
      file,
      component,
      bindings,
      offset: match.index,
      excerpt: match[0].slice(0, 1200),
    });
  }
  return relations;
}

registerRelationAdapter({
  id: 'builtin.markup-bindings',
  supports: ({ file }) => /\.(?:vue|jsx|tsx|js|ts|html|svelte)$/i.test(file || ''),
  extract: extractMarkupBindings,
});

module.exports = {
  boundAttributes,
  componentNamesForFile,
  extractMarkupBindings,
  normalizeComponentName,
};
