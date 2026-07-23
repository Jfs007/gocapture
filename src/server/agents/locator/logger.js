'use strict';

// Locator 事件日志器：把 runAgentTask 的事件流翻译成人读日志，并顺带跨轮累计
// search_source_evidence 的交集证据（撞限/未收敛时用于兜底裁决）。
// 把庞大的 onEvent switch 从编排里剥离，让 index 只做装配。
function compactEventValue(value, maxChars = 12000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...（已裁剪 ${text.length - maxChars} 字符）`;
}

function modelInputMessageSummary(messages, previewChars = 320) {
  return (Array.isArray(messages) ? messages : []).map((message, index) => {
    const content = String(message?.content || '');
    const toolCalls = (Array.isArray(message?.tool_calls) ? message.tool_calls : []).map(call => ({
      id: String(call?.id || ''),
      tool: String(call?.function?.name || ''),
      input: String(call?.function?.arguments || ''),
    }));
    return {
      index,
      role: String(message?.role || 'unknown'),
      chars: content.length,
      content: content.length <= previewChars ? content : `${content.slice(0, previewChars)}\n...（本条省略 ${content.length - previewChars} 字符；完整事实见此前对应的输入或工具结果节点）`,
      ...(message?.tool_call_id ? { toolCallId: String(message.tool_call_id) } : {}),
      ...(toolCalls.length ? { toolCalls } : {}),
    };
  });
}

function createLocatorLogger(onLog = () => {}) {
  let modelRound = 0;
  const evidenceCandidates = new Map(); // file -> max matchedAnchorCount，跨轮累计，用于兜底

  const onEvent = event => {
    if (event.type === 'llm.log') {
      onLog(`DOM Locator Agent 第 ${Math.max(1, modelRound)} 轮 ${event.log}`);
    }
    if (event.type === 'llm.input') {
      modelRound += 1;
      const toolNames = (event.toolNames || []).join('、') || '-';
      onLog(`DOM Locator Agent 第 ${modelRound} 轮模型输入：messages=${(event.messages || []).length}；tools=${event.toolCount || 0}；toolNames=${toolNames}`);
      onLog(`DOM Locator Agent 第 ${modelRound} 轮模型输入上下文：\n${compactEventValue(modelInputMessageSummary(event.messages), 16000)}`);
    }
    if (event.type === 'llm.output') {
      const rawText = String(event.rawText || '').trim();
      onLog(`DOM Locator Agent 第 ${modelRound} 轮模型输出：tool_calls=${(event.toolCalls || []).length}；text=${rawText.length} 字符`);
      if (rawText) {
        onLog(`DOM Locator Agent 第 ${modelRound} 轮模型输出正文：\n${compactEventValue(rawText, 3000)}`);
      }
    }
    if (event.type === 'tool.start') {
      onLog(`DOM Locator Agent 工具调用：${event.toolCall?.tool} ${compactEventValue(event.toolCall?.input || {})}`);
    }
    if (event.type === 'tool.result') {
      if (event.observation?.tool === 'search_source_evidence') {
        for (const candidate of event.observation?.result?.candidates || []) {
          if (!candidate?.file) continue;
          evidenceCandidates.set(candidate.file, Math.max(evidenceCandidates.get(candidate.file) || 0, Number(candidate.matchedAnchorCount) || 0));
        }
      }
      onLog(`DOM Locator Agent 工具结果：${event.observation?.tool}\n${compactEventValue(event.observation?.result)}`);
    }
    if (event.type === 'tool.error') {
      onLog(`DOM Locator Agent 工具失败：${event.observation?.tool}；${event.observation?.error || '-'}`);
    }
  };

  return {
    onEvent,
    evidenceCandidates,
    get modelRounds() { return modelRound; },
  };
}

module.exports = { createLocatorLogger };
