const { fileConventionHits, fileConventionRouteNodes } = require('../utils');

const options = {
  adapter: 'vue-webpack',
  framework: 'vue',
  roots: ['src/views', 'src/pages', 'src/modules', 'views', 'pages', 'modules'],
  extensions: ['.vue', '.js', '.ts'],
};

function extractRoutes({ project }) {
  return fileConventionRouteNodes(project, options);
}

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: options.adapter,
    score: 390,
    roots: options.roots,
    extensions: options.extensions,
    reason: 'Vue Webpack 常见 views/pages/modules 文件约定',
    textCache,
  });
}

module.exports = {
  key: 'vue-webpack',
  kinds: ['vue-webpack'],
  extractRoutes,
  resolve,
};
