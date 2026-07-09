const { fileConventionHits, fileConventionRouteNodes } = require('../utils');

const options = {
  adapter: 'next',
  framework: 'next',
  roots: ['app', 'src/app', 'pages', 'src/pages'],
  extensions: ['.tsx', '.jsx', '.ts', '.js'],
};

function extractRoutes({ project }) {
  return fileConventionRouteNodes(project, options);
}

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: options.adapter,
    score: 540,
    roots: options.roots,
    extensions: options.extensions,
    reason: 'Next.js app/pages 文件系统路由',
    textCache,
  });
}

module.exports = {
  key: 'next',
  kinds: ['next'],
  extractRoutes,
  resolve,
};
