const {
  cleanPagePath,
  matchRoutes,
  routeHit,
  routeNodeHit,
} = require('./utils');
const vue = require('./adapters/vue');
const vueVite = require('./adapters/vue-vite');
const vueWebpack = require('./adapters/vue-webpack');
const reactCommon = require('./adapters/react-common');
const reactVite = require('./adapters/react-vite');
const reactWebpack = require('./adapters/react-webpack');
const next = require('./adapters/next');
const nuxt = require('./adapters/nuxt');
const umi = require('./adapters/umi');
const unknown = require('./adapters/unknown');

const adapters = [
  vue,
  vueVite,
  vueWebpack,
  reactCommon,
  reactVite,
  reactWebpack,
  next,
  nuxt,
  umi,
  unknown,
];

function adaptersForKind(kind) {
  const projectKind = kind || 'unknown';
  return adapters.filter(adapter => (adapter.kinds || []).includes(projectKind));
}

function uniqueHits(hits) {
  const map = new Map();
  for (const hit of hits.filter(Boolean)) {
    const old = map.get(hit.file);
    if (!old || old.score < hit.score) {
      map.set(hit.file, hit);
    }
  }
  return Array.from(map.values());
}

function uniqueRouteMatches(matches) {
  const map = new Map();
  for (const item of matches || []) {
    const route = item.route || {};
    const key = route.componentFile
      ? `${route.routePath || ''}|${route.componentFile}`
      : `${route.routePath || ''}|${route.sourceFile || ''}|${route.rawPath || ''}`;
    const old = map.get(key);
    if (!old || old.score < item.score) map.set(key, item);
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

function isWildcardRouteMatch(item) {
  const route = item?.route || {};
  const routePath = String(route.routePath || route.rawPath || '');
  return /(^|\/)\*$/.test(routePath) || routePath === '/*' || Number(item?.match?.wildcardCount || 0) > 0;
}

function isFallbackRouteHit(hit) {
  const routePath = String(hit?.routePath || '');
  const file = String(hit?.file || '');
  const reasonText = (hit?.reasons || []).join('\n');
  return /(^|\/)\*$/.test(routePath)
    || routePath === '/*'
    || /(^|\/)(404|not-found)\.(vue|jsx|tsx|js|ts)$/i.test(file)
    || /(^|\/)error-page\//i.test(file)
    || /根组件锚点|app import|入口文件/.test(reasonText);
}

function collectRouteNodes(project, body, pagePath, textCache, activeAdapters, trace) {
  const routes = [];
  for (const adapter of activeAdapters) {
    if (typeof adapter.extractRoutes !== 'function') continue;
    try {
      routes.push(...adapter.extractRoutes({
        project,
        pagePath,
        body,
        textCache,
      }));
    } catch (error) {
      trace.errors.push(`${adapter.key}.extractRoutes: ${error.message || error}`);
    }
  }
  return routes;
}

function routeDeclarationHit(project, routeMatch, pagePath, textCache) {
  const route = routeMatch.route;
  if (!route?.sourceFile) return null;
  return routeHit(project, route.sourceFile, {
    adapter: route.adapter || route.framework || 'route',
    score: Math.max(180, routeMatch.score - 240),
    from: route.sourceFile,
    routePath: route.routePath,
    reasons: [
      ...routeMatch.reasons,
      `页面路径 ${pagePath} 命中路由：${route.routePath}`,
      '未解析到页面组件文件，保留路由声明文件作为候选',
      route.sourceFile ? `路由文件：${route.sourceFile}` : '',
    ],
    textCache,
  });
}

function routeMatchToHit(project, routeMatch, pagePath, textCache) {
  const hit = routeNodeHit(project, routeMatch.route, pagePath, {
    score: routeMatch.score,
    reasons: routeMatch.reasons,
    match: routeMatch.match,
    textCache,
  });
  return hit || routeDeclarationHit(project, routeMatch, pagePath, textCache);
}

function fallbackResolveHits(project, body, pagePath, textCache, activeAdapters, trace) {
  const hits = [];
  for (const adapter of activeAdapters) {
    if (typeof adapter.resolve !== 'function') continue;
    try {
      hits.push(...adapter.resolve({
        project,
        pagePath,
        body,
        textCache,
      }));
    } catch (error) {
      trace.errors.push(`${adapter.key}.resolve: ${error.message || error}`);
    }
  }
  return hits;
}

function resolvePageRouteTrace(project, body, textCache) {
  const pagePath = cleanPagePath(body.url || body.pagePath || body.path || '/');
  const projectKind = project.kind || 'unknown';
  const activeAdapters = adaptersForKind(projectKind);
  const trace = {
    projectKind,
    pagePath,
    adapters: activeAdapters.map(adapter => adapter.key),
    matched: false,
    bestPageFile: '',
    bestRoute: null,
    routeHits: [],
    fallbackFiles: [],
    hits: [],
    errors: [],
  };
  if (!pagePath) return { hits: [], trace };

  const routeNodes = collectRouteNodes(project, body, pagePath, textCache, activeAdapters, trace);
  const allRouteMatches = uniqueRouteMatches(matchRoutes(pagePath, routeNodes));
  const nonFallbackRouteMatches = allRouteMatches.filter(item => !isWildcardRouteMatch(item));
  const exactRouteMatches = nonFallbackRouteMatches.filter(item => item.match?.exact);
  const routeMatches = exactRouteMatches.length ? exactRouteMatches : nonFallbackRouteMatches;
  trace.routeHits = routeMatches.slice(0, 12).map(item => ({
    route: item.route,
    score: item.score,
    reasons: item.reasons,
  }));

  let hits = [];
  if (routeMatches.length) {
    hits = routeMatches
      .map(item => routeMatchToHit(project, item, pagePath, textCache))
      .filter(Boolean);
    const best = routeMatches[0];
    trace.matched = true;
    trace.bestRoute = best.route;
    trace.bestPageFile = best.route.componentFile || '';
  } else {
    hits = fallbackResolveHits(project, body, pagePath, textCache, activeAdapters, trace);
  }

  const resolvedHits = uniqueHits(hits)
    .filter(hit => routeMatches.length || !isFallbackRouteHit(hit))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  trace.matched = trace.matched || resolvedHits.length > 0;
  if (!trace.bestPageFile) trace.bestPageFile = resolvedHits[0]?.file || '';
  if (!routeMatches.length) trace.fallbackFiles = resolvedHits.map(hit => hit.file).slice(0, 20);
  trace.hits = resolvedHits.slice(0, 8).map(hit => ({
    file: hit.file,
    adapter: hit.routeAdapter || '',
    routePath: hit.routePath || '',
    score: hit.score,
    from: hit.from || '',
    reasons: (hit.reasons || []).slice(0, 4),
  }));

  return { hits: resolvedHits, trace };
}

function resolvePageRoute(project, body, textCache) {
  return resolvePageRouteTrace(project, body, textCache).hits;
}

module.exports = {
  adaptersForKind,
  resolvePageRoute,
  resolvePageRouteTrace,
};
