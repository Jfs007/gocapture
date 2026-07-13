const { isTextFile, readProjectText } = require('../../core/fs-utils');
const { findNeedleIndex, maskCommentsPreserveLength } = require('./evidence');
const { makeSnippet, uniq } = require('../../utils');

function optionalRequire(name) {
  try {
    return require(name);
  } catch (error) {
    return null;
  }
}

const babelParser = optionalRequire('@babel/parser');

function isSourceLikeFile(filePath) {
  return /\.(vue|jsx|tsx|js|ts|mjs|cjs|json)$/i.test(filePath || '');
}

function isScriptLikeFile(filePath) {
  return /\.(jsx|tsx|js|ts|mjs|cjs)$/i.test(filePath || '');
}

function selectedTextPhrases(evidence) {
  return uniq((evidence?.phrases || [])
    .filter(item => item.label === '选区文案' || item.label === '用户补充证据')
    .map(item => String(item.text || '').replace(/\s+/g, ' ').trim())
    .filter(item => item.length >= 2 && item.length <= 80))
    .slice(0, 12);
}

function parseAst(text, filePath) {
  if (!babelParser || !isScriptLikeFile(filePath)) return null;
  try {
    return babelParser.parse(String(text || ''), {
      sourceType: 'unambiguous',
      errorRecovery: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'objectRestSpread',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        'importMeta',
        'topLevelAwait',
      ],
    });
  } catch (error) {
    return null;
  }
}

function nodeName(node) {
  if (!node) return '';
  if (node.name) return node.name;
  if (node.value != null) return String(node.value);
  return '';
}

function literalText(node) {
  if (!node) return '';
  if (node.type === 'StringLiteral') return String(node.value || '');
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateElement') return String(node.value?.cooked || node.value?.raw || '');
  return '';
}

function nearestAncestor(stack, test) {
  for (let index = stack.length - 1; index >= 0; index--) {
    if (test(stack[index])) return stack[index];
  }
  return null;
}

function objectKeyPath(stack) {
  const keys = [];
  for (const node of stack) {
    if (!/^(ObjectProperty|Property)$/.test(node?.type || '')) continue;
    const key = nodeName(node.key);
    if (key) keys.push(key);
  }
  return keys.join('.');
}

function enclosingSymbol(stack) {
  const variable = nearestAncestor(stack, node => node?.type === 'VariableDeclarator' && node.id?.name);
  if (variable) return variable.id.name;
  const enumNode = nearestAncestor(stack, node => node?.type === 'TSEnumDeclaration' && node.id?.name);
  if (enumNode) return enumNode.id.name;
  const functionNode = nearestAncestor(stack, node => /^(FunctionDeclaration|ClassDeclaration)$/.test(node?.type || '') && node.id?.name);
  return functionNode?.id?.name || '';
}

function enumMemberKey(stack) {
  const member = nearestAncestor(stack, node => node?.type === 'TSEnumMember');
  return nodeName(member?.id);
}

