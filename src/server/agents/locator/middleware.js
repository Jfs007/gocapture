'use strict';

// Locator 专属中间件与工具拦截：
// - finalization：预算到顶时只留 finish_dom_location，逼模型交卷。
// - contextWindow：约 28000 tokens 后清理较早工具正文，保留最近 6 条。
// - toolGuard：force-finish 硬拦 + read_file 行区间翻页拦截。
// 通用机制复用 agent-host/agent-finalization，本文件只放 locator 特有配置。
const { loadLangChainRuntime } = require('../../agent-host/langchain/runtime');
const {
  createFinalizationMiddleware: createSharedFinalizationMiddleware,
  composeToolGuards,
  createForceFinishGuard,
} = require('../../agent-host/agent-finalization');
const { normalizePath } = require('./paths');

function isFinishTool(toolName) {
  return toolName === 'finish_dom_location';
}

function createFinalizationMiddleware(budget) {
  return createSharedFinalizationMiddleware(budget, {
    name: 'DomLocatorFinalizationBudget',
    finalizeRequest: request => ({
      ...request,
      tools: (request.tools || []).filter(tool => isFinishTool(tool?.name)),
      systemPrompt: [
        request.systemPrompt || '',
        '本轮已到调查预算上限。只能调用 finish_dom_location：证据充分则 resolved；DOM 证据不足则 need-more-context；仍缺源码关系则 unresolved。不要继续检索，不要用普通文本结束。',
      ].filter(Boolean).join('\n'),
    }),
  });
}

function createDomLocatorContextMiddleware() {
  const runtime = loadLangChainRuntime();
  if (typeof runtime.contextEditingMiddleware !== 'function' || typeof runtime.ClearToolUsesEdit !== 'function') {
    return null;
  }
  return runtime.contextEditingMiddleware({
    edits: [new runtime.ClearToolUsesEdit({
      trigger: { tokens: 28000 },
      keep: { messages: 6 },
      clearToolInputs: false,
      placeholder: '[较早工具正文已由 DOM Locator 上下文策略清理；初始候选事实和最近工具结果仍保留。如结论依赖被清理证据，请围绕已知文件与符号精确重读。]',
    })],
  });
}

function isExplicitLineRange(value) {
  return /^\d+\s*[-~:]\s*\d+$/.test(String(value || '').trim());
}

// read_file 行区间翻页拦截：同一文件重复补读会重复扩大上下文，引导改用 inspect_symbol_occurrences。
function createRangedReadGuard() {
  const rangedReads = new Map();
  return (toolName, input = {}) => {
    if (toolName !== 'read_file' || !isExplicitLineRange(input.around)) return null;
    const files = (Array.isArray(input.files) ? input.files : []).map(normalizePath).filter(Boolean);
    const repeatedFiles = files.filter(file => rangedReads.has(file));
    if (repeatedFiles.length) {
      return {
        operation: toolName,
        blocked: true,
        files: repeatedFiles,
        requestedRange: String(input.around),
        previousRanges: repeatedFiles.map(file => ({ file, range: rangedReads.get(file) })),
        note: '同一文件已进行过行区间补读，继续翻页会重复扩大上下文。请从已有源码中选择待验证标识符，调用 inspect_symbol_occurrences 一次收集全部出现位置；若缺失事实不是标识符关系，请改用明确 terms 或 read_closed_blocks。',
      };
    }
    for (const file of files) rangedReads.set(file, String(input.around));
    return null;
  };
}

function createDomLocatorToolGuard(budget) {
  return composeToolGuards(
    createForceFinishGuard(budget, {
      isFinishTool,
      note: '调查预算已用尽：只能调用 finish_dom_location 交卷。请立刻基于已有证据与锚点交集候选提交结论，不要再检索或读取。',
    }),
    createRangedReadGuard(),
  );
}

module.exports = {
  createFinalizationMiddleware,
  createDomLocatorContextMiddleware,
  createDomLocatorToolGuard,
};
