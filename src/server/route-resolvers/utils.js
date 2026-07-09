const path = require('path');
const { isTextFile, readProjectText } = require('../core/fs-utils');
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
  const raw = String(value || '/');
  const routeLike = /^\/{2,}[^/]/.test(raw) ? raw.replace(/^\/+/, '/') : raw;
  const normalized = normalizeUrlPath(routeLike)
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
  return normalized || '/';
}

function cleanRoutePath(value) {
  return cleanPagePath(value || '/');
}

function joinRoutePaths(paths) {
  let result = '';
  for (const rawPath of paths.filter(value => value !== undefined && value !== null)) {
    const routePath = String(rawPath || '').trim();
    if (!routePath) continue;
    if (routePath.startsWith('/')) {
      result = routePath;
      continue;
    }
    result = `${result.replace(/\/+$/, '')}/${routePath.replace(/^\/+/, '')}`;
  }
  return cleanRoutePath(result || '/');
}

function routePathMatches(routePath, pagePath) {
  return routeMatchRank(routePath, pagePath) > 0;
}

function routeMatchRank(routePath, pagePath) {
  const match = matchPathPattern(pagePath, routePath);
  if (!match.ok) return 0;
  if (match.exact) return 1000 + match.staticCount * 10 - match.dynamicCount * 2 - match.wildcardCount * 5;
  if (match.prefix) return 500 + match.staticCount * 10 - match.dynamicCount * 2 - match.wildcardCount * 5;
  return 0;
}

function routeSegments(pagePath) {
  return cleanPagePath(pagePath)
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);
}

function isDynamicRouteSegment(segment) {
  const value = String(segment || '').trim();
  return /^:/.test(value) || /^\[.+\]$/.test(value) || /^\$[A-Za-z0-9_]+/.test(value);
}

function isWildcardRouteSegment(segment) {
  const value = String(segment || '').trim();
  return value === '*' || value === '/*' || value === '**' || /^:\w+\(\.\*\)\*?$/.test(value) || /^\[\.\.\..+\]$/.test(value);
}

