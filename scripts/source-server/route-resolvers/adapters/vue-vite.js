const { fileConventionHits, fileConventionRouteNodes } = require('../utils');

const options = {
  adapter: 'vue-vite',
  framework: 'vue',
  roots: ['src/pages', 'src/views', 'src/routes', 'pages', 'views', 'routes'],
  extensions: ['.vue', '.tsx', '.jsx', '.ts', '.js'],
};

function extractRoutes({ project }) {
  return fileConventionRouteNodes(project, options);
}

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: options.adapter,
    score: 410,
    roots: options.roots,
    extensions: options.extensions,
    reason: 'Vue Vite 常见 pages/views/routes 文件约定',
    textCache,
  });
}

module.exports = {
  key: 'vue-vite',
  kinds: ['vue-vite'],
  extractRoutes,
  resolve,
};
