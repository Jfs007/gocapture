const path = require('path');
const { isTextFile, readProjectText } = require('../core/fs-utils');
const { escapeRegExp, uniq } = require('../utils');

const OPERATIONS = new Set([
  'read_file',
  'search_text',
  'find_files',
  'find_symbol',
  'find_endpoint',
  'find_imports',
  'find_importers',
  'find_related_examples',
]);
const MAX_REQUESTS = 8;
const MAX_RESULTS = 30;
const MAX_LINES = 160;

function normalizePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('../')) return '';
  return normalized;
}

function requestRoots(request) {
  return (request?.scope?.roots || [])
    .map(normalizePath)
    .filter(Boolean);
}

function requestFiles(request) {
  return (request?.scope?.files || [])
    .map(normalizePath)
    .filter(Boolean);
}

function requestLimit(request) {
  return Math.max(1, Math.min(MAX_RESULTS, Number(request?.maxResults || 12)));
}

function lineLimit(request) {
  const minimum = request?.operation === 'read_file'
    ? 80
    : request?.operation === 'find_related_examples'
      ? 48
      : 8;
  return Math.max(minimum, Math.min(MAX_LINES, Number(request?.maxLinesPerResult || 24)));
}

function extensionAllowed(filePath, request) {
  const types = request?.fileTypes || [];
  if (!types.length) return true;
  const extension = path.posix.extname(filePath).replace(/^\./, '').toLowerCase();
  return types.includes(extension);
}

function filesInScope(project, request, options = {}) {
  const roots = requestRoots(request);
  const explicit = new Set(requestFiles(request));
  return (project.files || []).filter(file => {
    if (options.textOnly !== false && !isTextFile(file.path)) return false;
    if (!extensionAllowed(file.path, request)) return false;
    if (explicit.size && !explicit.has(file.path)) return false;
    if (roots.length && !roots.some(root => file.path === root || file.path.startsWith(`${root}/`))) return false;
    return true;
  });
}

function numberedLines(text) {
  return String(text || '').split(/\r?\n/);
}

function snippetAround(lines, lineIndex, maxLines) {
  const before = Math.max(2, Math.floor(maxLines / 3));
  const start = Math.max(0, lineIndex - before);
  const end = Math.min(lines.length, start + maxLines);
  return {
    lineStart: start + 1,
    lineEnd: end,
    snippet: lines.slice(start, end).join('\n'),
  };
}

function literalMatches(text, terms) {
  const lower = String(text || '').toLowerCase();
  return (terms || [])
    .map(String)
    .map(term => term.trim())
    .filter(Boolean)
    .map(term => ({ term, index: lower.indexOf(term.toLowerCase()) }))
    .filter(item => item.index >= 0);
}

function lineIndexAt(text, index) {
  return String(text || '').slice(0, Math.max(0, index)).split(/\r?\n/).length - 1;
}

function executeReadFile(project, request, textCache) {
  const terms = requestTerms(request);
  return filesInScope(project, request).slice(0, requestLimit(request)).flatMap(file => {
    const text = readProjectText(project, file, textCache);
    const lines = numberedLines(text);
    const maxLines = lineLimit(request);
    const matches = literalMatches(text, terms);
    if (matches.length) {
      return matches.slice(0, 4).map(match => ({
        path: file.path,
        relation: 'reads-focused',
        matchedTerms: [match.term],
        ...snippetAround(lines, lineIndexAt(text, match.index), maxLines),
      }));
    }
    return [{
      path: file.path,
      relation: 'reads',
      lineStart: 1,
      lineEnd: Math.min(lines.length, maxLines),
      snippet: lines.slice(0, maxLines).join('\n'),
      truncated: lines.length > maxLines,
    }];
  });
}

function requestTerms(request) {
  const values = [
    ...(request?.terms || []),
    ...(request?.keywords || []),
    ...(Array.isArray(request?.query) ? request.query : [request?.query]),
  ];
  if (request?.target && !String(request.target).includes('/')) values.push(request.target);
  return uniq(values
    .filter(value => value !== undefined && value !== null)
    .map(String)
    .map(item => item.trim())
    .filter(Boolean));
}

function executeSearchText(project, request, textCache, mode = 'literal') {
  const terms = requestTerms(request);
  if (!terms.length && request.target) terms.push(String(request.target));
  const result = [];
  for (const file of filesInScope(project, request)) {
    if (result.length >= requestLimit(request)) break;
    const text = readProjectText(project, file, textCache);
    let matches = [];
    if (mode === 'symbol') {
      for (const term of terms) {
        const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
        const match = pattern.exec(text);
        if (match) matches.push({ term, index: match.index });
      }
    } else {
      matches = literalMatches(text, terms);
    }
    if (!matches.length) continue;
    const best = matches.sort((a, b) => a.index - b.index)[0];
    result.push({
      path: file.path,
      relation: mode === 'endpoint' ? 'endpoint' : mode === 'symbol' ? 'symbol' : 'matches',
      matchedTerms: uniq(matches.map(item => item.term)).slice(0, 8),
      ...snippetAround(numberedLines(text), lineIndexAt(text, best.index), lineLimit(request)),
    });
  }
  return result;
}

