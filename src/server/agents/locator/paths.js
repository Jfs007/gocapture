'use strict';

// 归一化项目内相对路径：去反斜杠、去开头 ./ 与 /。
function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
}

module.exports = { normalizePath };
