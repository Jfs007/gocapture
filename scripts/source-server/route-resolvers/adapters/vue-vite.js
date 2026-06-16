const { fileConventionHits } = require('../utils');

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: 'vue-vite',
    score: 410,
    roots: ['src/pages', 'src/views', 'src/routes', 'pages', 'views', 'routes'],
    extensions: ['.vue', '.tsx', '.jsx', '.ts', '.js'],
    reason: 'Vue Vite 常见 pages/views/routes 文件约定',
    textCache,
  });
}

module.exports = {
  key: 'vue-vite',
  kinds: ['vue-vite'],
  resolve,
};
