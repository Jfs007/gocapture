const PORT = Number(process.env.MAGNUS_SOURCE_PORT || 17321);
const HOST = process.env.MAGNUS_SOURCE_HOST || '127.0.0.1';
const MAX_FILES = Number(process.env.MAGNUS_SOURCE_MAX_FILES || 5000);
const MAX_SNIPPET_BYTES = 180000;
const MAX_SNIPPET_CHARS = 3000;
const VERSION = '0.1.0';

const SKIP_DIRS = new Set([
  '.git',
  '.idea',
  '.vscode',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.cache',
  '.claude',
  '.codex',
  '.DS_Store',
  '.magnus',
  '.magnus-project',
  'target',
  'vendor',
]);

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.go',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.less',
  '.mjs',
  '.php',
  '.py',
  '.rb',
  '.rs',
  '.scss',
  '.ts',
  '.tsx',
  '.vue',
  '.xml',
  '.yaml',
  '.yml',
]);

const KEY_FILES = new Set([
  'package.json',
  'vite.config.js',
  'vite.config.ts',
  'vue.config.js',
  'webpack.config.js',
  'next.config.js',
  'nuxt.config.js',
  'src/main.js',
  'src/main.ts',
  'src/App.vue',
  'index.html',
]);

const STOP_TOKENS = new Set([
  'id',
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'true',
  'false',
  'null',
  'undefined',
  'data',
  'list',
  'page',
  'size',
  'total',
  'result',
  'items',
  'item',
  'code',
  'msg',
  'message',
  '请求',
  '响应',
  '数据',
  '测试',
]);

const GENERIC_SYMBOLS = new Set([
  'api',
  'app',
  'config',
  'data',
  'fetch',
  'http',
  'index',
  'item',
  'list',
  'params',
  'request',
  'response',
  'result',
  'service',
  'state',
  'store',
]);

const COMMON_PATH_PREFIXES = new Set([
  'api',
  'apis',
  'gateway',
  'openapi',
  'v1',
  'v2',
  'v3',
]);

module.exports = {
  COMMON_PATH_PREFIXES,
  GENERIC_SYMBOLS,
  HOST,
  KEY_FILES,
  MAX_FILES,
  MAX_SNIPPET_BYTES,
  MAX_SNIPPET_CHARS,
  PORT,
  SKIP_DIRS,
  STOP_TOKENS,
  TEXT_EXTENSIONS,
  VERSION,
};
