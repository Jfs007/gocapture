'use strict';

function stripJsonFence(text) {
  const value = String(text || '').trim();
  const fenced = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : value;
}

function parseAgentResponse(rawText) {
  const text = stripJsonFence(rawText);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`Agent response is not valid JSON: ${error.message}`);
  }
  const toolCalls = Array.isArray(payload.toolCalls)
    ? payload.toolCalls
    : Array.isArray(payload.tool_calls)
      ? payload.tool_calls
      : [];
  return {
    thought: String(payload.thought || payload.reason || ''),
    toolCalls: toolCalls.map((call, index) => ({
      id: String(call.id || `tool_${index + 1}`),
      tool: String(call.tool || call.name || call.operation || ''),
      input: call.input && typeof call.input === 'object' ? call.input : {},
      reason: String(call.reason || ''),
    })).filter(call => call.tool),
    final: payload.final || payload.answer || null,
    status: String(payload.status || (payload.final || payload.answer ? 'final' : 'tool-call')),
  };
}

function compactToolDescriptor(tool) {
  return {
    name: tool.name,
    description: tool.description,
    category: tool.category,
    access: tool.access,
    readOnly: tool.readOnly,
    concurrencySafe: tool.concurrencySafe,
    inputSchema: tool.inputSchema,
  };
}

function createAgentSystemPrompt() {
  return [
    '你是 Magnus Agent Host 中的执行规划模型。',
    '你不能直接访问文件、网络或运行环境。',
    '你只能通过提供的 tools/resources/experiences 完成任务。',
    '每一轮只输出严格 JSON，不输出 Markdown，不输出解释文字。',
    '如果需要能力，输出 toolCalls；如果已经足够回答，输出 final。',
    '不要编造工具名、文件路径、源码内容或执行结果。',
    '工具输入必须符合对应 inputSchema。',
    '输出格式：',
    '{"thought":"","toolCalls":[{"id":"","tool":"","input":{},"reason":""}],"final":null}',
  ].join('\n');
}

function createAgentTurnPrompt({
  objective,
  tools,
  resources,
  experiences,
  history,
  observations,
}) {
  return JSON.stringify({
    objective: String(objective || ''),
    availableTools: (tools || []).map(compactToolDescriptor),
    availableResources: resources || [],
    availableExperiences: experiences || [],
    history: history || [],
    observations: observations || [],
  }, null, 2);
}

module.exports = {
  createAgentSystemPrompt,
  createAgentTurnPrompt,
  parseAgentResponse,
};
