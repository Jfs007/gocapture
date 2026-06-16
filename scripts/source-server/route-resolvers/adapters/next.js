const { fileConventionHits } = require('../utils');

function resolve({ project, pagePath, textCache }) {
  return fileConventionHits(project, pagePath, {
    adapter: 'next',
    score: 540,
    roots: ['app', 'src/app', 'pages', 'src/pages'],
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
    reason: 'Next.js app/pages 文件系统路由',
    textCache,
  });
}

module.exports = {
  key: 'next',
  kinds: ['next'],
  resolve,
};
