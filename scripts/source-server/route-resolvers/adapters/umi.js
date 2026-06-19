const { fileConventionHits, fileConventionRouteNodes } = require('../utils');

const options = {
  adapter: 'umi',
  framework: 'umi',
  roots: ['src/pages', 'pages'],
  extensions: ['.tsx', '.jsx', '.ts', '.js', '.vue'],
};

function extractRoutes({ project }) {
  return fileConventionRouteNodes(project, options);
}

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: options.adapter,
    score: 520,
    roots: options.roots,
    extensions: options.extensions,
    reason: 'Umi pages 文件系统路由',
    textCache,
  });
}

module.exports = {
  key: 'umi',
  kinds: ['umi'],
  extractRoutes,
  resolve,
};
