const { fileConventionHits } = require('../utils');

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: 'umi',
    score: 520,
    roots: ['src/pages', 'pages'],
    extensions: ['.tsx', '.jsx', '.ts', '.js', '.vue'],
    reason: 'Umi pages 文件系统路由',
    textCache,
  });
}

module.exports = {
  key: 'umi',
  kinds: ['umi'],
  resolve,
};
