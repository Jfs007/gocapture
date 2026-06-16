const { fileConventionHits } = require('../utils');

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: 'nuxt',
    score: 530,
    roots: ['pages', 'src/pages'],
    extensions: ['.vue', '.ts', '.js'],
    reason: 'Nuxt pages 文件系统路由',
    textCache,
  });
}

module.exports = {
  key: 'nuxt',
  kinds: ['nuxt'],
  resolve,
};
