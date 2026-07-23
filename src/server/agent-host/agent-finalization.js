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

function normalizeGuardPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
}

// 纯行号(120) 或 行区间(120-180 / 120~180 / 120:180) —— 都属于"按位置翻页"，区别于按符号/文案的定向读取。
function isPagingAround(value) {
  return /^\d+(\s*[-~:]\s*\d+)?$/.test(String(value || '').trim());
}

// 重复翻页拦截：同一文件已被 read_file 读过后，再用行号/行区间翻页只会重复扩上下文而不推进。
// 拦下并引导改用 inspect_symbol_occurrences / read_closed_blocks，或直接收敛。按符号/文案的
// 定向 around 不拦（那是精确重读，不是翻页）。locator/planning 共用。
function createRangedReadGuard({ note } = {}) {
  const readFiles = new Set();
  return (toolName, input = {}) => {
    if (toolName !== 'read_file') return null;
    const files = (Array.isArray(input.files) ? input.files : (input.file ? [input.file] : []))
      .map(normalizeGuardPath).filter(Boolean);
    if (isPagingAround(input.around)) {
      const repeated = files.filter(file => readFiles.has(file));
      if (repeated.length) {
        return {
          operation: toolName,
          blocked: true,
          files: repeated,
          requestedRange: String(input.around),
          note: note || '同一文件已读取过，继续按行号翻页只会重复扩大上下文而不推进。请从已读源码中挑待验证的标识符/文案，用 inspect_symbol_occurrences 或 read_closed_blocks 定向读取；若信息已够，直接收敛输出结论/计划。',
        };
      }
    }
    for (const file of files) readFiles.add(file);
    return null;
  };
}

module.exports = {
  createBudget,
  createFinalizationMiddleware,
  composeToolGuards,
  createForceFinishGuard,
  createRangedReadGuard,
};
