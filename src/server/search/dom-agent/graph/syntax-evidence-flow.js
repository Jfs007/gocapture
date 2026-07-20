'use strict';

const path = require('path');
const { readProjectText } = require('../../../core/fs-utils');
const { escapeRegExp, posixPath, uniq } = require('../../../utils');
const { buildFileMap, importedFiles } = require('../../import-trace');

const MAX_CONSUMERS = 8;
const MAX_CHAINS_PER_CONSUMER = 3;
const MAX_NODES_PER_CHAIN = 8;
const MAX_SYMBOL_REFS = 24;
const MAX_NODE_CHARS = 2400;
const MAX_SYMBOL_HOPS = 3;

const JS_KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'of',
  'return',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
]);

function quotedValues(text) {
  const result = [];
  let match;
  const pattern = /(['"`])((?:\\.|(?!\1)[\s\S]){0,500}?)\1/g;
  while ((match = pattern.exec(String(text || '')))) {
    result.push({ value: match[2], index: match.index + 1 });
  }
  return result;
}

function targetPathTerms(targetFile) {
  const file = posixPath(targetFile);
  const ext = path.posix.extname(file);
  const basename = path.posix.basename(file);
  const basenameNoExt = ext ? basename.slice(0, -ext.length) : basename;
  const parent = path.posix.basename(path.posix.dirname(file));
  return uniq([
    basename,
    basenameNoExt,
    ext ? file.slice(0, -ext.length) : file,
    `${parent}/${basenameNoExt}`,
    `${parent}/${basename}`,
  ]);
}

function relativeGlobBase(fromFile, specifier) {
  const spec = String(specifier || '').trim();
  if (!spec.startsWith('.') || !spec.includes('*')) return '';
  const beforeGlob = spec.split('*')[0].replace(/\/+$/, '');
  if (!beforeGlob) return '';
  return posixPath(path.posix.join(path.posix.dirname(fromFile), beforeGlob));
}

function globCoversTarget(fromFile, specifier, targetFile) {
  const base = relativeGlobBase(fromFile, specifier);
  return Boolean(base && posixPath(targetFile).startsWith(`${base}/`));
}

function pathEvidenceInText(sourceFile, text, targetFile) {
  const terms = targetPathTerms(targetFile);
  const evidence = [];
  for (const item of quotedValues(text)) {
    if (globCoversTarget(sourceFile, item.value, targetFile)) {
      evidence.push({
        kind: 'directory-glob',
        seedText: item.value,
        index: item.index,
        reason: `quoted glob covers ${targetFile}`,
      });
      continue;
    }
    const normalized = posixPath(item.value);
    if (terms.some(term => normalized === term || normalized.endsWith(`/${term}`))) {
      evidence.push({
        kind: 'path-literal',
        seedText: item.value,
        index: item.index,
        reason: `quoted path/name references ${targetFile}`,
      });
    }
  }
  return uniq(evidence.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
}

function findPathConsumers(project, targetFile, textCache = new Map()) {
  const fileMap = buildFileMap(project);
  const consumers = [];
  for (const [sourcePath, sourceFile] of fileMap) {
    if (sourcePath === targetFile) continue;
    const text = readProjectText(project, sourceFile, textCache);
    const directImports = importedFiles(project, sourcePath, fileMap, textCache)
      .filter(item => item.file === targetFile)
      .map(item => ({
        kind: 'direct-import',
        seedText: item.specifier,
        index: Math.max(0, text.indexOf(item.specifier)),
        reason: `import resolver maps to ${targetFile}`,
      }));
    const pathEvidence = pathEvidenceInText(sourcePath, text, targetFile);
    const evidence = [...directImports, ...pathEvidence];
    if (!evidence.length) continue;
    consumers.push({
      file: sourcePath,
      evidence,
    });
  }
  return consumers.slice(0, MAX_CONSUMERS);
}

function isIdentifier(value) {
  return /^[A-Za-z_$][\w$]*$/.test(String(value || ''));
}

function lineStart(text, index) {
  return Math.max(0, String(text || '').lastIndexOf('\n', Math.max(0, index - 1)) + 1);
}

function nextLineStart(text, index) {
  const found = String(text || '').indexOf('\n', Math.max(0, index));
  return found < 0 ? String(text || '').length : found + 1;
}

function lineAt(text, index) {
  const start = lineStart(text, index);
  const found = String(text || '').indexOf('\n', start);
  return String(text || '').slice(start, found < 0 ? undefined : found);
}

function looksLikeClosedNodeStart(line) {
  return /^\s*(?:export\s+)?(?:const|let|var|function|class|type|interface|enum|import)\b/.test(line)
    || /^\s*(?:module\.)?exports(?:\.|\s*=)/.test(line);
}

function findClosedNodeStart(text, index) {
  let cursor = lineStart(text, index);
  let guard = 0;
  while (cursor > 0 && guard < 80) {
    const line = lineAt(text, cursor);
    if (looksLikeClosedNodeStart(line)) return cursor;
    cursor = lineStart(text, cursor - 1);
    guard += 1;
  }
  return lineStart(text, index);
}

function scanClosedNodeEnd(text, start, mustPassIndex) {
  const source = String(text || '');
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1] || '';
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') paren += 1;
    else if (char === ')') paren = Math.max(0, paren - 1);
    else if (char === '{') brace += 1;
    else if (char === '}') brace = Math.max(0, brace - 1);
    else if (char === '[') bracket += 1;
    else if (char === ']') bracket = Math.max(0, bracket - 1);

    if (index < mustPassIndex || paren || brace || bracket) continue;
    if (char === ';') return index + 1;
    if (char === '\n') {
      const nextStart = nextLineStart(source, index + 1);
      const nextLine = lineAt(source, nextStart);
      if (!nextLine.trim() || looksLikeClosedNodeStart(nextLine)) return index;
    }
  }
  return source.length;
}

function closedNodeAt(text, index) {
  const source = String(text || '');
  if (index < 0 || index >= source.length) return null;
  const start = findClosedNodeStart(source, index);
  const end = scanClosedNodeEnd(source, start, index);
  const code = source.slice(start, end).trim();
  if (!code) return null;
  return {
    start,
    end,
    code: code.length > MAX_NODE_CHARS ? `${code.slice(0, MAX_NODE_CHARS)}\n/* ...truncated... */` : code,
    rawCode: code,
    kind: nodeKind(code),
    defines: definedSymbols(code),
    uses: usedSymbols(code),
    exports: exportedSymbolsFromCode(code),
  };
}

function nodeKind(code) {
  const source = String(code || '').trim();
  if (/^export\s+/.test(source)) return 'export';
  if (/^import\s+/.test(source)) return 'import';
  if (/^(?:const|let|var)\b/.test(source)) return 'variable';
  if (/^function\b/.test(source)) return 'function';
  if (/^class\b/.test(source)) return 'class';
  if (/^(?:type|interface|enum)\b/.test(source)) return 'type';
  return 'statement';
}

function definedSymbols(code) {
  const source = String(code || '');
  const result = [];
  let match;
  const declaration = /\b(?:export\s+)?(?:declare\s+)?(?:const|let|var|function|class|enum|interface|type)\s+([A-Za-z_$][\w$]*)/g;
  while ((match = declaration.exec(source))) result.push(match[1]);
  const memberAssignment = /\b[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)\s*=/g;
  while ((match = memberAssignment.exec(source))) result.push(match[1]);
  const namedExport = /\bexport\s*\{([^}]+)\}/g;
  while ((match = namedExport.exec(source))) {
    for (const item of match[1].split(',')) {
      const local = item.trim().split(/\s+as\s+/i)[0];
      if (isIdentifier(local)) result.push(local);
    }
  }
  const imports = /\bimport\s+([\s\S]{0,500}?)\s+from\s+['"][^'"]+['"]/g;
  while ((match = imports.exec(source))) {
    const clause = match[1].trim();
    const named = /\{([^}]+)\}/.exec(clause);
    if (named) {
      for (const item of named[1].split(',')) {
        const local = item.trim().split(/\s+as\s+/i).pop();
        if (isIdentifier(local)) result.push(local);
      }
    }
    const beforeNamed = clause.replace(/\{[\s\S]*?\}/, '').split(',')[0].trim();
    if (isIdentifier(beforeNamed)) result.push(beforeNamed);
  }
  return uniq(result);
}

