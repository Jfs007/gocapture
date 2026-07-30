'use strict';

const crypto = require('crypto');
const { compressDomMarkup } = require('../../dom');

const ACCEPT_SELECTION_EVIDENCE = 'accept_selection_evidence';
const EXPAND_SELECTION_CONTEXT = 'expand_selection_context';
const DEFAULT_MAX_CALLS = 5;
// 扩区结果回传给 Agent 前压缩/去重并封顶：浏览器可能回传很大的 DOM，
// 未压缩会撞破 Agent 工具结果上限、被转存文件，逼模型反复读文件浪费大量轮次。
const MAX_EXPAND_MARKUP_CHARS = 30000;

// 扩区 markup 封顶。选区元数据已在前端剔除，正常扩区的 markup 很小（几 KB），
// 直接原样透传——绝不能去重同构兄弟：表格各列结构相同但内容不同，
// 折叠会把"目标到底在哪一列"的辨识信息抹掉，逼模型反复再扩区。
// 仅当 markup 过大（深层容器/超长列表扩区）才用 compressDomMarkup 折叠兜底、避免撑爆工具结果上限。
function shapeExpandResult(result) {
  if (!result || typeof result !== 'object') return result;
  const raw = String(result.expandedMarkup || '');
  if (!raw || raw.length <= MAX_EXPAND_MARKUP_CHARS) return result;
  const compressed = compressDomMarkup(raw);
  return {
    ...result,
    expandedMarkup: String(compressed.markup || raw).slice(0, MAX_EXPAND_MARKUP_CHARS),
  };
}

// 每一轮扩区后，把「实际喂给 Agent 的定位 DOM」写进日志：含原始选区标记状态 + 内容（截断展示）。
const MAX_FEED_LOG_CHARS = 4000;
function describeExpandFeed(call, shaped) {
  const selectionId = call?.input?.selectionId || '';
  const markup = String(shaped?.expandedMarkup || '');
  const shown = markup.length > MAX_FEED_LOG_CHARS
    ? `${markup.slice(0, MAX_FEED_LOG_CHARS)}\n…（已截断，共 ${markup.length} 字符）`
    : markup;
  return [
    `选区 ${selectionId} 扩区完成（第 ${call?.attempt || 1} 次），已把下方定位 DOM 返回 Agent`,
    `原始选区标记：${shaped?.markerEmbedded
      ? '已用 <gocapture-original-selection> 包裹（防止 Agent 把相邻兄弟当成选区去定位）'
      : '未匹配到原始选区，未标记'}`,
    '喂入 Agent 的定位 DOM：',
    shown || '（空）',
  ].join('\n');
}

const AGENT_TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: ACCEPT_SELECTION_EVIDENCE,
    description: [
      'Accept the currently supplied DOM evidence for one selection before starting source',
      'investigation. Call this only when the current DOM contains enough concrete structure,',
      'text, or attributes to verify its source. This records the Agent decision; GoCapture',
      'does not decide evidence sufficiency.',
    ].join(' '),
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: ['selectionId', 'reason'],
      properties: {
        selectionId: {
          type: 'string',
          description: 'A selection ID explicitly referenced by the current task.',
        },
        reason: {
          type: 'string',
          description: 'Why the current DOM is sufficient for a focused source investigation.',
        },
      },
    }),
  }),
  Object.freeze({
    name: EXPAND_SELECTION_CONTEXT,
    description: [
      'Expand one currently referenced browser DOM selection when its existing evidence is',
      'insufficient to locate the source. Use only after the current selection evidence has',
      'been inspected and the missing surrounding DOM prevents progress. Expansion only adds',
      'context: the modification target remains targetSelection and never becomes its parent',
      'or surrounding expandedContext.',
    ].join(' '),
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: ['selectionId', 'reason'],
      properties: {
        selectionId: {
          type: 'string',
          description: 'A selection ID explicitly referenced by the current task.',
        },
        reason: {
          type: 'string',
          description: 'The concrete evidence missing from the current DOM selection.',
        },
      },
    }),
  }),
]);

class AgentToolSession {
  constructor({
    taskId,
    allowedSelectionIds = [],
    evidenceGateSelectionIds = [],
    onEvent = () => {},
    maxCalls = DEFAULT_MAX_CALLS,
    extensions = null,
  } = {}) {
    this.taskId = String(taskId || '');
    this.allowedSelectionIds = new Set(
      allowedSelectionIds.map(value => String(value || '').trim()).filter(Boolean),
    );
    this.evidenceGate = new Map(
      evidenceGateSelectionIds
        .map(value => String(value || '').trim())
        .filter(value => value && this.allowedSelectionIds.has(value))
        .map(value => [value, 'pending']),
    );
    this.onEvent = onEvent;
    this.maxCalls = Math.max(1, Number(maxCalls) || DEFAULT_MAX_CALLS);
    this.callCount = 0;
    this.pending = new Map();
    this.closed = false;
    this.extensions = extensions;
  }

  definitions() {
    return [
      ...(this.evidenceGate.size ? AGENT_TOOL_DEFINITIONS : (
        this.allowedSelectionIds.size ? [AGENT_TOOL_DEFINITIONS[1]] : []
      )),
      ...(Array.isArray(this.extensions?.definitions) ? this.extensions.definitions : []),
    ];
  }

  pendingEvidenceSelectionIds() {
    return [...this.evidenceGate.entries()]
      .filter(([, status]) => status !== 'accepted')
      .map(([selectionId]) => selectionId);
  }