function executeFindFiles(project, request) {
  const terms = requestTerms(request).map(item => item.toLowerCase());
  return filesInScope(project, request, { textOnly: false })
    .filter(file => !terms.length || terms.some(term => file.path.toLowerCase().includes(term)))
    .slice(0, requestLimit(request))
    .map(file => ({ path: file.path, relation: 'file-name', snippet: file.path }));
}

function importSpecifiers(text) {
  const result = [];
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) && result.length < 120) result.push(match[1]);
  }
  return uniq(result);
}

function resolveSpecifier(fromFile, specifier, fileSet) {
  let base = '';
  if (specifier.startsWith('.')) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  } else if (specifier.startsWith('@/')) {
    base = path.posix.join('src', specifier.slice(2));
  } else if (specifier.startsWith('src/')) {
    base = specifier;
  } else {
    return '';
  }
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.vue', '.json'];
  const candidates = extensions.map(ext => `${base}${ext}`);
  for (const ext of extensions.slice(1)) candidates.push(`${base}/index${ext}`);
  return candidates.find(candidate => fileSet.has(candidate)) || '';
}

function executeFindImports(project, request, textCache) {
  const fileSet = new Set((project.files || []).map(file => file.path));
  const target = normalizePath(request.target || requestFiles(request)[0]);
  const source = (project.files || []).find(file => file.path === target);
  if (!source) return [];
  const text = readProjectText(project, source, textCache);
  return importSpecifiers(text)
    .map(specifier => ({
      path: resolveSpecifier(source.path, specifier, fileSet),
      specifier,
    }))
    .filter(item => item.path)
    .slice(0, requestLimit(request))
    .map(item => {
      const importedFile = (project.files || []).find(file => file.path === item.path);
      const importedText = importedFile ? readProjectText(project, importedFile, textCache) : '';
      const lines = numberedLines(importedText);
      const maxLines = lineLimit(request);
      return {
        path: item.path,
        relation: 'imported-by-target',
        lineStart: 1,
        lineEnd: Math.min(lines.length, maxLines),
        snippet: [
          `${source.path} -> ${item.specifier} -> ${item.path}`,
          lines.slice(0, maxLines).join('\n'),
        ].filter(Boolean).join('\n'),
      };
    });
}

function executeFindImporters(project, request, textCache) {
  const fileSet = new Set((project.files || []).map(file => file.path));
  const target = normalizePath(request.target || requestFiles(request)[0]);
  if (!target) return [];
  const result = [];
  for (const file of filesInScope(project, request)) {
    if (file.path === target || result.length >= requestLimit(request)) continue;
    const text = readProjectText(project, file, textCache);
    for (const specifier of importSpecifiers(text)) {
      if (resolveSpecifier(file.path, specifier, fileSet) !== target) continue;
      result.push({
        path: file.path,
        relation: 'imports-target',
        snippet: `${file.path} -> ${specifier} -> ${target}`,
      });
      break;
    }
  }
  return result;
}

function executeRelatedExamples(project, request, textCache) {
  const terms = requestTerms(request);
  return filesInScope(project, request)
    .map(file => {
      const text = readProjectText(project, file, textCache);
      const matches = literalMatches(text, terms);
      return { file, text, matches, score: matches.length };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path))
    .slice(0, requestLimit(request))
    .map(item => {
      const best = item.matches.sort((a, b) => a.index - b.index)[0];
      return {
        path: item.file.path,
        relation: 'related-example',
        matchedTerms: uniq(item.matches.map(match => match.term)),
        ...snippetAround(numberedLines(item.text), lineIndexAt(item.text, best.index), lineLimit(request)),
      };
    });
}

function countLiteralOccurrences(text, term) {
  const value = String(term || '').trim();
  if (!value) return 0;
  const pattern = new RegExp(escapeRegExp(value), 'gi');
  let count = 0;
  while (pattern.exec(String(text || ''))) count += 1;
  return count;
}

function countSymbolOccurrences(text, term) {
  const value = String(term || '').trim();
  if (!value) return 0;
  const pattern = new RegExp(`\\b${escapeRegExp(value)}\\b`, 'gi');
  let count = 0;
  while (pattern.exec(String(text || ''))) count += 1;
  return count;
}