function importedSourceSymbols(code) {
  const source = String(code || '');
  const result = [];
  let match;
  const imports = /\bimport\s+([\s\S]{0,500}?)\s+from\s+['"][^'"]+['"]/g;
  while ((match = imports.exec(source))) {
    const clause = match[1].trim();
    const named = /\{([^}]+)\}/.exec(clause);
    if (named) {
      for (const item of named[1].split(',')) {
        const sourceName = item.trim().split(/\s+as\s+/i)[0];
        if (isIdentifier(sourceName)) result.push(sourceName);
      }
    }
  }
  return uniq(result);
}

function exportedSymbolsFromCode(code) {
  const source = String(code || '');
  const result = [];
  let match;
  const declaration = /\bexport\s+(?:declare\s+)?(?:const|let|var|function|class|enum|interface|type)\s+([A-Za-z_$][\w$]*)/g;
  while ((match = declaration.exec(source))) result.push(match[1]);
  const namedExport = /\bexport\s*\{([^}]+)\}/g;
  while ((match = namedExport.exec(source))) {
    for (const item of match[1].split(',')) {
      const exported = item.trim().split(/\s+as\s+/i).pop();
      if (isIdentifier(exported)) result.push(exported);
    }
  }
  return uniq(result);
}

function usedSymbols(code) {
  const result = [];
  const source = maskNonCode(String(code || ''));
  let match;
  const identifier = /\b[A-Za-z_$][\w$]*\b/g;
  const defines = new Set(definedSymbols(code));
  while ((match = identifier.exec(source))) {
    const name = match[0];
    if (JS_KEYWORDS.has(name) || defines.has(name)) continue;
    result.push(name);
  }
  return uniq([...result, ...importedSourceSymbols(code)]);
}

