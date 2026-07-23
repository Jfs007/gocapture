'use strict';

const { loadLangChainRuntime } = require('./langchain/runtime');

// 各角色（locator / planning / 未来 execute）共用的"收尾"原语：
// - budget：模型调用预算，到点置 forceFinish
// - 强制收尾中间件：到点把请求改写成"只能收尾"（留 finish 工具 / 清空工具，由角色决定）
// - force-finish 硬拦：forceFinish 后，非收尾工具直接被拦（执行层，弱模型广告层拦不住）
// - guard 组合：把多个 guard 串起来，先命中先返回
// 角色差异只体现在 finalizeRequest（怎么收尾）、isFinishTool（谁是收尾工具）、以及各自的兜底器。

function createBudget(maxTurns, { forceFinishOffset = 3 } = {}) {
  const turns = Number(maxTurns) || 0;
  return {
    modelCalls: 0,
    forceFinishAt: Math.max(2, turns - forceFinishOffset),
    forceFinish: false,
  };
}

function createFinalizationMiddleware(budget, { name = 'AgentFinalizationBudget', finalizeRequest } = {}) {
  const runtime = loadLangChainRuntime();
  if (!runtime.available || typeof runtime.createMiddleware !== 'function') return null;
  return runtime.createMiddleware({
    name,
    wrapModelCall: async (request, handler) => {
      budget.modelCalls += 1;
      if (budget.modelCalls < budget.forceFinishAt) return handler(request);
      budget.forceFinish = true; // force-finish guard 据此硬拦
      return handler(typeof finalizeRequest === 'function' ? finalizeRequest(request) : request);
    },
  });
}

function composeToolGuards(...guards) {
  const active = guards.filter(guard => typeof guard === 'function');
  if (!active.length) return null;
  return (toolName, input) => {
    for (const guard of active) {
      const result = guard(toolName, input);
      if (result) return result;
    }
    return null;
  };
}

function createForceFinishGuard(budget, { isFinishTool = () => false, note } = {}) {
  return toolName => {
    if (budget.forceFinish && !isFinishTool(toolName)) {
      return {
        operation: toolName,
        blocked: true,
        note: note || '调查预算已用尽：请立即基于已有证据提交结论，不要再调用工具。',
      };
    }
    return null;
  };
}

module.exports = {
  createBudget,
  createFinalizationMiddleware,
  composeToolGuards,
  createForceFinishGuard,
};
