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
  'find_directory_consumers',
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

// 容错：模型常把单个路径写成 scope.path（而非 schema 的 roots/files）。既然给了 path 就用它限定范围，
// 别退化成"没范围→扫全项目"。path 指向文件时按 files 用、指向目录时按 roots 用（两处都纳入，互不影响）。
function scopePathHints(request) {
  const value = normalizePath(request?.scope?.path);
  if (!value) return [];
  return [value];
}

function requestRoots(request) {
  return [...(request?.scope?.roots || []), ...scopePathHints(request)]
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

// 返回每个词的「所有」出现位置（不只第一处）：一个符号常「使用在前、定义在后」（如模板用 menuOptions、
// 脚本里才 const menuOptions = ...），只取第一处会漏掉定义处，read_file 就永远读不到真正的定义。
function literalMatches(text, terms, maxPerTerm = 6) {
  const lower = String(text || '').toLowerCase();
  const result = [];
  for (const term of (terms || []).map(String).map(item => item.trim()).filter(Boolean)) {
    const needle = term.toLowerCase();
    let from = 0;
    for (let count = 0; count < maxPerTerm; count += 1) {
      const index = lower.indexOf(needle, from);
      if (index < 0) break;
      result.push({ term, index });
      from = index + Math.max(1, needle.length);
    }
  }
  return result.sort((a, b) => a.index - b.index);
}

function lineIndexAt(text, index) {
  return String(text || '').slice(0, Math.max(0, index)).split(/\r?\n/).length - 1;
}

// around 可能是「起止行」(120-180 / 120~180 / 120:180) 或「单行」(120)。返回 0-based 半开区间，非行区间返回 null。
function parseLineRange(around) {
  const text = String(around || '').trim();
  const pair = text.match(/^(\d+)\s*[-~:]\s*(\d+)$/);
  if (pair) {
    const a = Number(pair[1]);
    const b = Number(pair[2]);
    return { start: Math.min(a, b), end: Math.max(a, b) };
  }
  const single = text.match(/^(\d+)$/);
  if (single) return { start: Number(single[1]), end: Number(single[1]) };
  return null;
}

// 通用地抽取文件里的顶层声明名(const/let/var/function/class)，miss 时回给模型「可下钻的符号清单」，
// 让它换一个真实符号继续，而不是被喂回文件开头。不写任何具体符号字面量。
function topLevelSymbols(text, limit = 48) {
  const names = new Set();
  const patterns = [
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g,
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(text)) && names.size < limit) names.add(match[1]);
  }
  return Array.from(names).slice(0, limit);
}

function executeReadFile(project, request, textCache) {
  const around = String(request.around || '').trim();
  const lineRange = parseLineRange(around);
  // around 若是符号名(非行区间)，就作为下钻锚点；否则回退到普通 terms。
  const terms = !lineRange && around ? [around] : requestTerms(request);
  return filesInScope(project, request).slice(0, requestLimit(request)).flatMap(file => {
    const text = readProjectText(project, file, textCache);
    const lines = numberedLines(text);
    const maxLines = lineLimit(request);
    // 1) 行区间下钻：精确返回该段(span 上限 MAX_LINES，避免变相读全文)。
    if (lineRange) {
      const start = Math.max(0, lineRange.start - 1);
      if (start >= lines.length) {
        return [{
          path: file.path,
          relation: 'read-miss',
          requested: around,
          note: `该文件只有 ${lines.length} 行，行区间 ${around} 超出范围`,
          availableSymbols: topLevelSymbols(text),
        }];
      }
      const end = Math.min(lines.length, Math.max(lineRange.end, lineRange.start), start + MAX_LINES);
      return [{
        path: file.path,
        relation: 'reads-range',
        lineStart: start + 1,
        lineEnd: end,
        snippet: lines.slice(start, end).join('\n'),
      }];
    }
    const matches = literalMatches(text, terms);
    if (matches.length) {
      // 每处命中取一段上下文，合并重叠区间 → 覆盖「使用处」和「定义处」等所有出现，而不只第一处。
      const before = Math.max(2, Math.floor(maxLines / 4));
      const ranges = [];
      for (const match of matches) {
        const line = lineIndexAt(text, match.index);
        const start = Math.max(0, line - before);
        const end = Math.min(lines.length, line + (maxLines - before));
        const last = ranges[ranges.length - 1];
        if (last && start <= last.end + 1) {
          last.end = Math.max(last.end, end);
          last.terms.add(match.term);
        } else {
          ranges.push({ start, end, terms: new Set([match.term]) });
        }
      }
      return ranges.slice(0, 4).map(range => ({
        path: file.path,
        relation: 'reads-focused',
        matchedTerms: Array.from(range.terms),
        lineStart: range.start + 1,
        lineEnd: range.end,
        snippet: lines.slice(range.start, range.end).join('\n'),
      }));
    }
    // 指定了锚点却没命中：不要静默回退到文件开头(那会把「下钻请求」变成「再给一遍开头」)。
    // 明确告诉模型没找到，并给出本文件可下钻的符号，让它换一个真实符号继续。
    if (terms.length) {
      return [{
        path: file.path,
        relation: 'read-miss',
        requested: terms.join('、'),
        note: '未在该文件中找到该锚点(符号/关键词)',
        availableSymbols: topLevelSymbols(text),
      }];
    }
    // 完全没给 around/terms：给文件开头作为初读。
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
    /\bimport\.meta\.glob(?:Eager)?\s*\(\s*['"]([^'"]+)['"]/g,
    /\brequire\.context\s*\(\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) && result.length < 120) result.push(match[1]);
  }
  return uniq(result);
}

function specifierIndex(text, specifier) {
  const quoted = [`'${specifier}'`, `"${specifier}"`];
  for (const item of quoted) {
    const index = String(text || '').indexOf(item);
    if (index >= 0) return index;
  }
  return String(text || '').indexOf(specifier);
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
  const fileSet = new Set((project.files || [])
    .filter(file => isTextFile(file.path))
    .map(file => file.path));
  const target = normalizePath(request.target || requestFiles(request)[0]);
  const source = (project.files || []).find(file => file.path === target && isTextFile(file.path));
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

function stripGlobSuffix(value) {
  let text = String(value || '').replace(/\\/g, '/');
  const globIndex = text.search(/[*{[]/);
  if (globIndex >= 0) text = text.slice(0, globIndex);
  text = text.replace(/\/+$/, '');
  const ext = path.posix.extname(text);
  if (ext) text = path.posix.dirname(text);
  return text.replace(/\/+$/, '');
}

function resolveSpecifierDirectory(fromFile, specifier) {
  const stripped = stripGlobSuffix(specifier);
  if (!stripped) return '';
  if (stripped.startsWith('.')) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), stripped));
  }
  if (stripped.startsWith('@/')) return path.posix.join('src', stripped.slice(2));
  if (stripped.startsWith('src/')) return stripped;
  return '';
}