function importAliasDefinesForSymbol(code, symbol) {
  const result = [];
  let match;
  const imports = /\bimport\s+([\s\S]{0,500}?)\s+from\s+['"][^'"]+['"]/g;
  while ((match = imports.exec(String(code || '')))) {
    const named = /\{([^}]+)\}/.exec(match[1]);
    if (!named) continue;
    for (const item of named[1].split(',')) {
      const parts = item.trim().split(/\s+as\s+/i).map(value => value.trim()).filter(Boolean);
      const sourceName = parts[0] || '';
      const localName = parts[1] || sourceName;
      if (sourceName === symbol && isIdentifier(localName)) result.push(localName);
    }
  }
  return uniq(result);
}

function relatedDefinesForSymbol(code, symbol) {
  const source = String(code || '');
  const result = [...importAliasDefinesForSymbol(source, symbol)];
  const declaration = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^\n;{}]{0,800})/g;
  let match;
  while ((match = declaration.exec(source))) {
    if (new RegExp(`(^|[^\\w$])${escapeRegExp(symbol)}([^\\w$]|$)`).test(match[2])) {
      result.push(match[1]);
    }
  }
  const memberAssignment = /\b[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)\s*=\s*([^\n;{}]{0,800})/g;
  while ((match = memberAssignment.exec(source))) {
    if (new RegExp(`(^|[^\\w$])${escapeRegExp(symbol)}([^\\w$]|$)`).test(match[2])) {
      result.push(match[1]);
    }
  }
  return uniq(result);
}

