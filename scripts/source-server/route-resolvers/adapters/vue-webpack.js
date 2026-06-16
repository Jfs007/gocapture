const { fileConventionHits } = require('../utils');

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: 'vue-webpack',
    score: 390,
    roots: ['src/views', 'src/pages', 'src/modules', 'views', 'pages', 'modules'],
    extensions: ['.vue', '.js', '.ts'],
    reason: 'Vue Webpack 常见 views/pages/modules 文件约定',
    textCache,
  });
}

module.exports = {
  key: 'vue-webpack',
  kinds: ['vue-webpack'],
  resolve,
};
