const { cleanPagePath } = require('./utils');
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

function resolvePageRouteTrace(project, body, textCache) {
  const pagePath = cleanPagePath(body.url || body.pagePath || body.path || '/');
  const projectKind = project.kind || 'unknown';
  const activeAdapters = adaptersForKind(projectKind);
  const trace = {
    projectKind,
    pagePath,
    adapters: activeAdapters.map(adapter => adapter.key),
    matched: false,
    hits: [],
    errors: [],
  };
  if (!pagePath) return { hits: [], trace };

  const hits = [];
  for (const adapter of activeAdapters) {
    try {
      hits.push(...adapter.resolve({
        project,
        pagePath,
        body,
        textCache,
      }));
    } catch (error) {
      trace.errors.push(`${adapter.key}: ${error.message || error}`);
    }
  }

  const resolvedHits = uniqueHits(hits)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  trace.matched = resolvedHits.length > 0;
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