function keywordIndexes(text, keyword) {
  const source = String(text || '');
  const value = String(keyword || '');
  if (!value) return [];
  const indexes = [];
  let index = source.indexOf(value);
  while (index >= 0 && indexes.length < MAX_SYMBOL_REFS) {
    indexes.push(index);
    index = source.indexOf(value, index + value.length);
  }
  return indexes;
}

function maskNonCode(text) {
  const source = String(text || '');
  let result = '';
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1] || '';
    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        result += '\n';
      } else {
        result += ' ';
      }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        result += '  ';
        index += 1;
      } else {
        result += char === '\n' ? '\n' : ' ';
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      result += char === '\n' ? '\n' : ' ';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      result += '  ';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      result += '  ';
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      result += ' ';
      continue;
    }
    result += char;
  }
  return result;
}

function identifierIndexes(text, symbol) {
  const result = [];
  const source = maskNonCode(text);
  const pattern = new RegExp(`(^|[^\\w$])${escapeRegExp(symbol)}([^\\w$]|$)`, 'g');
  let match;
  while ((match = pattern.exec(source)) && result.length < MAX_SYMBOL_REFS) {
    result.push(match.index + (match[1] ? match[1].length : 0));
  }
  return result;
}

function nodeKey(node) {
  return node ? `${node.start}:${node.end}` : '';
}

function nodeUsesAny(node, symbols) {
  const uses = new Set(node?.uses || []);
  const defines = new Set(node?.defines || []);
  return (symbols || []).some(symbol => uses.has(symbol) || defines.has(symbol));
}

function expandSyntaxEvidenceFlow({ text, seedText, maxDepth = 4 }) {
  const source = String(text || '');
  const seedPositions = keywordIndexes(source, seedText);
  const chains = [];
  for (const position of seedPositions.slice(0, MAX_CHAINS_PER_CONSUMER)) {
    const first = closedNodeAt(source, position);
    if (!first) continue;
    const seen = new Set([nodeKey(first)]);
    const chain = [first];
    let frontier = uniq([...first.defines, ...first.exports]);
    for (let depth = 0; depth < maxDepth && frontier.length && chain.length < MAX_NODES_PER_CHAIN; depth += 1) {
      let nextNode = null;
      let nextVia = '';
      let nextRelatedDefines = [];
      for (const symbol of frontier) {
        for (const refIndex of identifierIndexes(source, symbol)) {
          const node = closedNodeAt(source, refIndex);
          if (!node || seen.has(nodeKey(node))) continue;
          if (!nodeUsesAny(node, [symbol])) continue;
          nextRelatedDefines = relatedDefinesForSymbol(node.rawCode || node.code, symbol);
          nextNode = { ...node, via: symbol, relatedDefines: nextRelatedDefines };
          nextVia = symbol;
          break;
        }
        if (nextNode) break;
      }
      if (!nextNode) break;
      seen.add(nodeKey(nextNode));
      chain.push(nextNode);
      frontier = uniq([
        ...nextRelatedDefines,
        ...nextNode.exports,
      ]).filter(symbol => symbol !== nextVia);
    }
    chains.push({
      seedText,
      nodes: chain.map(item => ({
        kind: item.kind,
        code: item.code,
        defines: item.defines,
        uses: item.uses,
        exports: item.exports,
        relatedDefines: item.relatedDefines || [],
        via: item.via || '',
      })),
      nextSearchSymbols: (chain.some(item => (item.exports || []).length)
        ? uniq(chain.flatMap(item => item.exports))
        : uniq(chain.flatMap(item => item.relatedDefines || []))
      ).slice(0, 8),
    });
  }
  return chains;
}