  evidenceGatePending() {
    return this.pendingEvidenceSelectionIds().length > 0;
  }

  nativeToolDenial(toolName) {
    if (!this.evidenceGatePending()) return '';
    const normalized = String(toolName || '').replace(/^mcp__gocapture__/, '');
    if (
      normalized === ACCEPT_SELECTION_EVIDENCE
      || normalized === EXPAND_SELECTION_CONTEXT
      || normalized === 'AskUserQuestion'
    ) {
      return '';
    }
    return [
      '当前 DOM 证据尚未经过 Evidence Gate。',
      `请先对 ${this.pendingEvidenceSelectionIds().join('、')} 调用`,
      `${ACCEPT_SELECTION_EVIDENCE} 或 ${EXPAND_SELECTION_CONTEXT}，`,
      '再使用源码调查工具。',
    ].join(' ');
  }

  async request(name, input = {}, signal) {
    if (this.closed) return Promise.reject(new Error('Agent 本地工具会话已结束'));
    const toolName = String(name || '').trim();
    if (toolName === ACCEPT_SELECTION_EVIDENCE) {
      const selectionId = String(input.selectionId || '').trim();
      if (!this.evidenceGate.has(selectionId)) {
        return Promise.reject(new Error('该选区不需要 Evidence Gate 或不属于本轮任务'));
      }
      this.evidenceGate.set(selectionId, 'accepted');
      const result = {
        accepted: true,
        selectionId,
        pendingSelectionIds: this.pendingEvidenceSelectionIds(),
      };
      this.onEvent({
        type: 'agent-evidence-accepted',
        capability: {
          taskId: this.taskId,
          name: toolName,
          input: {
            selectionId,
            reason: String(input.reason || '').trim(),
          },
        },
        message: `Agent 已接受选区 ${selectionId} 的当前 DOM 证据`,
      });
      return result;
    }
    if (this.evidenceGatePending() && toolName !== EXPAND_SELECTION_CONTEXT) {
      return Promise.reject(new Error(this.nativeToolDenial(toolName)));
    }
    if (this.extensions?.has?.(toolName)) {
      this.onEvent({
        type: 'agent-extension-started',
        capability: {
          taskId: this.taskId,
          name: toolName,
          input,
        },
        message: `Agent 调用项目扩展：${toolName}`,
      });
      try {
        const result = await this.extensions.invoke(toolName, input);
        this.onEvent({
          type: 'agent-extension-completed',
          capability: {
            taskId: this.taskId,
            name: toolName,
            input,
          },
          message: `Agent 项目扩展已完成：${toolName}`,
        });
        return result;
      } catch (error) {
        this.onEvent({
          type: 'agent-extension-failed',
          capability: {
            taskId: this.taskId,
            name: toolName,
            input,
          },
          message: `Agent 项目扩展失败：${toolName} · ${error.message || error}`,
        });
        throw error;
      }
    }
    if (toolName !== EXPAND_SELECTION_CONTEXT) {
      return Promise.reject(new Error(`不支持的 Agent 本地工具：${toolName}`));
    }
    const selectionId = String(input.selectionId || '').trim();
    if (!this.allowedSelectionIds.has(selectionId)) {
      return Promise.reject(new Error('只能扩大本轮明确引用的选区'));
    }
    if (this.callCount >= this.maxCalls) {
      return Promise.reject(new Error(`选区扩区已达到本轮上限（${this.maxCalls} 次）`));
    }
    this.callCount += 1;
    const callId = `tool_${crypto.randomUUID().replace(/-/g, '')}`;
    const call = {
      callId,
      taskId: this.taskId,
      name: toolName,
      input: {
        selectionId,
        reason: String(input.reason || '').trim(),
      },
      attempt: this.callCount,
    };
    this.onEvent({
      type: 'agent-tool-required',
      capability: call,
      message: [
        `Agent 判定当前 DOM 为弱线索、不足以定位源码，请求扩区 ${selectionId}（第 ${this.callCount} 次）`,
        `理由：${call.input.reason || '当前证据不足'}`,
      ].join('\n'),
    });
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.pending.delete(callId);
        reject(new Error('Agent 本地工具调用已取消'));
      };
      this.pending.set(callId, {
        call,
        resolve: value => {
          signal?.removeEventListener?.('abort', abort);
          resolve(value);
        },
        reject: error => {
          signal?.removeEventListener?.('abort', abort);
          reject(error);
        },
      });
      signal?.addEventListener?.('abort', abort, { once: true });
    });
  }

  respond(callId, result) {
    const pending = this.pending.get(String(callId || ''));
    if (!pending) throw new Error('该 Agent 本地工具调用已结束或不存在');
    this.pending.delete(pending.call.callId);
    const isExpand = pending.call.name === EXPAND_SELECTION_CONTEXT;
    const shaped = isExpand ? shapeExpandResult(result) : result;
    pending.resolve(shaped);
    this.onEvent({
      type: 'agent-tool-resolved',
      capability: pending.call,
      message: isExpand
        ? describeExpandFeed(pending.call, shaped)
        : `选区 ${pending.call.input.selectionId} 已扩大，Agent 继续调查`,
    });
    return {
      taskId: this.taskId,
      callId: pending.call.callId,
      status: 'running',
    };
  }

  close(error = new Error('Agent 本地工具会话已结束')) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

module.exports = {
  ACCEPT_SELECTION_EVIDENCE,
  AGENT_TOOL_DEFINITIONS,
  AgentToolSession,
  EXPAND_SELECTION_CONTEXT,
};
