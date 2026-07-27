'use strict';

// Planner 专属的范围门控与经验窗口：
// - 默认只露"精读已定位文件 + skills"，研究/检索/MCP 工具隐藏，模型 expand_scope(reason) 后一次性放开。
// - 经验窗口：仅首轮可用 Recon/Experience tools，之后只消费首轮经验事实。
const { createMiddleware, tool, ToolMessage } = require('langchain');
const { z } = require('zod');
const { loadLangChainRuntime } = require('../../agent-host/langchain/runtime');

// 上下文裁剪：约 22000 tokens 后清理较早读取的源码正文，保留最近工具结果与首轮已定位/预读证据。
// 没有它，planner 每轮 read_file 正文无限累积，请求体越来越大 → 越来越慢（locator 早有对应策略）。
function createPlanningContextMiddleware() {
  const runtime = loadLangChainRuntime();
  if (typeof runtime.contextEditingMiddleware !== 'function' || typeof runtime.ClearToolUsesEdit !== 'function') {
    return null;
  }
  return runtime.contextEditingMiddleware({
    edits: [new runtime.ClearToolUsesEdit({
      trigger: { tokens: 22000 },
      keep: { messages: 6 },
      clearToolInputs: false,
      placeholder: '[较早读取的源码正文已由 Planning 上下文策略清理；首轮已定位/预读证据与最近工具结果仍保留。需要时按文件+符号定向重读。]',
    })],
  });
}

const PLANNING_EXPERIENCE_TOOLS = new Set(['recon_inspect', 'recon_search']);
// responseFormat(toolStrategy) 的合成"交计划"工具名 = plan.js schema 的 meta.title。
// 它是 planning 的收尾机制，绝不能被门控隐藏或被收尾清掉，否则模型无法输出计划。
const STRUCTURED_OUTPUT_TOOL = 'gocapture_change_plan';

// "研究/广度"类工具：找相似实现、跨文件检索、项目知识。默认(local)关闭，避免琐碎改动过度研究；
// 仅当需求明确需要跨文件一致性(project-wide)时才放开。读取已定位文件的精确工具(read_file/
// read_closed_blocks/inspect_symbol_occurrences)不在此列，始终可用。
const PLANNING_RESEARCH_TOOLS = new Set([
  'search_text', 'search_source_evidence', 'find_files', 'find_symbol',
  'find_imports', 'find_importers', 'trace_file_evidence_flow',
  'find_related_examples', 'consult_project_knowledge', 'recon_inspect', 'recon_search',
]);

// 改动范围不用关键词预判、也不预设能力分类：默认只给"精读已定位文件 + skills"，
// 研究检索类工具和 MCP/动态工具默认隐藏；模型 expand_scope(reason) 后一次性全部放开。
function isToolGated(name, { escalation, researchTools, builtinToolNames }) {
  if (name === 'expand_scope') return false; // 升级入口，始终可用
  if (name === STRUCTURED_OUTPUT_TOOL) return false; // 结构化收尾工具，始终可用（否则模型没法交计划）
  if (escalation.expanded) return false; // 升级后全部放开
  if (researchTools.has(name)) return true; // 研究/检索类，默认隐藏
  if (!builtinToolNames.has(name)) return true; // 非内建 = MCP/动态工具，默认隐藏
  return false; // 精读已定位文件的内建工具 + skills，始终可用
}

// expand_scope 工具：模型确需超出"已定位文件"去调查时显式申请（带理由），一次性放开其余能力。
function createExpandScopeTool(escalation, log = () => {}) {
  return tool(
    async ({ reason }) => {
      escalation.expanded = true;
      log(`Planning Agent 范围升级：${String(reason || '').slice(0, 160)}`);
      return JSON.stringify({ ok: true, expanded: true });
    },
    {
      name: 'expand_scope',
      description: '当基于已定位源码无法形成计划、确需超出已定位文件去调查时调用（例如需核实项目里是否有需同步修改的相似实现，或需要检索、外部库/文档等其它能力）。必须给出具体 reason。局部/机械改动不要调用。',
      schema: z.object({ reason: z.string() }),
    }
  );
}

// 范围门控中间件：wrapModelCall 隐藏被门控工具（广告层），wrapToolCall 拦其执行（执行层）。
function createScopeGateMiddleware(escalation, { researchTools, builtinToolNames }) {
  const gated = name => isToolGated(name, { escalation, researchTools, builtinToolNames });
  return createMiddleware({
    name: 'PlanningScopeGate',
    wrapModelCall: async (request, handler) =>
      handler({ ...request, tools: (request.tools || []).filter(toolItem => !gated(toolItem?.name || '')) }),
    wrapToolCall: async (request, handler) => {
      const name = request.tool?.name || '';
      if (gated(name)) {
        return new ToolMessage({
          content: JSON.stringify({
            blocked: true,
            note: `工具 ${name} 属于扩大范围能力，需先调用 expand_scope(reason) 申请。局部改动请直接基于已定位源码产出计划。`,
          }),
          tool_call_id: request.toolCall?.id || '',
        });
      }
      return handler(request);
    },
  });
}

function createPlanningExperienceWindowMiddleware(log = () => {}) {
  let modelCalls = 0;
  let closedLogged = false;
  return createMiddleware({
    name: 'PlanningExperienceWindow',
    wrapModelCall: async (request, handler) => {
      modelCalls += 1;
      if (modelCalls === 1) return handler(request);
      const tools = (Array.isArray(request.tools) ? request.tools : [])
        .filter(tool => !PLANNING_EXPERIENCE_TOOLS.has(String(tool?.name || '')));
      if (!closedLogged) {
        closedLogged = true;
        log('Planning Agent 经验窗口已关闭：后续仅消费首轮经验事实，不再调用 Recon/Experience tools');
      }
      return handler({ ...request, tools });
    },
  });
}

module.exports = {
  PLANNING_EXPERIENCE_TOOLS,
  PLANNING_RESEARCH_TOOLS,
  STRUCTURED_OUTPUT_TOOL,
  isToolGated,
  createExpandScopeTool,
  createScopeGateMiddleware,
  createPlanningExperienceWindowMiddleware,
  createPlanningContextMiddleware,
};
