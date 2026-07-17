'use strict';

// Usage doc extractor: 从真实业务文件里抽「公共能力怎么被使用」的调用单元。
// 它不是 Vue 专用：基础能力只依赖 import/require、HTML/JSX-like 标签、函数调用/new 调用和变量定义。

const path = require('path');
const { readProjectText } = require('../core/fs-utils');
const { escapeRegExp, uniq } = require('../utils');

function toKebab(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function toPascal(value) {
  return toKebab(value)
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function capabilityNames(capabilityPath, terms = []) {
  const base = String(capabilityPath || '').split('/').filter(Boolean).pop() || '';
  const seeds = uniq([base, ...terms].map(String).map(item => item.trim()).filter(Boolean));
  const result = [];
  for (const seed of seeds) {
    const kebab = toKebab(seed);
    const pascal = toPascal(seed);
    const camel = pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : '';
    result.push(seed, kebab, pascal, camel);
  }
  return uniq(result.filter(item => item && item.length >= 2));
}

function lineSlice(lines, start, end) {
  return lines.slice(Math.max(0, start), Math.min(lines.length, end)).join('\n').trim();
}

function mergeLineRanges(ranges, limit = 8) {
  const sorted = ranges
    .filter(range => range && Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else merged.push({ start: range.start, end: range.end });
  }
  return merged.slice(0, limit);
}

function sectionFromRanges(title, lines, ranges, maxChars = 1600) {
  const code = mergeLineRanges(ranges)
    .map(range => lineSlice(lines, range.start, range.end))
    .filter(Boolean)
    .join('\n// ...\n')
    .slice(0, maxChars)
    .trim();
  return code ? { title, code } : null;
}

function namePattern(names) {
  const values = names.map(escapeRegExp).join('|');
  return values ? new RegExp(values, 'i') : null;
}

function isImportLike(line) {
  return /\bimport\b|\bexport\b.+\bfrom\b|\brequire\s*\(/.test(line);
}

function isMarkupLikeCall(line, names) {
  return names.some(name => {
    if (!name) return false;
    const escaped = escapeRegExp(name);
    return new RegExp(`<\\s*${escaped}(?:\\s|>|/)`, 'i').test(line);
  });
}

function isCodeCall(line, names) {
  return names.some(name => {
    if (!name || name.includes('-')) return false;
    const escaped = escapeRegExp(name);
    return new RegExp(`\\b(?:new\\s+${escaped}|${escaped}\\s*\\(|use${escaped}\\s*\\()`, 'i').test(line);
  });
}

function findMultilineTag(lines, index) {
  let end = index + 1;
  while (end < lines.length && end < index + 18) {
    if (/>/.test(lines[end - 1])) break;
    end += 1;
  }
  return { start: Math.max(0, index - 1), end: Math.min(lines.length, end + 1) };
}

function identifiersFromText(text) {
  const result = [];
  const raw = String(text || '');
  const patterns = [
    /[:@]?[A-Za-z_$][\w$-]*\s*=\s*["']([^"']+)["']/g,
    /\{\s*([^}]+)\s*\}\s*=\s*/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(raw))) {
      const value = match[1] || '';
      for (const item of value.match(/[A-Za-z_$][\w$]*/g) || []) {
        if (!/^(true|false|null|undefined|return|const|let|var|function|class|import|from)$/.test(item)) {
          result.push(item);
        }
      }
    }
  }
  return uniq(result).slice(0, 20);
}

function definitionRange(lines, name) {
  const escaped = escapeRegExp(name);
  const startPattern = new RegExp(`\\b(?:const|let|var|function|class)\\s+${escaped}\\b|\\b(?:const|let|var)\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}\\s*=|^\\s*${escaped}\\s*[:=]`);
  const start = lines.findIndex(line => startPattern.test(line));
  if (start < 0) return null;
  let end = start + 1;
  let braceBalance = 0;
  let seenBrace = false;
  while (end < lines.length && end < start + 42) {
    const line = lines[end - 1];
    for (const char of line) {
      if (char === '{' || char === '[' || char === '(') {
        braceBalance += 1;
        seenBrace = true;
      } else if (char === '}' || char === ']' || char === ')') {
        braceBalance -= 1;
      }
    }
    if (end > start + 1) {
      const next = lines[end] || '';
      if ((!seenBrace || braceBalance <= 0) && /^\s*(const|let|var|function|class|import|export)\b/.test(next)) break;
      if ((!seenBrace || braceBalance <= 0) && /^\s*<\/script>/.test(next)) break;
    }
    end += 1;
  }
  return { start: Math.max(0, start - 1), end: Math.min(lines.length, end) };
}