function findSymbolConsumers(project, symbols, textCache = new Map()) {
  const fileMap = buildFileMap(project);
  const normalizedSymbols = uniq((symbols || []).filter(isIdentifier));
  const consumers = [];
  for (const [filePath, file] of fileMap) {
    const text = readProjectText(project, file, textCache);
    const symbolHits = normalizedSymbols
      .map(symbol => ({ symbol, positions: identifierIndexes(text, symbol).slice(0, 3) }))
      .filter(item => item.positions.length);
    if (!symbolHits.length) continue;
    const chains = [];
    for (const hit of symbolHits) {
      for (const position of hit.positions) {
        const node = closedNodeAt(text, position);
        if (!node || !nodeUsesAny(node, [hit.symbol])) continue;
        const expanded = expandSyntaxEvidenceFlow({ text, seedText: hit.symbol, maxDepth: 4 })
          .filter(chain => chain.nodes.some(item => {
            return item.code === node.code || item.uses.includes(hit.symbol) || item.defines.includes(hit.symbol);
          }));
        chains.push(...(expanded.length ? expanded : [{
          seedText: hit.symbol,
          nodes: [{
            kind: node.kind,
            code: node.code,
            defines: node.defines,
            uses: node.uses,
            exports: node.exports,
            via: '',
          }],
          nextSearchSymbols: uniq([...node.defines, ...node.exports]).slice(0, 8),
        }]).map(chain => ({ ...chain, matchedSymbol: hit.symbol })));
      }
    }
    if (!chains.length) continue;
    consumers.push({
      file: filePath,
      matchedSymbols: uniq(symbolHits.map(item => item.symbol)),
      chains: chains.slice(0, MAX_CHAINS_PER_CONSUMER),
      nextSearchSymbols: uniq(chains.flatMap(chain => {
        return (chain.nodes || []).flatMap(node => node.exports || []);
      })).slice(0, 12),
    });
  }
  return consumers.slice(0, MAX_CONSUMERS);
}

function traceSymbolHops(project, initialSymbols, textCache = new Map(), maxHops = MAX_SYMBOL_HOPS) {
  const hops = [];
  let frontier = uniq((initialSymbols || []).filter(isIdentifier));
  const seen = new Set();
  for (let depth = 1; depth <= maxHops && frontier.length; depth += 1) {
    const symbols = frontier.filter(symbol => !seen.has(symbol));
    if (!symbols.length) break;
    symbols.forEach(symbol => seen.add(symbol));
    const consumers = findSymbolConsumers(project, symbols, textCache);
    if (!consumers.length) break;
    hops.push({ depth, symbols, consumers });
    frontier = uniq(consumers.flatMap(item => item.nextSearchSymbols))
      .filter(symbol => !seen.has(symbol));
  }
  return hops;
}

function traceFileEvidenceFlow(project, targetFile, textCache = new Map()) {
  const fileMap = buildFileMap(project);
  const consumers = findPathConsumers(project, targetFile, textCache);
  const result = [];
  for (const consumer of consumers) {
    const file = fileMap.get(consumer.file);
    if (!file) continue;
    const text = readProjectText(project, file, textCache);
    const chains = [];
    for (const evidence of consumer.evidence) {
      chains.push(...expandSyntaxEvidenceFlow({ text, seedText: evidence.seedText, maxDepth: 4 })
        .map(chain => ({ ...chain, evidence })));
    }
    result.push({
      targetFile,
      consumerFile: consumer.file,
      evidence: consumer.evidence,
      chains: chains.slice(0, MAX_CHAINS_PER_CONSUMER),
      nextSearchSymbols: uniq(chains.flatMap(chain => chain.nextSearchSymbols)).slice(0, 12),
    });
  }
  const symbols = uniq(result.flatMap(item => item.nextSearchSymbols)).slice(0, 12);
  if (symbols.length) {
    const symbolHops = traceSymbolHops(project, symbols, textCache);
    for (const item of result) item.symbolHops = symbolHops;
  }
  return result;
}

module.exports = {
  closedNodeAt,
  expandSyntaxEvidenceFlow,
  findPathConsumers,
  findSymbolConsumers,
  pathEvidenceInText,
  traceFileEvidenceFlow,
  traceSymbolHops,
};