function traverse(node, stack, visit) {
  if (!node || typeof node !== 'object') return;
  const nextStack = node.type ? [...stack, node] : stack;
  if (node.type) visit(node, nextStack);
  for (const [key, value] of Object.entries(node)) {
    if (
      key === 'loc' ||
      key === 'start' ||
      key === 'end' ||
      key === 'leadingComments' ||
      key === 'trailingComments' ||
      key === 'innerComments' ||
      key === 'extra'
    ) continue;
    if (Array.isArray(value)) {
      for (const item of value) traverse(item, nextStack, visit);
      continue;
    }
    if (value && typeof value === 'object') traverse(value, nextStack, visit);
  }
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

function dedupeDefinitions(definitions) {
  const seen = new Set();
  const result = [];
  for (const definition of definitions) {
    const key = [definition.file, definition.phrase, definition.symbol, definition.keyPath, definition.memberKey].join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(definition);
  }
  return result.slice(0, 60);
}

function findAstDefinitions(file, text, phrases) {
  const ast = parseAst(text, file.path);
  if (!ast) return [];
  const definitions = [];
  traverse(ast, [], (node, stack) => {
    const value = literalText(node).replace(/\s+/g, ' ').trim();
    if (!value) return;
    const phrase = phrases.find(item => value === item);
    if (!phrase) return;
    const symbol = enclosingSymbol(stack);
    const memberKey = enumMemberKey(stack);
    const keyPath = memberKey || objectKeyPath(stack);
    if (!symbol && !keyPath) return;
    definitions.push({
      file: file.path,
      phrase,
      symbol,
      keyPath,
      memberKey,
      snippet: makeSnippet(text, node.start || 0, phrase.length),
    });
  });
  return definitions;
}

function findLineDefinitions(file, text, phrases) {
  const definitions = [];
  const searchable = maskCommentsPreserveLength(text);
  for (const phrase of phrases) {
    const index = findNeedleIndex(searchable, phrase);
    if (index === -1) continue;
    const keyPath = keyPathForString(text, index);
    if (!keyPath) continue;
    definitions.push({
      file: file.path,
      phrase,
      symbol: '',
      keyPath,
      memberKey: keyPath.split('.').filter(Boolean).at(-1) || '',
      snippet: makeSnippet(text, index, phrase.length),
    });
  }
  return definitions;
}

function findLiteralDefinitions(project, phrases, textCache) {
  const definitions = [];
  for (const file of project.files || []) {
    if (!isTextFile(file.path) || !isSourceLikeFile(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    definitions.push(...findAstDefinitions(file, text, phrases));
    definitions.push(...findLineDefinitions(file, text, phrases));
  }
  return dedupeDefinitions(definitions);
}

function usagePatterns(definition) {
  const symbol = String(definition.symbol || '').trim();
  const member = String(definition.memberKey || definition.keyPath?.split('.').at(-1) || '').trim();
  const keyPath = String(definition.keyPath || '').trim();
  const patterns = [];
  if (symbol && member) {
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedMember = member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    patterns.push(new RegExp(`\\b${escapedSymbol}\\s*\\.\\s*${escapedMember}\\b`));
    patterns.push(new RegExp(`\\b${escapedSymbol}\\s*\\[\\s*['"\`]${escapedMember}['"\`]\\s*\\]`));
  }
  if (symbol) {
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    patterns.push(new RegExp(`\\b${escapedSymbol}\\b`));
  }
  if (keyPath && keyPath.includes('.')) {
    const escapedKeyPath = keyPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    patterns.push(new RegExp(`['"\`]${escapedKeyPath}['"\`]`));
  }
  return patterns;
}

function findDefinitionUsage(text, definition) {
  for (const pattern of usagePatterns(definition)) {
    const match = pattern.exec(text);
    if (match) return { index: match.index, value: match[0] };
  }
  return null;
}

function traceDefinitionUsages(project, definitions, textCache) {
  const hits = [];
  for (const definition of definitions) {
    const patterns = usagePatterns(definition);
    if (!patterns.length) continue;
    for (const file of project.files || []) {
      if (!isTextFile(file.path) || !isSourceLikeFile(file.path) || file.path === definition.file) continue;
      const text = readProjectText(project, file, textCache);
      const usage = findDefinitionUsage(text, definition);
      if (!usage) continue;
      hits.push({
        file: file.path,
        score: 280,
        stage: 'definition-usage',
        stages: ['definition-usage'],
        from: definition.file,
        definitionEvidence: true,
        definitionFile: definition.file,
        definitionSymbol: definition.symbol,
        definitionKeyPath: definition.keyPath,
        definitionText: definition.phrase,
        preciseEvidence: true,
        exactMatchLabel: '字面量定义',
        exactMatchText: definition.phrase,
        exactMatchCount: 1,
        exactSnippet: definition.snippet,
        preciseSnippet: makeSnippet(text, usage.index, usage.value.length),
        uniqueSnippet: definition.snippet,
        uniqueMatchLabel: '字面量定义',
        uniqueMatchText: definition.phrase,
        uniqueMatchCount: 1,
        contextScore: 70,
        contextReasons: [`字面量定义使用：${definition.symbol || definition.keyPath}`],
        contextScope: 'definition',
        contextLayerDepth: 0,
        contextStrongMatchCount: 1,
        reasons: [
          `字面量定义：${definition.file}`,
          definition.symbol ? `定义符号：${definition.symbol}` : '',
          definition.keyPath ? `定义 key：${definition.keyPath}` : '',
          `定义文案：${definition.phrase}`,
          `定义使用位置：${file.path}`,
        ].filter(Boolean),
        snippet: makeSnippet(text, usage.index, usage.value.length),
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 20);
}

function definitionFallbackHits(definitions) {
  return definitions.map(definition => ({
    file: definition.file,
    score: 160,
    stage: 'definition-context',
    stages: ['definition-context'],
    from: '',
    definitionEvidence: true,
    definitionFile: definition.file,
    definitionSymbol: definition.symbol,
    definitionKeyPath: definition.keyPath,
    definitionText: definition.phrase,
    preciseEvidence: false,
    exactMatchLabel: '字面量定义',
    exactMatchText: definition.phrase,
    exactMatchCount: 1,
    exactSnippet: definition.snippet,
    uniqueSnippet: definition.snippet,
    uniqueMatchLabel: '字面量定义',
    uniqueMatchText: definition.phrase,
    uniqueMatchCount: 1,
    contextScore: 24,
    contextReasons: [`字面量定义：${definition.symbol || definition.keyPath}`],
    contextScope: 'definition',
    contextLayerDepth: 0,
    contextStrongMatchCount: 1,
    reasons: [
      `字面量定义：${definition.file}`,
      definition.symbol ? `定义符号：${definition.symbol}` : '',
      definition.keyPath ? `定义 key：${definition.keyPath}` : '',
      `定义文案：${definition.phrase}`,
      '暂未找到定义使用处，定义文件仅作为证据候选',
    ].filter(Boolean),
    snippet: definition.snippet,
  })).slice(0, 8);
}

function traceDefinitionReferences(project, body, evidence, textCache) {
  const phrases = selectedTextPhrases(evidence);
  const definitions = findLiteralDefinitions(project, phrases, textCache);
  const usages = traceDefinitionUsages(project, definitions, textCache);
  return {
    active: definitions.length > 0,
    phrases,
    definitions,
    usages,
    hits: usages.length ? usages : definitionFallbackHits(definitions),
  };
}

module.exports = {
  traceDefinitionReferences,
};
