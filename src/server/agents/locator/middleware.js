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
  createRangedReadGuard,
} = require('../../agent-host/agent-finalization');

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
