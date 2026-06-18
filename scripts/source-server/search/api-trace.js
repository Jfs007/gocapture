const {
  COMMON_PATH_PREFIXES,
  GENERIC_SYMBOLS,
  STOP_TOKENS,
} = require('../config');
const {
  escapeRegExp,
  makeSnippet,
  normalizeUrlPath,
  uniq,
} = require('../utils');
const { isTextFile, readProjectText } = require('../fs-utils');
const { scoreFileText } = require('./evidence');
const { isPageLike } = require('./component-trace');

const MAX_API_ENDPOINTS = 3;
const MAX_ENDPOINT_HITS = 8;
const MAX_TRACE_DEPTH = 3;
const MAX_TRACE_SEEDS_PER_DEPTH = 24;
const MAX_TRACE_HITS = 24;

function endpointPath(value) {
  const normalized = normalizeUrlPath(value)
    .replace(/\/{2,}/g, '/')
    .split('#')[0]
    .split('?')[0]
    .replace(/\/+$/g, '');
  if (!normalized || normalized === '/') return '';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function endpointVariants(value) {
  const fullPath = endpointPath(value);
  if (!fullPath || fullPath.length < 3) return [];

  const segments = fullPath.split('/').filter(Boolean);
  const variants = [
    { value: fullPath, weight: 82, label: '接口完整路径' },
    { value: fullPath.slice(1), weight: 72, label: '接口完整路径' },
  ];

  const prefixIndex = segments.findIndex(segment => COMMON_PATH_PREFIXES.has(segment.toLowerCase()));
  if (prefixIndex > 0 && prefixIndex < segments.length - 1) {
    const withoutHostPrefix = `/${segments.slice(prefixIndex).join('/')}`;
    variants.push({ value: withoutHostPrefix, weight: 76, label: '接口路径后缀' });
    variants.push({ value: withoutHostPrefix.slice(1), weight: 66, label: '接口路径后缀' });
  }

  const maxSuffix = Math.min(4, segments.length);
  for (let size = maxSuffix; size >= 2; size--) {
    const suffix = `/${segments.slice(-size).join('/')}`;
    variants.push({ value: suffix, weight: 56 + size * 5, label: '接口路径后缀' });
    variants.push({ value: suffix.slice(1), weight: 48 + size * 5, label: '接口路径后缀' });
  }

  const last = segments[segments.length - 1];
  if (last && last.length >= 4 && !/^\d+$/.test(last) && !STOP_TOKENS.has(last.toLowerCase())) {
    variants.push({ value: last, weight: 28, label: '接口末段' });
  }

  const seen = new Set();
  return variants.filter(item => {
    const key = item.value.toLowerCase();
    if (seen.has(key) || item.value.length < 3) return false;
    seen.add(key);
    return true;
  });
}

function collectApiEndpoints(body) {
  if (body.includeApi !== true) return [];
  const raw = [];
  const apiRequests = Array.isArray(body.apiRequests) ? body.apiRequests : [];
  for (const item of apiRequests) {
    raw.push(item.pathname || item.url);
  }
  if (Array.isArray(body.apiPaths)) raw.push(...body.apiPaths);
  return uniq(raw.map(endpointPath)).slice(0, MAX_API_ENDPOINTS);
}

function cleanSymbol(value) {
  const symbol = String(value || '').trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(symbol)) return '';
  if (symbol.length < 3 || symbol.length > 80) return '';
  if (GENERIC_SYMBOLS.has(symbol.toLowerCase())) return '';
  return symbol;
}

function uniqueSymbols(list) {
  return uniq(list.map(cleanSymbol)).slice(0, 16);
}

function lastNamedMatch(text, regex, index) {
  regex.lastIndex = 0;
  let match;
  let last = null;
  while ((match = regex.exec(text)) && match.index <= index) {
    const symbol = cleanSymbol(match[1]);
    if (symbol) last = { symbol, index: match.index };
  }
  return last;
}