function matchPathPattern(pagePath, routePath) {
  const page = routeSegments(pagePath).map(segment => segment.toLowerCase());
  const route = routeSegments(routePath).map(segment => segment.toLowerCase());
  if (!route.length) {
    return {
      ok: page.length === 0,
      exact: page.length === 0,
      prefix: false,
      staticCount: 0,
      dynamicCount: 0,
      wildcardCount: 0,
    };
  }

  let staticCount = 0;
  let dynamicCount = 0;
  let wildcardCount = 0;
  for (let index = 0; index < route.length; index++) {
    const routeSegment = route[index];
    const pageSegment = page[index];
    if (isWildcardRouteSegment(routeSegment)) {
      wildcardCount += 1;
      return {
        ok: true,
        exact: false,
        prefix: true,
        staticCount,
        dynamicCount,
        wildcardCount,
      };
    }
    if (pageSegment === undefined) {
      return {
        ok: false,
        exact: false,
        prefix: false,
        staticCount,
        dynamicCount,
        wildcardCount,
      };
    }
    if (isDynamicRouteSegment(routeSegment)) {
      dynamicCount += 1;
      continue;
    }
    if (routeSegment !== pageSegment) {
      return {
        ok: false,
        exact: false,
        prefix: false,
        staticCount,
        dynamicCount,
        wildcardCount,
      };
    }
    staticCount += 1;
  }

  return {
    ok: true,
    exact: page.length === route.length,
    prefix: page.length > route.length,
    staticCount,
    dynamicCount,
    wildcardCount,
  };
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

function routePathFromFile(filePath, root) {
  const normalized = posixPath(filePath);
  const prefix = `${posixPath(root).replace(/\/+$/, '')}/`;
  if (!normalized.startsWith(prefix)) return '';
  let rel = normalized.slice(prefix.length);
  rel = rel.replace(/\.(vue|tsx|jsx|ts|js|mjs|cjs)$/, '');
  rel = rel
    .replace(/\/index$/, '')
    .replace(/\/page$/, '')
    .replace(/^index$/, '')
    .replace(/^page$/, '');
  if (!rel) return '/';
  const segments = rel
    .split('/')
    .filter(Boolean)
    .filter(segment => !segment.startsWith('_') || /^_/.test(segment) && !/^_(app|document|error|layout)$/.test(segment))
    .map(segment => {
      if (/^\[\.\.\..+\]$/.test(segment)) return '*';
      if (/^\[.+\]$/.test(segment)) return `:${segment.slice(1, -1)}`;
      if (/^_.+/.test(segment)) return `:${segment.slice(1)}`;
      return segment;
    });
  return cleanRoutePath(`/${segments.join('/')}`);
}

function fileConventionRouteNodes(project, options = {}) {
  const roots = options.roots || PAGE_ROOTS;
  const extensions = new Set(options.extensions || SOURCE_EXTENSIONS);
  const adapter = options.adapter || 'file-convention';
  const framework = options.framework || adapter;
  const nodes = [];
  for (const file of project.files || []) {
    const ext = path.posix.extname(file.path);
    if (!extensions.has(ext)) continue;
    if (/(^|\/)(api|components?|hooks?|utils?|services?|stores?|assets?|styles?)\//.test(file.path)) continue;
    if (/(^|\/)(_?(app|document|error|layout)|layout|template|loading|not-found)\.(vue|tsx|jsx|ts|js)$/.test(file.path)) continue;
    for (const root of roots) {
      const routePath = routePathFromFile(file.path, root);
      if (!routePath) continue;
      nodes.push({
        routePath,
        rawPath: routePath,
        componentFile: file.path,
        sourceFile: file.path,
        framework,
        adapter,
        isLeaf: true,
        isLayoutLike: false,
      });
      break;
    }
  }
  return nodes;
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

function routeNodeHit(project, routeNode, pagePath, options = {}) {
  if (!routeNode?.componentFile) return null;
  const hit = routeHit(project, routeNode.componentFile, {
    adapter: routeNode.adapter || routeNode.framework || options.adapter || 'route-node',
    score: options.score || 600,
    from: routeNode.sourceFile,
    routePath: routeNode.routePath,
    reasons: options.reasons || [],
    textCache: options.textCache,
  });
  if (!hit) return null;
  hit.routeNode = routeNode;
  hit.routeMatch = options.match || null;
  hit.bestPageFile = routeNode.componentFile;
  hit.reasons = uniq([
    ...(hit.reasons || []),
    `页面路径 ${cleanPagePath(pagePath)} 命中路由：${routeNode.routePath}`,
    routeNode.rawPath && routeNode.rawPath !== routeNode.routePath ? `路由声明 path：${routeNode.rawPath}` : '',
    routeNode.isLeaf ? '叶子路由' : '父级/容器路由',
    routeNode.isLayoutLike ? '像布局容器，已降权' : '',
    routeNode.sourceFile ? `路由文件：${routeNode.sourceFile}` : '',
  ]).slice(0, 10);
  return hit;
}

function normalizeRouteNode(route) {
  if (!route) return null;
  const routePath = cleanRoutePath(route.routePath || route.fullPath || route.path || '/');
  if (!routePath) return null;
  return {
    routePath,
    rawPath: String(route.rawPath ?? route.path ?? route.routePath ?? ''),
    componentFile: route.componentFile || '',
    sourceFile: route.sourceFile || '',
    framework: route.framework || route.adapter || 'unknown',
    adapter: route.adapter || route.framework || 'unknown',
    isLeaf: route.isLeaf !== false,
    isLayoutLike: !!route.isLayoutLike,
    parent: route.parent || '',
    meta: route.meta || {},
  };
}

function normalizeRoutes(routes) {
  const map = new Map();
  for (const rawRoute of routes || []) {
    const route = normalizeRouteNode(rawRoute);
    if (!route) continue;
    const key = [
      route.adapter,
      route.routePath,
      route.componentFile,
      route.sourceFile,
      route.rawPath,
    ].join('|');
    if (!map.has(key)) map.set(key, route);
  }
  return Array.from(map.values());
}

function scoreRouteMatch(route, match) {
  let score = 0;
  const reasons = [];
  if (match.exact) {
    score += 1000;
    reasons.push('路径精确匹配');
  } else if (match.prefix) {
    score += 360;
    reasons.push('父级路径匹配');
  }
  score += match.staticCount * 100;
  score -= match.dynamicCount * 20;
  score -= match.wildcardCount * 300;
  if (route.isLeaf) {
    score += 80;
    reasons.push('叶子路由');
  }
  if (route.componentFile) {
    score += 60;
    reasons.push('存在页面组件文件');
  }
  if (route.isLayoutLike) {
    score -= 80;
    reasons.push('像布局容器，降权');
  }
  return { score, reasons };
}

function matchRoutes(pathname, routes) {
  const pagePath = cleanPagePath(pathname);
  const hits = [];
  for (const route of normalizeRoutes(routes)) {
    const match = matchPathPattern(pagePath, route.routePath);
    if (!match.ok) continue;
    const scored = scoreRouteMatch(route, match);
    hits.push({
      route,
      match,
      score: scored.score,
      reasons: scored.reasons,
    });
  }
  return hits.sort((a, b) => b.score - a.score);
}

function detectLayoutLike(project, filePath, textCache) {
  if (!filePath) return false;
  if (/(^|\/)(layout|layouts|Layout)\b/.test(filePath) || /layout/i.test(filePath)) return true;
  const file = (project.files || []).find(item => item.path === filePath);
  if (!file || !isTextFile(file.path)) return false;
  const text = readProjectText(project, file, textCache);
  return /<router-view\b|<RouterView\b|<Outlet\b|\{\s*children\s*\}/.test(text || '');
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
  cleanRoutePath,
  detectLayoutLike,
  fileConventionHits,
  fileConventionRouteNodes,
  joinRoutePaths,
  matchPathPattern,
  matchRoutes,
  normalizeRoutes,
  projectFileMap,
  resolveImportFile,
  routeHit,
  routeNodeHit,
  routeMatchRank,
  routePathMatches,
  routeSegments,
  routeSourceFiles,
};