function directoryConsumerRelation(fromFile, specifier, target, fileSet) {
  const resolved = resolveSpecifier(fromFile, specifier, fileSet);
  if (resolved === target) return 'imports-target';
  const targetIsDirectory = !(fileSet.has(target) || path.posix.extname(target));
  const targetDir = targetIsDirectory ? target : path.posix.dirname(target);
  const specDir = resolveSpecifierDirectory(fromFile, specifier);
  if (specDir && (targetDir === specDir || target.startsWith(`${specDir}/`))) {
    return /[*{[]/.test(specifier) ? 'directory-glob-consumer' : 'directory-consumer';
  }
  return '';
}

function executeFindDirectoryConsumers(project, request, textCache) {
  const fileSet = new Set((project.files || []).map(file => file.path));
  const target = normalizePath(request.target || requestFiles(request)[0]);
  if (!target) return [];
  const targetIsDirectory = !(fileSet.has(target) || path.posix.extname(target));
  const targetDir = targetIsDirectory ? target : path.posix.dirname(target);
  const targetBase = path.posix.basename(target).replace(/\.[^.]+$/, '');
  const pathNeedles = uniq([
    targetIsDirectory ? target : target.replace(/\.[^.]+$/, ''),
    targetIsDirectory ? `${target}/` : target,
    `@/${(targetIsDirectory ? target : target.replace(/\.[^.]+$/, '')).replace(/^src\//, '')}`,
  ].filter(Boolean));
  const result = [];
  for (const file of filesInScope(project, request)) {
    if (file.path === target || result.length >= requestLimit(request)) continue;
    const text = readProjectText(project, file, textCache);
    const lines = numberedLines(text);
    let best = null;
    for (const specifier of importSpecifiers(text)) {
      const relation = directoryConsumerRelation(file.path, specifier, target, fileSet);
      if (!relation) continue;
      if (targetIsDirectory && relation !== 'directory-glob-consumer') continue;
      if (!targetIsDirectory && relation === 'directory-consumer') continue;
      best = {
        path: file.path,
        relation,
        matchedTerms: [specifier],
        ...snippetAround(lines, lineIndexAt(text, specifierIndex(text, specifier)), lineLimit(request)),
      };
      break;
    }
    if (!best && !targetIsDirectory) {
      const matches = literalMatches(text, pathNeedles);
      if (matches.length) {
        const first = matches.sort((a, b) => a.index - b.index)[0];
        best = {
          path: file.path,
          relation: 'directory-path-reference',
          matchedTerms: uniq(matches.map(item => item.term)).slice(0, 6),
          ...snippetAround(lines, lineIndexAt(text, first.index), lineLimit(request)),
        };
      }
    }
    if (!best) continue;
    best.targetFile = target;
    best.targetDirectory = targetDir;
    best.targetBasename = targetBase;
    result.push(best);
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
    case 'find_directory_consumers':
      return executeFindDirectoryConsumers(project, request, textCache);
    case 'find_related_examples':
      return executeRelatedExamples(project, request, textCache);
    default:
      return [];
  }
}

function executeDiscoveryRequest(project, rawRequest, textCache = new Map()) {
  const plan = normalizePlan({ requests: [rawRequest] });
  const request = plan.requests[0];
  if (!request) return [];
  return executeRequest(project, request, textCache);
}

// 单次检索操作的自描述结果：{ operation, stats, matches }。工具（project-crud）直接返回它，
// 让 LLM 观测里带上频次统计（stats.termStats）与命中，也作为「经验沉淀」的证据来源。
function runDiscoveryOperation(project, rawRequest, textCache = new Map()) {
  const plan = normalizePlan({ requests: [rawRequest] });
  const request = plan.requests[0];
  if (!request) return { operation: rawRequest?.operation || 'unknown', stats: null, matches: [] };
  return {
    operation: request.operation,
    stats: discoveryRequestStats(project, request, textCache),
    matches: executeRequest(project, request, textCache),
  };
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
    expectedExperience: plan?.expectedExperience || {},
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
    if (['find_imports', 'find_importers', 'find_directory_consumers'].includes(request.operation)
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
  executeDiscoveryRequest,
  runDiscoveryOperation,
  normalizePlan,
};
