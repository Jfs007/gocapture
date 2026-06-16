const { fileConventionHits } = require('../utils');

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: 'react-webpack',
    score: 370,
    roots: ['src/pages', 'src/views', 'src/containers', 'src/screens', 'pages', 'views', 'containers', 'screens'],
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
    reason: 'React Webpack 常见 pages/views/containers/screens 文件约定',
    textCache,
  });
}

module.exports = {
  key: 'react-webpack',
  kinds: ['react-webpack'],
  resolve,
};
