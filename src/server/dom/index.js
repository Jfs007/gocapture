'use strict';

// DOM 领域公共入口：选区解析 / 压缩 / 调试摘要。locator、planner 及入口层都从这里取，
// 不直接依赖子模块。
const { plannerDomInput } = require('./selection');
const { compressDomMarkup } = require('./compressor');
const { domContextDebugSummary } = require('./debug');

module.exports = {
  plannerDomInput,
  compressDomMarkup,
  domContextDebugSummary,
};
