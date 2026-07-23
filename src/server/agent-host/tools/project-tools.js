'use strict';

const { readProjectText } = require('../../core/fs-utils');
const { runDiscoveryOperation } = require('../../experience/discovery-executor');
const {
  closedNodeAt,
  traceFileEvidenceFlow,
} = require('./evidence/syntax-evidence-flow');
const { createToolProvider } = require('./provider');
const { buildTool } = require('./tool');

function normalizeProjectFile(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
}

function projectFileByPath(project, filePath) {
  const normalized = normalizeProjectFile(filePath);
  return (project?.files || []).find(file => file.path === normalized) || null;
}

function cleanStringList(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

function keywordIndexes(text, keyword, limit = 120) {
  const source = String(text || '');
  const needle = String(keyword || '');
  if (!source || !needle) return [];
  const indexes = [];
  let cursor = 0;
  while (indexes.length < limit) {
    const index = source.indexOf(needle, cursor);
    if (index < 0) break;
    indexes.push(index);
    cursor = index + Math.max(needle.length, 1);
  }
  return indexes;
}

function symbolIndexes(text, symbol, limit = 24) {
  const source = String(text || '');
  const value = String(symbol || '').trim();
  if (!source || !value) return [];
  if (!/^[A-Za-z_$][\w$]*$/.test(value)) return keywordIndexes(source, value, limit);
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\b`, 'g');
  const indexes = [];
  let match;
  while ((match = pattern.exec(source)) && indexes.length < limit) indexes.push(match.index);
  return indexes;
}

function evidenceTerms(input = {}) {
  const values = Array.isArray(input.anchors) && input.anchors.length
    ? input.anchors
    : (input.terms || []).map(text => ({ text, kind: 'literal' }));
  return values
    .map(item => ({
      text: String(item?.text || item || '').trim(),
      kind: String(item?.kind || 'literal').trim() || 'literal',
    }))
    .filter(item => item.text)
    .slice(0, 12);
}

function evidenceFiles(project, input = {}) {
  const roots = cleanStringList(input.roots).map(normalizeProjectFile);
  return (project?.files || []).filter(file => {
    if (!file?.path || roots.length && !roots.some(root => file.path === root || file.path.startsWith(`${root}/`))) {
      return false;
    }
    return true;
  });
}

function lineNumberAt(text, index) {
  return String(text || '').slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function evidenceSnippet(text, index, radius = 5) {
  const lines = String(text || '').split(/\r?\n/);
  const line = lineNumberAt(text, index);
  const start = Math.max(1, line - radius);
  const end = Math.min(lines.length, line + radius);
  return {
    line,
    lineStart: start,
    lineEnd: end,
    snippet: lines.slice(start - 1, end).join('\n'),
  };
}

function occurrenceIsCommentOrLog(text, index) {
  const source = String(text || '');
  const lineStart = source.lastIndexOf('\n', index - 1) + 1;
  const linePrefix = source.slice(lineStart, index);
  const blockStart = source.lastIndexOf('/*', index);
  const blockEnd = source.lastIndexOf('*/', index);
  const htmlStart = source.lastIndexOf('<!--', index);
  const htmlEnd = source.lastIndexOf('-->', index);
  if (blockStart > blockEnd || htmlStart > htmlEnd) return true;
  if (linePrefix.includes('//')) return true;
  return /\bconsole\s*\.\s*[A-Za-z_$][\w$]*\s*\([^)]*$/i.test(linePrefix);
}

function exactLiteralBoundary(text, index, value) {
  const before = index > 0 ? text[index - 1] : '';
  const after = text[index + String(value).length] || '';
  const word = char => /[\p{L}\p{N}_\u4e00-\u9fff]/u.test(char || '');
  return !word(before) && !word(after);
}

function sourceEvidenceSearch(project, input = {}, textCache = new Map()) {
  const anchors = evidenceTerms(input);
  const mode = String(input.mode || 'any') === 'all' ? 'all' : 'any';
  const maxResults = Math.max(1, Math.min(40, Number(input.maxResults || 24)));
  const raw = [];
  const fileFrequency = new Map(anchors.map(anchor => [anchor.text, 0]));

  for (const file of evidenceFiles(project, input)) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const matches = [];
    const rejected = [];
    for (const anchor of anchors) {
      const indexes = keywordIndexes(text, anchor.text, 24);
      const valid = [];
      for (const index of indexes) {
        if (occurrenceIsCommentOrLog(text, index)) {
          rejected.push({ text: anchor.text, reason: 'comment-or-log', line: lineNumberAt(text, index) });
          continue;
        }
        if ((anchor.kind === 'text' || anchor.kind === 'literal') && !exactLiteralBoundary(text, index, anchor.text)) {
          rejected.push({ text: anchor.text, reason: 'partial-literal', line: lineNumberAt(text, index) });
          continue;
        }
        valid.push(index);
      }
      if (!valid.length) continue;
      const first = valid[0];
      matches.push({
        text: anchor.text,
        kind: anchor.kind,
        occurrenceCount: valid.length,
        ...evidenceSnippet(text, first),
      });
    }
    for (const match of matches) fileFrequency.set(match.text, (fileFrequency.get(match.text) || 0) + 1);
    if (mode === 'all' ? matches.length !== anchors.length : matches.length === 0) continue;
    raw.push({ file: file.path, matchedAnchorCount: matches.length, matches, rejected });
  }

  const rarityScore = candidate => candidate.matches.reduce((sum, match) => {
    const frequency = fileFrequency.get(match.text) || 1;
    return sum + 1 / frequency;
  }, 0);
  raw.forEach(candidate => {
    candidate.informationScore = Number(rarityScore(candidate).toFixed(4));
  });
  raw.sort((a, b) =>
    b.matchedAnchorCount - a.matchedAnchorCount
    || b.informationScore - a.informationScore
    || a.file.localeCompare(b.file));

  const selected = new Map();
  for (const anchor of anchors) {
    raw
      .filter(candidate => candidate.matches.some(match => match.text === anchor.text))
      .slice(0, 3)
      .forEach(candidate => selected.set(candidate.file, candidate));
  }
  for (const candidate of raw) {
    if (selected.size >= maxResults) break;
    selected.set(candidate.file, candidate);
  }

  return {
    operation: 'search_source_evidence',
    mode,
    anchors,
    scannedFileCount: evidenceFiles(project, input).length,
    matchedFileCount: raw.length,
    anchorFrequency: anchors.map(anchor => ({
      ...anchor,
      matchedFileCount: fileFrequency.get(anchor.text) || 0,
    })),
    candidates: [...selected.values()].slice(0, maxResults),
    truncated: raw.length > maxResults,
  };
}

function discoveryInput(input = {}, operation) {
  const output = { ...input, operation };
  const files = cleanStringList(input.files);
  const roots = cleanStringList(input.roots);
  if (files.length || roots.length) {
    output.scope = {};
    if (files.length) output.scope.files = files;
    if (roots.length) output.scope.roots = roots;
  }
  delete output.files;
  delete output.roots;
  return output;
}

function runTextSearch(project, input, textCache, searchResultPolicy) {
  const result = runDiscoveryOperation(project, discoveryInput(input, 'search_text'), textCache);
  if (searchResultPolicy !== 'summary-on-truncation' || !result.truncated) return result;
  return {
    ...result,
    status: 'too-broad',
    omittedMatches: Number(result.stats?.matchedFiles || 0),
    matches: [],
    note: `查询命中 ${Number(result.stats?.matchedFiles || 0)} 个文件，超过本次结果上限 ${result.resultLimit}。未返回顺序任意的部分源码片段；请增加判别性关键词、限定 files/roots，或围绕已确认候选验证关系。`,
  };
}

function readClosedBlocks(project, input = {}, textCache = new Map()) {
  const filePath = normalizeProjectFile(input.file || input.path || input.target);
  const file = projectFileByPath(project, filePath);
  if (!file) throw new Error(`File not found: ${filePath || '-'}`);
  const text = readProjectText(project, file, textCache);
  const terms = (Array.isArray(input.terms) ? input.terms : [input.term])
    .map(term => String(term || '').trim())
    .filter(Boolean)
    .slice(0, 12);
  const seen = new Set();
  const blocks = [];
  for (const term of terms) {
    for (const index of keywordIndexes(text, term).slice(0, 8)) {
      const node = closedNodeAt(text, index);
      if (!node) continue;
      const key = `${node.start}:${node.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push({
        term,
        start: node.start,
        end: node.end,
        kind: node.kind,
        defines: node.defines || [],
        uses: node.uses || [],
        exports: node.exports || [],
        code: node.code,
      });
    }
  }
  return {
    operation: 'read_closed_blocks',
    file: filePath,
    terms,
    blockCount: blocks.length,
    blocks,
  };
}

