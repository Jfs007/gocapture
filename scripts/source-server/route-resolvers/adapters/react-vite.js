const { fileConventionHits } = require('../utils');

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: 'react-vite',
    score: 390,
    roots: ['src/pages', 'src/views', 'src/routes', 'pages', 'views', 'routes'],
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
    reason: 'React Vite 常见 pages/views/routes 文件约定',
    textCache,
  });
}

module.exports = {
  key: 'react-vite',
  kinds: ['react-vite'],
  resolve,
};
