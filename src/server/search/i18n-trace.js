const path = require('path');
const { isTextFile, readProjectText } = require('../core/fs-utils');
const { importedFiles, buildFileMap } = require('./import-trace');
const { findNeedleIndex, maskCommentsPreserveLength } = require('./evidence');
const { makeSnippet, uniq } = require('../utils');

const I18N_PACKAGE_HINTS = [
  'vue-i18n',
  'i18next',
  'react-i18next',
  'react-intl',
  '@formatjs/intl',
  '@formatjs/react-intl',
];

const I18N_CODE_HINTS = [
  'createI18n',
  'useI18n',
  'i18next.init',
  'IntlProvider',
  'formatMessage',
  'FormattedMessage',
];

function isSourceLikeFile(filePath) {
  return /\.(vue|jsx|tsx|js|ts|mjs|cjs|json)$/i.test(filePath || '');
}

function isLikelyI18nPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const base = path.posix.basename(normalized);
  return /(^|\/)(i18n|locales?|langs?|languages?|messages?)(\/|$)/i.test(normalized)
    || /(^|\/)(zh|zh-cn|zh_CN|en|en-us|en_US|ja|ko|fr|de|es|pt-br|ru)\.(js|ts|json)$/i.test(base)
    || /(^|\/)(messages|locale|locales|language|languages)\.(js|ts|json)$/i.test(base);
}

function isLikelyUiFile(filePath) {
  return /\.(vue|jsx|tsx)$/i.test(filePath || '')
    || /(^|\/)(views?|pages?|components?|layouts?|screens?)\//i.test(filePath || '');
}