function inspectSymbolOccurrences(project, input = {}, textCache = new Map()) {
  const filePath = normalizeProjectFile(input.file || input.path || input.target);
  const file = projectFileByPath(project, filePath);
  if (!file) throw new Error(`File not found: ${filePath || '-'}`);
  const symbols = cleanStringList(input.symbols || input.terms).slice(0, 12);
  if (!symbols.length) throw new Error('inspect_symbol_occurrences requires symbols');
  const text = readProjectText(project, file, textCache);
  const lines = String(text || '').split(/\r?\n/);
  const blockIds = new Map();
  let nextBlockId = 1;
  const blockFor = index => {
    const node = closedNodeAt(text, index);
    if (!node) return null;
    const key = `${node.start}:${node.end}`;
    if (!blockIds.has(key)) blockIds.set(key, `block_${nextBlockId++}`);
    return {
      id: blockIds.get(key),
      kind: node.kind,
      lineStart: lineNumberAt(text, node.start),
      lineEnd: lineNumberAt(text, Math.max(node.start, node.end - 1)),
      charLength: Math.max(0, node.end - node.start),
      truncatedByClosedBlockTool: String(node.rawCode || '').length > String(node.code || '').length,
    };
  };
  const symbolFacts = symbols.map(symbol => ({
    symbol,
    occurrences: symbolIndexes(text, symbol).map(index => {
      const line = lineNumberAt(text, index);
      const start = Math.max(1, line - 2);
      const end = Math.min(lines.length, line + 2);
      return {
        line,
        lineStart: start,
        lineEnd: end,
        snippet: lines.slice(start - 1, end).join('\n'),
        localBlock: blockFor(index),
      };
    }),
  }));
  return {
    operation: 'inspect_symbol_occurrences',
    file: filePath,
    missingFact: String(input.missingFact || ''),
    decisionImpact: String(input.decisionImpact || ''),
    symbols: symbolFacts,
    occurrenceCount: symbolFacts.reduce((sum, item) => sum + item.occurrences.length, 0),
  };
}

