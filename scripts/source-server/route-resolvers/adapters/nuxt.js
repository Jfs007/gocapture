const { fileConventionHits, fileConventionRouteNodes } = require('../utils');

const options = {
  adapter: 'nuxt',
  framework: 'nuxt',
  roots: ['pages', 'src/pages'],
  extensions: ['.vue', '.ts', '.js'],
};

function extractRoutes({ project }) {
  return fileConventionRouteNodes(project, options);
}

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: options.adapter,
    score: 530,
    roots: options.roots,
    extensions: options.extensions,
    reason: 'Nuxt pages 文件系统路由',
    textCache,
  });
}

module.exports = {
  key: 'nuxt',
  kinds: ['nuxt'],
  extractRoutes,
  resolve,
};
