const path = require('path');
const { isTextFile, readProjectText } = require('../fs-utils');
const { makeSnippet, posixPath, uniq } = require('../utils');
const { isPageLike } = require('./component-trace');

const MAX_IMPORT_DEPTH = 28;
const MAX_IMPORT_SEEDS = 8;
const MAX_IMPORT_HITS = 24;
const SOURCE_EXTENSIONS = ['.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

function importSpecifiers(text) {
  const specs = [];
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) && specs.length < 120) {
      specs.push(match[1]);
    }
  }
  return uniq(specs);
}

function candidatePathsForImport(fromFile, specifier) {
  if (!specifier || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(specifier)) return [];
  let base = '';
  if (specifier.startsWith('.')) {
    base = posixPath(path.posix.join(path.posix.dirname(fromFile), specifier));
  } else if (specifier.startsWith('@/')) {
    const aliasPath = posixPath(specifier.slice(2));
    return importPathCandidates(aliasPath, posixPath(path.posix.join('src', aliasPath)));
  } else if (specifier.startsWith('~/')) {
    const aliasPath = posixPath(specifier.slice(2));
    return importPathCandidates(aliasPath, posixPath(path.posix.join('src', aliasPath)));
  } else if (specifier.startsWith('src/')) {
    base = posixPath(specifier);
  } else {
    return [];
  }

  return importPathCandidates(base);
}

function importPathCandidates(...bases) {
  const result = [];
  for (const base of uniq(bases)) {
    const ext = path.posix.extname(base);
    const paths = ext ? [base] : SOURCE_EXTENSIONS.map(item => `${base}${item}`);
    if (!ext) {
      for (const item of SOURCE_EXTENSIONS) paths.push(`${base}/index${item}`);
    }
    result.push(...paths);
  }
  return uniq(result);
}

function isImportAnchor(hit) {
  if (!hit) return false;
  if (hit.stage === 'route-resolver') return true;
  if (hit.uniqueMatchLabel === '用户补充证据' && hit.uniqueMatchCount === 1) return true;
  return (hit.reasons || []).some(reason => reason.includes('用户补充证据'));
}

function anchorLabel(anchor) {
  if (anchor.stage === 'route-resolver') return `页面路由命中文件：${anchor.file}`;
  return `补充证据命中文件：${anchor.file}`;
}

function hasReliableEvidence(hit) {
  return !!(hit && hit.preciseEvidence);
}

function importChainScore(candidate, anchor, depth) {
  const fromRoute = anchor.stage === 'route-resolver';
  const reliable = hasReliableEvidence(candidate);
  const routeBoost = fromRoute
    ? (reliable ? 92 : 28)
    : (reliable ? 72 : 20);
  const pageBoost = isPageLike(anchor.file) ? 26 : 0;
  const depthPenalty = Math.min(220, depth * (reliable ? 20 : 34));
  const chainScore = candidate.score + routeBoost + pageBoost - depthPenalty;
  if (fromRoute && !reliable) {
    return Math.min(chainScore, Math.max(0, anchor.score - 18 - depth * 8));
  }
  return chainScore;
}

function importChainStage(anchor) {
  return anchor.stage === 'route-resolver' ? 'route-import-chain' : 'import-chain';
}

function importChainReasons(anchor, current, candidate) {
  return uniq([
    anchorLabel(anchor),
    `import 链路命中候选：${current.chain.join(' -> ')}`,
    current.via ? `最后引用：${current.via}` : '',
    ...(candidate.reasons || []).slice(0, 6),
  ]).slice(0, 10);
}

function shouldRecordChainHit(anchor, candidate) {
  if (!candidate) return false;
  if (anchor.stage === 'route-resolver' && candidate.stage === 'reverse') return false;
  return true;
}

function buildFileMap(project) {
  const map = new Map();
  for (const file of project.files || []) {
    if (isTextFile(file.path)) map.set(file.path, file);
  }
  return map;
}

function importedFiles(project, filePath, fileMap, textCache) {
  const file = fileMap.get(filePath);
  if (!file) return [];
  const text = readProjectText(project, file, textCache);
  const result = [];
  for (const specifier of importSpecifiers(text)) {
    for (const candidate of candidatePathsForImport(filePath, specifier)) {
      if (fileMap.has(candidate)) {
        result.push({ file: candidate, specifier });
        break;
      }
    }
  }
  return result;
}

function chainSnippet(project, filePath, textCache) {
  const file = (project.files || []).find(item => item.path === filePath);
  if (!file) return '';
  const text = readProjectText(project, file, textCache);
  return makeSnippet(text, 0, 0);
}

function traceImportChainHits(project, anchorHits, candidateHits, textCache) {
  const candidateMap = new Map();
  for (const hit of candidateHits) {
    if (!hit || !hit.file) continue;
    candidateMap.set(hit.file, hit);
  }
  if (!candidateMap.size) return [];

  const anchors = anchorHits
    .filter(isImportAnchor)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_IMPORT_SEEDS);
  if (!anchors.length) return [];

  const fileMap = buildFileMap(project);
  const tracedHits = [];

  for (const anchor of anchors) {
    const queue = [{
      file: anchor.file,
      depth: 0,
      chain: [anchor.file],
      via: '',
    }];
    const visited = new Set([anchor.file]);

    while (queue.length && tracedHits.length < MAX_IMPORT_HITS) {
      const current = queue.shift();
      const candidate = candidateMap.get(current.file);
      if (candidate && current.file !== anchor.file && shouldRecordChainHit(anchor, candidate)) {
        tracedHits.push({
          ...candidate,
          score: importChainScore(candidate, anchor, current.depth),
          stage: importChainStage(anchor),
          from: anchor.file,
          reasons: importChainReasons(anchor, current, candidate),
          snippet: candidate.snippet || chainSnippet(project, current.file, textCache),
          importChain: current.chain,
          anchorFile: anchor.file,
          exactMatchLabel: candidate.exactMatchLabel || '',
          exactMatchText: candidate.exactMatchText || '',
          exactMatchCount: candidate.exactMatchCount || 0,
          exactSnippet: candidate.exactSnippet || '',
          contextScore: candidate.contextScore || 0,
          contextReasons: candidate.contextReasons || [],
          contextSelectionIndex: candidate.contextSelectionIndex || 0,
          preciseEvidence: !!candidate.preciseEvidence,
          preciseSnippet: candidate.preciseSnippet || '',
          uniqueSnippet: candidate.uniqueSnippet || '',
          uniqueMatchLabel: candidate.uniqueMatchLabel || '',
          uniqueMatchText: candidate.uniqueMatchText || '',
          uniqueMatchCount: candidate.uniqueMatchCount || 0,
        });
      }

      if (current.depth >= MAX_IMPORT_DEPTH) continue;
      for (const child of importedFiles(project, current.file, fileMap, textCache)) {
        if (visited.has(child.file)) continue;
        visited.add(child.file);
        queue.push({
          file: child.file,
          depth: current.depth + 1,
          chain: [...current.chain, child.file],
          via: child.specifier,
        });
      }
    }
  }

  return tracedHits
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_IMPORT_HITS);
}

module.exports = {
  importSpecifiers,
  traceImportChainHits,
};