function discoveryRequestStats(project, request, textCache) {
  if (!['search_text', 'find_symbol', 'find_endpoint', 'find_related_examples'].includes(request.operation)) {
    return null;
  }
  const terms = requestTerms(request);
  if (!terms.length) return null;
  const files = filesInScope(project, request);
  const termStats = terms.map(term => ({
    term,
    files: 0,
    occurrences: 0,
  }));
  let matchedFiles = 0;
  for (const file of files) {
    const text = readProjectText(project, file, textCache);
    let fileMatched = false;
    for (const item of termStats) {
      const count = request.operation === 'find_symbol'
        ? countSymbolOccurrences(text, item.term)
        : countLiteralOccurrences(text, item.term);
      if (!count) continue;
      item.files += 1;
      item.occurrences += count;
      fileMatched = true;
    }
    if (fileMatched) matchedFiles += 1;
  }
  return {
    scannedFiles: files.length,
    matchedFiles,
    termStats: termStats
      .filter(item => item.files > 0)
      .sort((a, b) => b.files - a.files || b.occurrences - a.occurrences || a.term.localeCompare(b.term))
      .slice(0, 12),
  };
}

function executeRequest(project, request, textCache) {
  switch (request.operation) {
    case 'read_file':
      return executeReadFile(project, request, textCache);
    case 'search_text':
      return executeSearchText(project, request, textCache);
    case 'find_symbol':
      return executeSearchText(project, request, textCache, 'symbol');
    case 'find_endpoint':
      return executeSearchText(project, request, textCache, 'endpoint');
    case 'find_files':
      return executeFindFiles(project, request);
    case 'find_imports':
      return executeFindImports(project, request, textCache);
    case 'find_importers':
      return executeFindImporters(project, request, textCache);
    case 'find_related_examples':
      return executeRelatedExamples(project, request, textCache);
    default:
      return [];
  }
}

function normalizePlan(plan) {
  const requests = (Array.isArray(plan?.requests) ? plan.requests : [])
    .filter(request => OPERATIONS.has(request?.operation))
    .slice(0, MAX_REQUESTS)
    .map((request, index) => {
      const scope = { ...(request.scope || {}) };
      const legacyPath = normalizePath(request.path);
      if (legacyPath) {
        if (request.operation === 'read_file') {
          scope.files = uniq([...(scope.files || []), legacyPath]);
        } else {
          scope.roots = uniq([...(scope.roots || []), legacyPath]);
        }
      }
      const normalized = {
        ...request,
        scope,
        terms: requestTerms(request),
        id: String(request.id || `request-${index + 1}`),
      };
      return {
        ...normalized,
        maxResults: requestLimit(normalized),
        maxLinesPerResult: lineLimit(normalized),
      };
    });
  return {
    domain: String(plan?.domain || 'project-pattern'),
    objective: String(plan?.objective || ''),
    questions: (plan?.questions || []).map(String).filter(Boolean).slice(0, 12),
    requests,
    expectedSkill: plan?.expectedSkill || {},
  };
}

function discoveryPlanIssues(rawPlan) {
  const plan = normalizePlan(rawPlan);
  const issues = [];
  if (!plan.requests.length) issues.push('requests 为空');
  for (const request of plan.requests) {
    const hasFiles = requestFiles(request).length > 0;
    const hasRoots = requestRoots(request).length > 0;
    if (request.operation === 'read_file' && !hasFiles) {
      issues.push(`${request.id}: read_file 缺少 scope.files`);
    }
    if (['search_text', 'find_symbol', 'find_endpoint', 'find_files', 'find_related_examples'].includes(request.operation)
      && !request.terms.length) {
      issues.push(`${request.id}: ${request.operation} 缺少 terms`);
    }
    if (['find_imports', 'find_importers'].includes(request.operation)
      && !request.target
      && !hasFiles) {
      issues.push(`${request.id}: ${request.operation} 缺少 target`);
    }
    if (!hasFiles && !hasRoots && request.operation !== 'find_imports' && request.operation !== 'find_importers') {
      issues.push(`${request.id}: 缺少检索 scope`);
    }
  }
  return uniq(issues);
}

function executeDiscoveryPlan(project, rawPlan, textCache = new Map(), log = null) {
  const plan = normalizePlan(rawPlan);
  const results = {};
  for (const request of plan.requests) {
    const matches = executeRequest(project, request, textCache);
    const stats = discoveryRequestStats(project, request, textCache);
    const statSummary = stats
      ? `；扫描 ${stats.scannedFiles} 个文件，实际命中文件 ${stats.matchedFiles} 个`
      : '';
    results[request.id] = {
      operation: request.operation,
      reason: String(request.reason || ''),
      summary: `返回 ${matches.length} 个结果${statSummary}`,
      stats,
      matches,
    };
    if (typeof log === 'function') {
      const topTerms = stats?.termStats?.length
        ? `；高频项：${stats.termStats.slice(0, 4).map(item => `${item.term}=${item.files}文件/${item.occurrences}次`).join('、')}`
        : '';
      log(`经验发现执行：${request.id} · ${request.operation} · 返回 ${matches.length} 个结果${statSummary}${topTerms}`);
    } else if (log?.push) {
      log.push(`经验发现执行：${request.id} · ${request.operation} · 返回 ${matches.length} 个结果${statSummary}`);
    }
  }
  return { plan, results };
}

module.exports = {
  OPERATIONS,
  discoveryPlanIssues,
  executeDiscoveryPlan,
  normalizePlan,
};
