const { fileConventionHits } = require('../utils');

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: 'unknown',
    score: 260,
    roots: ['src/pages', 'src/views', 'pages', 'views'],
    extensions: ['.vue', '.tsx', '.jsx', '.ts', '.js'],
    reason: '未知框架兜底 pages/views 文件约定',
    textCache,
  });
}

module.exports = {
  key: 'unknown',
  kinds: ['unknown', 'vue', 'vue-vite', 'vue-webpack', 'react-vite', 'react-webpack'],
  resolve,
};