function extractEnclosingSymbols(text, index) {
  const prefixStart = Math.max(0, index - 7000);
  const prefix = text.slice(prefixStart, index);
  const patterns = [
    /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g,
    /\b([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g,
    /\b(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
  ];
  const matches = patterns
    .map(pattern => lastNamedMatch(prefix, pattern, prefix.length))
    .filter(Boolean)
    .sort((a, b) => b.index - a.index);
  return uniqueSymbols(matches.map(item => item.symbol));
}

function extractEndpointConstant(text, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1;
  const before = text.slice(lineStart, index);
  const match = before.match(/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*['"`][^'"`]*$/);
  return match ? cleanSymbol(match[1]) : '';
}

function symbolUsageRegex(symbol) {
  return new RegExp(`(^|[^\\w$])(${escapeRegExp(symbol)})(?![\\w$])`, 'g');
}

function findSymbolUsage(text, symbols) {
  for (const symbol of uniqueSymbols(symbols)) {
    const regex = symbolUsageRegex(symbol);
    const match = regex.exec(text);
    if (!match) continue;
    return {
      symbol,
      index: match.index + match[1].length,
    };
  }
  return null;
}

function findLocalWrappersForSymbol(text, symbol) {
  if (!symbol) return [];
  const wrappers = [];
  const regex = symbolUsageRegex(symbol);
  let match;
  while ((match = regex.exec(text)) && wrappers.length < 8) {
    const index = match.index + match[1].length;
    const names = extractEnclosingSymbols(text, index).filter(name => name !== symbol);
    wrappers.push(...names);
  }
  return uniqueSymbols(wrappers);
}

function isApiLikeFile(filePath) {
  return /(^|\/)(api|apis|service|services|request|requests|http|client|clients)\//i.test(filePath);
}

function isTraceBridgeFile(filePath) {
  return /(^|\/)(api|apis|service|services|store|stores|model|models|hooks?|composables?|utils?)\//i.test(filePath);
}

function traceFilePriority(filePath) {
  if (isPageLike(filePath)) return 0;
  if (isTraceBridgeFile(filePath)) return 1;
  return 2;
}

function endpointFilePriority(filePath) {
  if (isApiLikeFile(filePath)) return 0;
  if (isTraceBridgeFile(filePath)) return 1;
  return 2;
}

function uniqueSeeds(seeds, limit = MAX_TRACE_SEEDS_PER_DEPTH) {
  const result = [];
  const seen = new Set();
  for (const seed of seeds) {
    const symbol = cleanSymbol(seed.symbol);
    if (!symbol) continue;
    const key = `${seed.depth}:${seed.file}:${symbol}:${seed.endpoint}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...seed, symbol });
    if (result.length >= limit) break;
  }
  return result;
}

function inferEndpointSymbols(text, index) {
  const symbols = [...extractEnclosingSymbols(text, index)];
  const endpointConstant = extractEndpointConstant(text, index);
  if (endpointConstant) {
    symbols.push(endpointConstant);
    symbols.push(...findLocalWrappersForSymbol(text, endpointConstant));
  }
  return uniqueSymbols(symbols);
}

function findEndpointDefinitionHits(project, endpoints, evidence, textCache) {
  const hits = [];
  const seeds = [];
  if (!endpoints.length) return { hits, seeds };

  const files = project.files
    .filter(file => isTextFile(file.path))
    .sort((a, b) => endpointFilePriority(a.path) - endpointFilePriority(b.path));

  for (const file of files) {
    if (hits.length >= MAX_ENDPOINT_HITS) break;
    if (!isTextFile(file.path)) continue;
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const lowerText = text.toLowerCase();

    for (const endpoint of endpoints) {
      const variants = endpointVariants(endpoint);
      let matched = null;
      for (const variant of variants) {
        const index = lowerText.indexOf(variant.value.toLowerCase());
        if (index === -1) continue;
        matched = { ...variant, index };
        break;
      }
      if (!matched) continue;

      const uiScore = scoreFileText(file, text, evidence);
      const symbols = inferEndpointSymbols(text, matched.index);
      const score = Math.round(matched.weight * 0.85)
        + (isApiLikeFile(file.path) ? 32 : 0)
        + Math.min(45, Math.round(uiScore.score * 0.25));
      const reasons = [
        `接口端点命中(${matched.label})：${matched.value}`,
        symbols.length ? `外层符号：${symbols.join(', ')}` : '',
        isApiLikeFile(file.path) ? '路径像接口封装文件' : '',
        ...uiScore.reasons.slice(0, 3),
      ].filter(Boolean);

      hits.push({
        file: file.path,
        score,
        stage: 'api-endpoint',
        from: endpoint,
        reasons: uniq(reasons).slice(0, 10),
        snippet: makeSnippet(text, matched.index, matched.value.length),
        exactMatchLabel: uiScore.exactMatchLabel,
        exactMatchText: uiScore.exactMatchText,
        exactMatchCount: uiScore.exactMatchCount,
        exactSnippet: uiScore.exactSnippet,
        contextScore: uiScore.contextScore,
        contextReasons: uiScore.contextReasons,
        contextSelectionIndex: uiScore.contextSelectionIndex,
        preciseEvidence: uiScore.preciseEvidence,
        preciseSnippet: uiScore.preciseSnippet,
        uniqueSnippet: uiScore.uniqueSnippet,
        uniqueMatchLabel: uiScore.uniqueMatchLabel,
        uniqueMatchText: uiScore.uniqueMatchText,
        uniqueMatchCount: uiScore.uniqueMatchCount,
        symbols,
      });

      for (const symbol of symbols) {
        seeds.push({
          symbol,
          endpoint,
          file: file.path,
          depth: 1,
        });
      }
      break;
    }
  }

  return {
    hits: hits.slice(0, MAX_ENDPOINT_HITS),
    seeds: uniqueSeeds(seeds),
  };
}

function traceReferenceUsage(project, seeds, evidence, textCache) {
  const hits = [];
  const nextSeeds = [];
  const traceSeeds = uniqueSeeds(seeds);
  if (!traceSeeds.length) return { hits, nextSeeds };
  const sourceFilesBySymbol = new Map();
  for (const seed of traceSeeds) {
    const list = sourceFilesBySymbol.get(seed.symbol) || [];
    list.push(seed);
    sourceFilesBySymbol.set(seed.symbol, list);
  }

  const files = project.files
    .filter(file => isTextFile(file.path))
    .sort((a, b) => traceFilePriority(a.path) - traceFilePriority(b.path));

  for (const file of files) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;

    const usage = findSymbolUsage(text, traceSeeds.map(seed => seed.symbol));
    if (!usage) continue;
    const possibleSeeds = sourceFilesBySymbol.get(usage.symbol) || [];
    const seed = possibleSeeds.find(item => item.file !== file.path);
    if (!seed) continue;

    const uiScore = scoreFileText(file, text, evidence);
    const pageBoost = isPageLike(file.path) ? 44 : 0;
    const bridgeBoost = isTraceBridgeFile(file.path) ? 20 : 0;
    const depthPenalty = Math.max(0, seed.depth - 1) * 18;
    const score = 86 + pageBoost + bridgeBoost - depthPenalty + Math.min(160, Math.round(uiScore.score * 1.35));
    const stage = seed.depth === 1 ? 'api-usage' : 'api-upstream';
    const reasons = [
      `接口追踪：${seed.endpoint}`,
      `引用符号：${usage.symbol}`,
      `来自：${seed.file}`,
      `追踪层级：${seed.depth}`,
      isPageLike(file.path) ? '路径像页面级文件' : '',
      ...uiScore.reasons.slice(0, 5),
    ].filter(Boolean);

    hits.push({
      file: file.path,
      score,
      stage,
      from: seed.file,
      reasons: uniq(reasons).slice(0, 10),
      snippet: makeSnippet(text, usage.index, usage.symbol.length),
      exactMatchLabel: uiScore.exactMatchLabel,
      exactMatchText: uiScore.exactMatchText,
      exactMatchCount: uiScore.exactMatchCount,
      exactSnippet: uiScore.exactSnippet,
      contextScore: uiScore.contextScore,
      contextReasons: uiScore.contextReasons,
      contextSelectionIndex: uiScore.contextSelectionIndex,
      preciseEvidence: uiScore.preciseEvidence,
      preciseSnippet: uiScore.preciseSnippet,
      uniqueSnippet: uiScore.uniqueSnippet,
      uniqueMatchLabel: uiScore.uniqueMatchLabel,
      uniqueMatchText: uiScore.uniqueMatchText,
      uniqueMatchCount: uiScore.uniqueMatchCount,
    });

    const enclosing = extractEnclosingSymbols(text, usage.index);
    for (const nextSymbol of uniqueSymbols(enclosing)) {
      if (nextSymbol === usage.symbol) continue;
      nextSeeds.push({
        symbol: nextSymbol,
        endpoint: seed.endpoint,
        file: file.path,
        depth: seed.depth + 1,
      });
    }
    if (hits.length >= MAX_TRACE_HITS) break;
  }

  return {
    hits,
    nextSeeds: uniqueSeeds(nextSeeds),
  };
}

function traceApiReferences(project, body, evidence, textCache) {
  const endpoints = collectApiEndpoints(body);
  const { hits: endpointHits, seeds } = findEndpointDefinitionHits(project, endpoints, evidence, textCache);
  const hits = [...endpointHits];
  const queue = uniqueSeeds(seeds);
  const visited = new Set();

  while (queue.length) {
    const depth = Math.min(...queue.map(seed => seed.depth));
    if (depth > MAX_TRACE_DEPTH) break;
    const currentDepthSeeds = [];
    for (let index = queue.length - 1; index >= 0; index--) {
      if (queue[index].depth !== depth) continue;
      const seed = queue.splice(index, 1)[0];
      const key = `${seed.depth}:${seed.file}:${seed.symbol}`;
      if (visited.has(key)) continue;
      visited.add(key);
      currentDepthSeeds.push(seed);
    }
    if (!currentDepthSeeds.length) continue;

    const result = traceReferenceUsage(project, currentDepthSeeds, evidence, textCache);
    hits.push(...result.hits);
    for (const nextSeed of result.nextSeeds) {
      if (nextSeed.depth <= MAX_TRACE_DEPTH) queue.push(nextSeed);
    }
    if (hits.length >= MAX_TRACE_HITS) break;
  }

  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, 18)
    .map(({ symbols, ...hit }) => hit);
}

module.exports = {
  cleanSymbol,
  collectApiEndpoints,
  endpointPath,
  endpointVariants,
  extractEnclosingSymbols,
  traceApiReferences,
};