function detectI18nEnvironment(project, textCache) {
  const packageText = String(project?.snippets?.['package.json'] || '');
  const packageHints = I18N_PACKAGE_HINTS.filter(item => packageText.includes(`"${item}"`));
  const i18nFiles = [];
  const codeHints = [];

  for (const file of project.files || []) {
    if (!isTextFile(file.path) || !isSourceLikeFile(file.path)) continue;
    const pathLooksI18n = isLikelyI18nPath(file.path);
    if (pathLooksI18n) i18nFiles.push(file.path);
    if (!pathLooksI18n && !/(^|\/)(src\/)?(i18n|locales?|langs?|languages?)[/.]/i.test(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    for (const hint of I18N_CODE_HINTS) {
      if (text.includes(hint)) codeHints.push(`${file.path}:${hint}`);
    }
  }

  const active = packageHints.length > 0 || i18nFiles.length >= 1 || codeHints.length > 0;
  return {
    active,
    packageHints: uniq(packageHints),
    i18nFiles: uniq(i18nFiles).slice(0, 80),
    codeHints: uniq(codeHints).slice(0, 20),
  };
}

function selectedTextPhrases(evidence) {
  return uniq((evidence?.phrases || [])
    .filter(item => item.label === '选区文案' || item.label === '用户补充证据')
    .map(item => String(item.text || '').replace(/\s+/g, ' ').trim())
    .filter(item => item.length >= 2 && item.length <= 80))
    .slice(0, 12);
}

function stripStringQuotes(value) {
  const text = String(value || '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function keyFromLine(line) {
  const text = String(line || '');
  const match = text.match(/(?:^\s*|[,{]\s*)(["'][^"']+["']|[A-Za-z_$][\w$-]*)\s*:/);
  return match ? stripStringQuotes(match[1]) : '';
}

function parentKeysBefore(lines, lineIndex, currentIndent) {
  const parents = [];
  let maxIndent = currentIndent;
  for (let index = lineIndex - 1; index >= 0; index--) {
    const line = lines[index] || '';
    if (!line.includes('{')) continue;
    const indent = line.match(/^\s*/)?.[0].length || 0;
    if (indent >= maxIndent) continue;
    const key = keyFromLine(line);
    if (!key) continue;
    parents.unshift(key);
    maxIndent = indent;
  }
  return parents.slice(-6);
}

function keyPathForString(text, stringIndex) {
  const before = text.slice(0, stringIndex);
  const lines = before.split('\n');
  const lineIndex = lines.length - 1;
  const allLines = text.split('\n');
  const line = allLines[lineIndex] || '';
  const currentKey = keyFromLine(line);
  if (!currentKey) return '';
  if (currentKey.includes('.')) return currentKey;
  const indent = line.match(/^\s*/)?.[0].length || 0;
  return [...parentKeysBefore(allLines, lineIndex, indent), currentKey].filter(Boolean).join('.');
}

function findI18nDefinitions(project, phrases, env, textCache) {
  const definitions = [];
  const i18nFileSet = new Set(env.i18nFiles || []);
  for (const filePath of i18nFileSet) {
    const file = (project.files || []).find(item => item.path === filePath);
    if (!file || !isTextFile(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    const searchable = maskCommentsPreserveLength(text);
    for (const phrase of phrases) {
      const index = findNeedleIndex(searchable, phrase);
      if (index === -1) continue;
      const keyPath = keyPathForString(text, index);
      if (!keyPath) continue;
      definitions.push({
        file: file.path,
        keyPath,
        phrase,
        snippet: makeSnippet(text, index, phrase.length),
      });
    }
  }
  return uniq(definitions.map(item => JSON.stringify(item))).map(item => JSON.parse(item)).slice(0, 40);
}

function importClosure(project, seeds, textCache, maxDepth = 8) {
  const fileMap = buildFileMap(project);
  const result = new Set();
  const queue = (seeds || []).filter(Boolean).map(file => ({ file, depth: 0 }));
  for (const item of queue) result.add(item.file);
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const child of importedFiles(project, current.file, fileMap, textCache)) {
      if (result.has(child.file)) continue;
      result.add(child.file);
      queue.push({ file: child.file, depth: current.depth + 1 });
    }
  }
  return result;
}

function keyUsagePatterns(keyPath) {
  const escaped = String(keyPath || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`(?:\\$t|t|i18n\\.t)\\s*\\(\\s*['"\`]${escaped}['"\`]`, 'i'),
    new RegExp(`formatMessage\\s*\\(\\s*\\{[^}]*\\bid\\s*:\\s*['"\`]${escaped}['"\`]`, 'i'),
    new RegExp(`\\b(?:id|i18nKey)\\s*=\\s*['"\`]${escaped}['"\`]`, 'i'),
    new RegExp(`['"\`]${escaped}['"\`]`, 'i'),
  ];
}

function dynamicKeyUsagePatterns(keyPath) {
  const parts = String(keyPath || '').split('.').filter(Boolean);
  if (parts.length < 2) return [];
  const prefix = `${parts.slice(0, -1).join('.')}.`;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`(?:\\$t|t|i18n\\.t)\\s*\\(\\s*['"\`]${escapedPrefix}['"\`]\\s*\\+`, 'i'),
    new RegExp(`(?:\\$t|t|i18n\\.t)\\s*\\(\\s*['"\`]${escapedPrefix}\\$\\{`, 'i'),
    new RegExp(`(?:\\$t|t|i18n\\.t)\\s*\\(\\s*\\w+\\s*\\+\\s*['"\`]${escapedPrefix}['"\`]`, 'i'),
  ];
}

function findKeyUsage(text, keyPath) {
  for (const pattern of keyUsagePatterns(keyPath)) {
    const match = pattern.exec(text);
    if (match) return { index: match.index, value: match[0], dynamic: false };
  }
  for (const pattern of dynamicKeyUsagePatterns(keyPath)) {
    const match = pattern.exec(text);
    if (match) return { index: match.index, value: match[0], dynamic: true };
  }
  return null;
}

function traceI18nUsages(project, definitions, routeHits, textCache) {
  const routeClosure = importClosure(project, (routeHits || []).slice(0, 1).map(item => item.file), textCache, 10);
  const hits = [];
  for (const definition of definitions) {
    for (const file of project.files || []) {
      if (!isTextFile(file.path) || !isSourceLikeFile(file.path)) continue;
      if (file.path === definition.file || isLikelyI18nPath(file.path)) continue;
      const text = readProjectText(project, file, textCache);
      const usage = findKeyUsage(text, definition.keyPath);
      if (!usage) continue;
      const routeBoost = routeClosure.has(file.path) ? 160 : 0;
      const uiBoost = isLikelyUiFile(file.path) ? 60 : 0;
      hits.push({
        file: file.path,
        score: 300 + routeBoost + uiBoost,
        stage: 'i18n-usage',
        stages: ['i18n-usage'],
        from: definition.file,
        apiEvidence: false,
        apiEvidenceReasons: [],
        apiEvidenceFrom: [],
        i18nEvidence: true,
        i18nKey: definition.keyPath,
        i18nText: definition.phrase,
        i18nDefinitionFile: definition.file,
        reasons: [
          `国际化文案命中：${definition.file}`,
          `国际化 key：${definition.keyPath} = ${definition.phrase}`,
          usage.dynamic ? `动态 key 前缀使用位置：${file.path}` : `key 使用位置：${file.path}`,
          routeClosure.has(file.path) ? 'key 使用文件处于当前页面 import 闭包' : '',
        ].filter(Boolean),
        snippet: makeSnippet(text, usage.index, usage.value.length),
        exactMatchLabel: '国际化文案',
        exactMatchText: definition.phrase,
        exactMatchCount: 1,
        exactSnippet: definition.snippet,
        contextScore: 80 + routeBoost,
        contextReasons: [usage.dynamic ? `i18n 动态 key 前缀使用：${definition.keyPath}` : `i18n key 使用：${definition.keyPath}`],
        contextSelectionIndex: 0,
        contextScope: 'i18n',
        contextLayerDepth: 0,
        contextStrongMatchCount: 1,
        preciseEvidence: true,
        preciseSnippet: makeSnippet(text, usage.index, usage.value.length),
        uniqueSnippet: definition.snippet,
        uniqueMatchLabel: '国际化文案',
        uniqueMatchText: definition.phrase,
        uniqueMatchCount: 1,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 20);
}

function definitionFallbackHits(definitions) {
  return definitions.map(definition => ({
    file: definition.file,
    score: 180,
    stage: 'i18n-definition',
    stages: ['i18n-definition'],
    from: '',
    apiEvidence: false,
    apiEvidenceReasons: [],
    apiEvidenceFrom: [],
    i18nEvidence: true,
    i18nKey: definition.keyPath,
    i18nText: definition.phrase,
    i18nDefinitionFile: definition.file,
    reasons: [
      `国际化文案定义：${definition.keyPath} = ${definition.phrase}`,
      '暂未找到 key 使用处，语言文件仅作为证据候选',
    ],
    snippet: definition.snippet,
    exactMatchLabel: '国际化文案',
    exactMatchText: definition.phrase,
    exactMatchCount: 1,
    exactSnippet: definition.snippet,
    contextScore: 30,
    contextReasons: [`i18n 文案定义：${definition.keyPath}`],
    contextSelectionIndex: 0,
    contextScope: 'i18n',
    contextLayerDepth: 0,
    contextStrongMatchCount: 1,
    preciseEvidence: false,
    preciseSnippet: '',
    uniqueSnippet: definition.snippet,
    uniqueMatchLabel: '国际化文案',
    uniqueMatchText: definition.phrase,
    uniqueMatchCount: 1,
  })).slice(0, 8);
}

function traceI18nReferences(project, body, evidence, textCache, routeHits = []) {
  const env = detectI18nEnvironment(project, textCache);
  if (!env.active) {
    return {
      active: false,
      environment: env,
      definitions: [],
      usages: [],
      hits: [],
    };
  }

  const phrases = selectedTextPhrases(evidence);
  const definitions = findI18nDefinitions(project, phrases, env, textCache);
  const usages = traceI18nUsages(project, definitions, routeHits, textCache);
  const hits = usages.length ? usages : definitionFallbackHits(definitions);

  return {
    active: true,
    environment: env,
    phrases,
    definitions,
    usages,
    hits,
  };
}

module.exports = {
  detectI18nEnvironment,
  traceI18nReferences,
};