function scoreUsagePath(filePath, capabilityPath = '') {
  const p = String(filePath || '');
  const ext = path.posix.extname(p).toLowerCase();
  let score = 0;
  if (p.startsWith('src/views/')) score += 120;
  if (/\/components\/.+\.(vue|tsx|jsx|ts|js)$/.test(p)) score += 35;
  if (/\.(vue|tsx|jsx)$/.test(p)) score += 25;
  if (/\.(ts|js)$/.test(p)) score += 8;
  if (/\/api\//.test(p) || /\/utils?\//.test(p) || /\/hooks?\//.test(p) || /\/store\//.test(p)) score -= 20;
  if (/\/style\/|\.s?css$|\.less$|\.d\.ts$|\/types?\//.test(p)) score -= 80;
  if (/\/index\.ts$|\/index\.js$/.test(p)) score -= 45;
  if (p === 'src/components/index.ts' || p === 'src/components/index.js') score -= 120;
  const normalizedCapability = String(capabilityPath || '').replace(/^src\//, '').replace(/\/+$/, '');
  if (normalizedCapability && (p === `src/${normalizedCapability}` || p.startsWith(`src/${normalizedCapability}/`))) score -= 200;
  if (!['.vue', '.tsx', '.jsx', '.ts', '.js'].includes(ext)) score -= 30;
  return score;
}

function rankUsageFiles(files, capabilityPath) {
  return uniq(files)
    .map(file => ({ file, score: scoreUsagePath(file, capabilityPath) }))
    .filter(item => item.score > -80)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .map(item => item.file);
}

function extractUsageDoc(project, options = {}) {
  const {
    capabilityPath = '',
    usagePath = '',
    terms = [],
    textCache = new Map(),
  } = options;
  const file = (project?.files || []).find(item => item.path === usagePath);
  if (!file) return null;
  const text = readProjectText(project, file, textCache);
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const names = capabilityNames(capabilityPath, terms);
  const pattern = namePattern(names);
  if (!pattern) return null;

  const importRanges = [];
  const callRanges = [];
  const hookRanges = [];
  lines.forEach((line, index) => {
    if (!pattern.test(line)) return;
    if (isImportLike(line)) importRanges.push({ start: index, end: index + 1 });
    else if (isMarkupLikeCall(line, names)) callRanges.push(findMultilineTag(lines, index));
    else if (isCodeCall(line, names)) hookRanges.push({ start: Math.max(0, index - 1), end: Math.min(lines.length, index + 4) });
    else callRanges.push({ start: Math.max(0, index - 1), end: Math.min(lines.length, index + 2) });
  });

  const callText = callRanges.map(range => lineSlice(lines, range.start, range.end)).join('\n');
  const variables = identifiersFromText(callText);
  const definitionRanges = variables
    .map(name => definitionRange(lines, name))
    .filter(Boolean);

  const sections = [
    sectionFromRanges('调用点', lines, callRanges, 1800),
    sectionFromRanges('导入依赖', lines, importRanges, 900),
    sectionFromRanges('相关 Hook / 函数调用', lines, hookRanges, 1100),
    sectionFromRanges('绑定变量定义', lines, definitionRanges, 1800),
  ].filter(Boolean);

  if (!sections.length) return null;
  const confidence = Math.min(0.95, 0.45 + (callRanges.length ? 0.25 : 0) + (importRanges.length ? 0.15 : 0) + (definitionRanges.length ? 0.1 : 0));
  return {
    usageFile: usagePath,
    confidence,
    names,
    variables,
    sections,
    markdown: renderUsageMarkdown({ capabilityPath, usagePath, confidence, sections, variables }),
  };
}

function renderUsageMarkdown(record) {
  return [
    `# ${record.capabilityPath}`,
    '',
    `使用者示例：${record.usagePath || '-'}`,
    `置信度：${record.confidence}`,
    record.variables?.length ? `关联变量：${record.variables.join('、')}` : '',
    '',
    ...record.sections.flatMap(section => [
      `## ${section.title}`,
      '```',
      section.code,
      '```',
      '',
    ]),
  ].filter(Boolean).join('\n');
}

module.exports = {
  capabilityNames,
  extractUsageDoc,
  rankUsageFiles,
  scoreUsagePath,
};