const PROJECT_TOOLS = [
  buildTool({
    name: 'search_source_evidence',
    title: 'Search Source Evidence',
    description: 'Search literal DOM or source anchors across the project. Returns measured per-anchor frequency, candidate snippets, and objective comment/log/partial-literal rejections. Results are evidence only and never decide source ownership.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        anchors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              kind: { type: 'string' },
            },
            required: ['text'],
          },
        },
        roots: { type: 'array', items: { type: 'string' } },
        mode: { type: 'string' },
        maxResults: { type: 'number' },
      },
      required: ['anchors'],
    },
    call: ({ project, input, textCache }) => sourceEvidenceSearch(project, input, textCache),
  }),
  buildTool({
    name: 'read_file',
    title: 'Read File',
    description: 'Read source files. Use terms for literal/symbol focus, or around for one symbol/literal or a line range such as "81-160". Do not repeat the same call to read later lines. 同一文件最多做一次 around 行区间补读；要定位标识符/关系改用 inspect_symbol_occurrences，要读整块结构用 read_closed_blocks，不要靠行区间翻页。',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string' } },
        terms: { type: 'array', items: { type: 'string' } },
        around: { type: 'string' },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['files'],
    },
    call: ({ project, input, textCache }) => runDiscoveryOperation(project, discoveryInput(input, 'read_file'), textCache),
  }),
  buildTool({
    name: 'inspect_symbol_occurrences',
    title: 'Inspect Symbol Occurrences',
    description: 'List every exact occurrence of already-observed symbols in one file, with line numbers, small source windows, and nearby syntax-block ranges. Use this to verify one missing relation fact without reading arbitrary file chunks. A localBlock is only a nearby syntax fact, not a guaranteed semantic owner. This tool never decides source roles or relationships. 当缺失的是已发现标识符之间的关系时，优先用本工具而不是 read_file 行区间翻页；输入带 file、symbols、missingFact、decisionImpact，一次返回全部出现位置。',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        symbols: { type: 'array', items: { type: 'string' } },
        missingFact: { type: 'string' },
        decisionImpact: { type: 'string' },
      },
      required: ['file', 'symbols', 'missingFact', 'decisionImpact'],
    },
    call: ({ project, input, textCache }) => inspectSymbolOccurrences(project, input, textCache),
  }),
  buildTool({
    name: 'search_text',
    title: 'Search Text',
    description: 'Search project source files for literal text.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        roots: { type: 'array', items: { type: 'string' } },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['roots', 'terms'],
    },
    call: ({ project, input, textCache, searchResultPolicy }) => runTextSearch(project, input, textCache, searchResultPolicy),
  }),
  buildTool({
    name: 'find_files',
    title: 'Find Files',
    description: 'Find files by path fragments inside a project scope.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        roots: { type: 'array', items: { type: 'string' } },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
      },
    },
    call: ({ project, input, textCache }) => runDiscoveryOperation(project, discoveryInput(input, 'find_files'), textCache),
  }),
  buildTool({
    name: 'find_symbol',
    title: 'Find Symbol',
    description: 'Search for source symbols using word-boundary matching.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        roots: { type: 'array', items: { type: 'string' } },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['roots', 'terms'],
    },
    call: ({ project, input, textCache }) => runDiscoveryOperation(project, discoveryInput(input, 'find_symbol'), textCache),
  }),
  buildTool({
    name: 'find_endpoint',
    title: 'Find Endpoint',
    description: 'Search for endpoint strings or API path fragments.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        roots: { type: 'array', items: { type: 'string' } },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['roots', 'terms'],
    },
    call: ({ project, input, textCache }) => runDiscoveryOperation(project, discoveryInput(input, 'find_endpoint'), textCache),
  }),
  buildTool({
    name: 'find_imports',
    title: 'Find Imports',
    description: 'Read imports used by a target source file.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        roots: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['target'],
    },
    call: ({ project, input, textCache }) => runDiscoveryOperation(project, discoveryInput(input, 'find_imports'), textCache),
  }),
  buildTool({
    name: 'find_importers',
    title: 'Find Importers',
    description: 'Find files that import, require, re-export, or dynamically import a target source file.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        roots: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['target'],
    },
    call: ({ project, input, textCache }) => runDiscoveryOperation(project, discoveryInput(input, 'find_importers'), textCache),
  }),
  buildTool({
    name: 'find_related_examples',
    title: 'Find Related Examples',
    description: 'Find representative project examples that match one or more implementation terms.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        roots: { type: 'array', items: { type: 'string' } },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['roots', 'terms'],
    },
    call: ({ project, input, textCache }) => runDiscoveryOperation(project, discoveryInput(input, 'find_related_examples'), textCache),
  }),
  buildTool({
    name: 'trace_file_evidence_flow',
    title: 'Trace File Evidence Flow',
    description: 'From a source file, find files that reference or glob-cover it and return syntax-closed evidence chains plus next symbols. This observes relationships but does not decide final ownership.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
      },
      required: ['file'],
    },
    call: ({ project, input, textCache }) => {
      const filePath = normalizeProjectFile(input.file);
      if (!projectFileByPath(project, filePath)) throw new Error(`File not found: ${filePath || '-'}`);
      return {
        operation: 'trace_file_evidence_flow',
        file: filePath,
        observations: traceFileEvidenceFlow(project, filePath, textCache),
      };
    },
  }),
  buildTool({
    name: 'read_closed_blocks',
    title: 'Read Closed Blocks',
    description: 'Read syntax-closed code blocks around literal terms in one file, preserving enough local context for relation reasoning without reading the whole file.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        terms: { type: 'array', items: { type: 'string' } },
      },
      required: ['file', 'terms'],
    },
    call: ({ project, input, textCache }) => readClosedBlocks(project, input, textCache),
  }),
];

const projectToolProvider = createToolProvider({
  id: 'builtin.project-crud',
  title: 'Project CRUD Tools',
  source: 'builtin',
  description: 'Default project source reading, searching, symbol lookup, endpoint lookup, and import tracing tools.',
  tools: PROJECT_TOOLS,
});

module.exports = {
  inspectSymbolOccurrences,
  projectToolProvider,
};
