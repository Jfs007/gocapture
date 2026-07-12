const path = require('path');
const { makeSnippet, uniq } = require('../../utils');
const {
  MAX_EXCERPT_CHARS,
  STYLE_EXTENSIONS,
} = require('./dom-utils');

function commentMask(text) {
  return String(text || '')
    .replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length))
    .replace(/\/\*[\s\S]*?\*\//g, match => ' '.repeat(match.length))
    .replace(/(^|[^:])\/\/.*$/gm, match => ' '.repeat(match.length));
}

function candidateExcerpt(text, candidate) {
  const positions = candidate.positions || [];
  if (!positions.length) return makeSnippet(text, 0, 0).slice(0, MAX_EXCERPT_CHARS);
  const start = Math.max(0, Math.min(...positions) - 1800);
  const end = Math.min(text.length, Math.max(...positions) + 2600);
  if (end - start <= MAX_EXCERPT_CHARS) return text.slice(start, end).trim();
  const chunks = positions.slice(0, 3).map(position => makeSnippet(text, position, 0));
  return uniq(chunks).join('\n\n').slice(0, MAX_EXCERPT_CHARS).trim();
}

function candidateSourceRole(filePath, text) {
  const ext = path.posix.extname(filePath || '').toLowerCase();
  const source = String(text || '');
  if (STYLE_EXTENSIONS.has(ext)) {
    return {
      role: 'style-reference',
      referenceOnly: true,
      valueProvider: false,
      reasons: ['样式文件只作为 UI 样式参考，不作为 DOM 渲染源码'],
    };
  }
  if (ext === '.json') {
    return {
      role: 'definition-like',
      referenceOnly: true,
      valueProvider: true,
      reasons: ['JSON 只承载数据/配置，不能直接生成 DOM，需要追踪其渲染使用处'],
    };
  }
  // .vue 单文件组件本质上就是渲染 DOM 的组件（无论用 <template> 还是 setup/render），
  // 一律视为渲染源码，避免因为脚本里有 export default {}/常量定义等信号被误判成 definition-like 参考文件。
  if (ext === '.vue') {
    return {
      role: 'render-like',
      referenceOnly: false,
      valueProvider: false,
      reasons: ['.vue 单文件组件是 DOM 渲染源码'],
    };
  }
  const renderSignals = [
    /<template[\s>]/i,
    /\bdefineComponent\s*\(/,
    /\bh\s*\(/,
    /\bcreateElement\s*\(/,
    /\bReact\.createElement\s*\(/,
    /\breturn\s*\(\s*</,
    /\bclassName\s*[=:]/,
    /\bclass\s*:\s*/,
    /\bclass\s*=/,
    /\bsetup\s*\(/,
    /\brender\s*[:=]\s*/,
  ];
  if (renderSignals.some(pattern => pattern.test(source))) {
    return {
      role: 'render-like',
      referenceOnly: false,
      valueProvider: false,
      reasons: ['源码包含渲染/组件结构信号'],
    };
  }
  const exportedValues = Array.from(source.matchAll(/\bexport\s+default\s+([A-Za-z_$][\w$]*)\s*;?/g), match => match[1]);
  const exportsTopLevelData = exportedValues.some(identifier => {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\s*=\\s*(?:\\[|\\{)`).test(source);
  });
  const definitionSignals = [
    /\bexport\s+default\s+\{/,
    /\bexport\s+(?:declare\s+)?const\s+\w+(?:\s*:\s*[^=]+)?\s*=\s*(?:\[|\{)/,
    /\bexport\s+(?:declare\s+)?const\s+\w+(?:\s*:\s*[^=]+)?\s*=\s*(?:["'`]|-?\d|true\b|false\b|null\b|Object\.freeze\s*\()/,
    /\bexport\s+default\s+\[/,
  ];
  if (exportsTopLevelData || definitionSignals.some(pattern => pattern.test(source))) {
    return {
      role: 'definition-like',
      referenceOnly: true,
      valueProvider: true,
      reasons: [exportsTopLevelData
        ? '文件导出顶层对象/数组数据，本身不生成 DOM，需要追踪其消费端'
        : '源码更像常量/文案/配置定义，需要结合引用链确认真实使用处'],
    };
  }
  const exportedFactoryValue = /\bexport\s+(?:declare\s+)?const\s+\w+(?:\s*:\s*[^=]+)?\s*=\s*(?:await\s+)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(/.test(source);
  if (exportedFactoryValue) {
    return {
      role: 'unknown',
      referenceOnly: false,
      valueProvider: true,
      reasons: ['文件导出工厂调用结果；本地无法仅凭语法确定它是数据还是渲染器，保留两种关系能力'],
    };
  }
  return {
    role: 'unknown',
    referenceOnly: false,
    valueProvider: false,
    reasons: [],
  };
}

module.exports = {
  commentMask,
  candidateExcerpt,
  candidateSourceRole,
};
