'use strict';

const { ApiChatModel } = require('./api-chat-model');
const {
  createLangChainTools,
  loadLangChainRuntime,
  zodFromJsonSchema,
} = require('./tool-adapter');
const { loadMcpLangChainTools } = require('./mcp-runtime');
const { filterToolsByConfigAction, normalizeConfigAction } = require('../capabilities');

function normalizeLangChainResult(result) {
  const messages = Array.isArray(result?.messages) ? result.messages : [];
  const last = messages[messages.length - 1] || null;
  return {
    content: typeof last?.content === 'string' ? last.content : last?.content ? JSON.stringify(last.content) : '',
    messageCount: messages.length,
    messages: messages.map(message => ({
      type: typeof message?._getType === 'function' ? message._getType() : message?.type || 'message',
      content: typeof message?.content === 'string' ? message.content : message?.content ? JSON.stringify(message.content) : '',
      toolCallId: message?.tool_call_id || '',
      toolCalls: Array.isArray(message?.tool_calls)
        ? message.tool_calls.map(call => ({ id: call.id || '', name: call.name || '', args: call.args || {} }))
        : [],
    })),
  };
}

async function runLangChainAgent(project, options = {}, deps = {}) {
  const runtime = loadLangChainRuntime();
  if (!runtime.available) {
    return {
      ran: false,
      reason: `LangChain runtime missing: ${runtime.missing.join(', ') || 'unknown'}`,
    };
  }
  const model = options?.langchainModel || new ApiChatModel({
    adapter: options.adapter,
    project,
    signal: options.signal,
    stage: options.stage || 'langchain-agent',
    temperature: options.temperature,
    onLog: log => {
      if (typeof options.onEvent === 'function') {
        options.onEvent({ type: 'llm.log', runtime: 'langchain', log });
      }
    },
    onEvent: options.onEvent,
  });
  const textCache = deps.textCache || new Map();
  const configAction = normalizeConfigAction(options);
  const toolDescriptors = Array.isArray(deps.tools) ? deps.tools : [];
  const lcTools = createLangChainTools({
    tools: toolDescriptors,
    project,
    executeTool: deps.executeTool,
    textCache,
    allowedTools: toolDescriptors.map(tool => tool.name),
    readOnlyOnly: options.readOnlyOnly,
    onEvent: options.onEvent,
  });
  if (!lcTools.available) return { ran: false, reason: `LangChain tools unavailable: ${lcTools.missing.join(', ')}` };
  const mcpTools = configAction.has('mcp')
    ? await loadMcpLangChainTools(project, { onEvent: options.onEvent })
    : { available: true, tools: [], close: async () => {} };
  if (!mcpTools.available && typeof options.onEvent === 'function') {
    options.onEvent({ type: 'mcp.unavailable', missing: mcpTools.missing || [], error: mcpTools.error || '' });
  }
  const langchainTools = [
    ...lcTools.tools,
    ...(Array.isArray(deps.langchainTools) ? deps.langchainTools : []),
    ...(mcpTools.available ? mcpTools.tools : []),
  ];
  if (typeof options.onEvent === 'function') {
    options.onEvent({
      type: 'agent.runtime',
      runtime: 'langchain',
      configAction: [...configAction],
      toolCount: langchainTools.length,
      builtinToolCount: lcTools.tools.length,
      mcpToolCount: mcpTools.available ? mcpTools.tools.length : 0,
    });
  }
  const agent = runtime.createAgent({
    model,
    tools: langchainTools,
    systemPrompt: options.systemPrompt,
    middleware: options.middleware || [],
  });
  const invokeConfig = {
    ...(options.threadId ? { configurable: { thread_id: options.threadId } } : {}),
    ...(options.maxTurns ? { recursionLimit: Math.max(2, Number(options.maxTurns) * 2 + 2) } : {}),
  };
  try {
    const result = await agent.invoke(
      { messages: [{ role: 'user', content: String(options.objective || '') }] },
      Object.keys(invokeConfig).length ? invokeConfig : undefined
    );
    return {
      ran: true,
      result: normalizeLangChainResult(result),
    };
  } finally {
    await mcpTools.close();
  }
}

module.exports = {
  ApiChatModel,
  createLangChainTools,
  filterToolsByConfigAction,
  loadLangChainRuntime,
  normalizeLangChainResult,
  normalizeConfigAction,
  runLangChainAgent,
  zodFromJsonSchema,
};
