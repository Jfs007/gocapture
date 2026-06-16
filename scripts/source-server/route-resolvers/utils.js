const path = require('path');
const { isTextFile, readProjectText } = require('../fs-utils');
const { makeSnippet, normalizeUrlPath, posixPath, uniq } = require('../utils');

const SOURCE_EXTENSIONS = ['.vue', '.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs'];
const PAGE_ROOTS = ['src/pages', 'src/views', 'src/routes', 'pages', 'views', 'routes', 'app'];

function projectFileMap(project) {
  const map = new Map();
  for (const file of project.files || []) {
    map.set(file.path, file);
  }
  return map;
}

function cleanPagePath(value) {
  const normalized = normalizeUrlPath(value || '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
  return normalized || '/';
}

function routePathMatches(routePath, pagePath) {
  return routeMatchRank(routePath, pagePath) > 0;
}

function routeMatchRank(routePath, pagePath) {
  const route = cleanPagePath(routePath);
  const page = cleanPagePath(pagePath);
  const routeDepth = routeSegments(route).length;
  if (route === page) return 1000 + routeDepth;
  if (route !== '/' && page.startsWith(`${route}/`)) return 500 + routeDepth;
  const routeTail = route.replace(/^\/+/, '');
  if (!routeTail || routeTail.includes(':') || routeTail.includes('*')) return 0;
  return page.endsWith(`/${routeTail}`) ? 100 + routeDepth : 0;
}

function routeSegments(pagePath) {
  return cleanPagePath(pagePath)
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);
}

function candidatePathsForImport(fromFile, specifier) {
  if (!specifier || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(specifier)) return [];
  let base = '';
  if (specifier.startsWith('.')) {
    base = posixPath(path.posix.join(path.posix.dirname(fromFile), specifier));
  } else if (specifier.startsWith('@/')) {
    const aliasPath = posixPath(specifier.slice(2));
    const withSrc = posixPath(path.posix.join('src', aliasPath));
    const scopedSrc = scopedSrcAliasPath(fromFile, aliasPath);
    return importPathCandidates(aliasPath, withSrc, scopedSrc);
  } else if (specifier.startsWith('~/')) {
    const aliasPath = posixPath(specifier.slice(2));
    const withSrc = posixPath(path.posix.join('src', aliasPath));
    const scopedSrc = scopedSrcAliasPath(fromFile, aliasPath);
    return importPathCandidates(aliasPath, withSrc, scopedSrc);
  } else if (specifier.startsWith('src/')) {
    base = posixPath(specifier);
  } else {
    return [];
  }

  return importPathCandidates(base);
}

function scopedSrcAliasPath(fromFile, aliasPath) {
  const marker = '/src/';
  const normalized = posixPath(fromFile);
  const index = normalized.indexOf(marker);
  if (index === -1) return '';
  const srcRoot = normalized.slice(0, index + marker.length - 1);
  return posixPath(path.posix.join(srcRoot, aliasPath));
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

function resolveImportFile(project, fromFile, specifier, fileMap = projectFileMap(project)) {
  for (const candidate of candidatePathsForImport(fromFile, specifier)) {
    if (fileMap.has(candidate)) return candidate;
  }
  return '';
}

function fileConventionCandidates(pagePath, roots = PAGE_ROOTS, extensions = SOURCE_EXTENSIONS) {
  const segments = routeSegments(pagePath);
  const rel = segments.join('/');
  const candidates = [];
  for (const root of roots) {
    if (!rel) {
      for (const ext of extensions) {
        candidates.push(`${root}/index${ext}`);
        candidates.push(`${root}/page${ext}`);
      }
      continue;
    }
    for (const ext of extensions) {
      candidates.push(`${root}/${rel}${ext}`);
      candidates.push(`${root}/${rel}/index${ext}`);
      candidates.push(`${root}/${rel}/page${ext}`);
    }
  }
  return uniq(candidates);
}

function fileConventionHits(project, pagePath, options = {}) {
  const fileMap = options.fileMap || projectFileMap(project);
  const roots = options.roots || PAGE_ROOTS;
  const extensions = options.extensions || SOURCE_EXTENSIONS;
  const hits = [];
  for (const candidate of fileConventionCandidates(pagePath, roots, extensions)) {
    const file = fileMap.get(candidate);
    if (!file) continue;
    hits.push(routeHit(project, file.path, {
      adapter: options.adapter || 'file-convention',
      score: options.score || 360,
      reasons: [
        `页面路径 ${cleanPagePath(pagePath)} 命中文件约定：${file.path}`,
        options.reason || '',
      ],
      textCache: options.textCache,
    }));
  }
  return hits;
}

function routeHit(project, filePath, options = {}) {
  const file = (project.files || []).find(item => item.path === filePath);
  if (!file || !isTextFile(file.path)) return null;
  const text = readProjectText(project, file, options.textCache);
  return {
    file: file.path,
    score: options.score || 360,
    stage: 'route-resolver',
    from: options.from || '',
    reasons: uniq([
      `路由适配器：${options.adapter || 'unknown'}`,
      ...(options.reasons || []),
    ]).slice(0, 10),
    snippet: options.snippet || makeSnippet(text, 0, 0),
    uniqueSnippet: '',
    uniqueMatchLabel: '',
    uniqueMatchText: '',
    uniqueMatchCount: 0,
    routeAdapter: options.adapter || 'unknown',
    routePath: options.routePath || '',
  };
}

function routeSourceFiles(project, includePatterns) {
  return (project.files || []).filter(file => {
    if (!isTextFile(file.path)) return false;
    return includePatterns.some(pattern => pattern.test(file.path));
  });
}

module.exports = {
  SOURCE_EXTENSIONS,
  cleanPagePath,
  fileConventionHits,
  projectFileMap,
  resolveImportFile,
  routeHit,
  routeMatchRank,
  routePathMatches,
  routeSegments,
  routeSourceFiles,
};
