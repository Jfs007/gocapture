const { fileConventionHits, fileConventionRouteNodes } = require('../utils');

const options = {
  adapter: 'react-webpack',
  framework: 'react',
  roots: ['src/pages', 'src/views', 'src/containers', 'src/screens', 'pages', 'views', 'containers', 'screens'],
  extensions: ['.tsx', '.jsx', '.ts', '.js'],
};

function extractRoutes({ project }) {
  return fileConventionRouteNodes(project, options);
}

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: options.adapter,
    score: 370,
    roots: options.roots,
    extensions: options.extensions,
    reason: 'React Webpack 常见 pages/views/containers/screens 文件约定',
    textCache,
  });
}

module.exports = {
  key: 'react-webpack',
  kinds: ['react-webpack'],
  extractRoutes,
  resolve,
};
