const { fileConventionHits, fileConventionRouteNodes } = require('../utils');

const options = {
  adapter: 'react-vite',
  framework: 'react',
  roots: ['src/pages', 'src/views', 'src/routes', 'pages', 'views', 'routes'],
  extensions: ['.tsx', '.jsx', '.ts', '.js'],
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
    reason: 'React Vite 常见 pages/views/routes 文件约定',
    textCache,
  });
}

module.exports = {
  key: 'react-vite',
  kinds: ['react-vite'],
  extractRoutes,
  resolve,
};
