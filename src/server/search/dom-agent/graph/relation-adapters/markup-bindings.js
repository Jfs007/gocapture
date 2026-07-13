'use strict';

const path = require('path');
const { registerRelationAdapter } = require('./registry');
const { NATIVE_HTML_TAGS } = require('../../anchor/dom-utils');

// 用权威的 HTML 原生标签标准集判定「哪些 <tag> 不是组件」，而不是手写一份必然不全的名单：
// 旧名单只有 ~30 个，漏掉 h1/video/canvas/dialog/code/strong/caption… —— 这些原生元素会被误判成组件、
// 生成假的 uses-component 边，污染关系图/路由遍历。标准集不含 <template>（Vue SFC 根、语言区域分隔标签），
// 单独补上，免得每个 .vue 都冒出一个 template「组件」。
const NATIVE_TAGS = new Set([...NATIVE_HTML_TAGS, 'template']);

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
