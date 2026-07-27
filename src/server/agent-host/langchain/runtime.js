'use strict';

const {
  createLangChainModel,
  normalizeModelConfig,
  prepareModelResponseFormat,
} = require('../../model/providers/registry');
const {
  createLangChainTools,
  loadLangChainRuntime,
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
    structuredResponse: result?.structuredResponse || null,
  };
}

function messageText(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (content == null) return '';
  return JSON.stringify(content);
}

function createModelTelemetryMiddleware(runtime, options, modelConfig) {
  if (typeof runtime.createMiddleware !== 'function' || typeof options.onEvent !== 'function') return null;
  return runtime.createMiddleware({
    name: 'GoCaptureModelTelemetry',
    wrapModelCall: async (request, handler) => {
      const messages = Array.isArray(request.messages) ? request.messages : [];
      const tools = Array.isArray(request.tools) ? request.tools : [];
      options.onEvent({
        type: 'llm.input',
        runtime: 'langchain',
        stage: options.stage || 'langchain-agent',
        messages,
        toolCount: tools.length,
        toolNames: tools.map(tool => tool?.name || '').filter(Boolean),
      });
      const startedAt = Date.now();
      const response = await handler(request);
      options.onEvent({
        type: 'llm.output',
        runtime: 'langchain',
        stage: options.stage || 'langchain-agent',
        rawText: messageText(response),
        toolCalls: Array.isArray(response?.tool_calls) ? response.tool_calls : [],
      });
      options.onEvent({
        type: 'llm.log',
        runtime: 'langchain',
        log: `LangChain 模型响应：provider=${modelConfig.provider}；model=${modelConfig.model}；耗时=${Date.now() - startedAt}ms`,
      });
      return response;
    },
  });
}

async function runLangChainAgent(project, options = {}, deps = {}) {
  const runtime = loadLangChainRuntime();
  if (!runtime.available) {
    return {
      ran: false,
      reason: `LangChain runtime missing: ${runtime.missing.join(', ') || 'unknown'}`,
    };
  }
  const modelConfig = options.langchainModel
    ? { provider: 'injected', model: options.langchainModel._llmType?.() || 'test-model' }
    : normalizeModelConfig(options.adapter);
  const model = options.langchainModel || createLangChainModel(modelConfig, {
    temperature: options.temperature,
    structuredOutput: Boolean(options.responseFormat),
  });
  const responseFormat = options.responseFormat
    ? options.langchainModel
      ? options.responseFormat
      : prepareModelResponseFormat(modelConfig, options.responseFormat, runtime)
    : undefined;
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
    toolGuard: deps.toolGuard,
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
  const telemetryMiddleware = createModelTelemetryMiddleware(runtime, options, modelConfig);
  const agent = runtime.createAgent({
    model,
    tools: langchainTools,
    systemPrompt: options.systemPrompt,
    middleware: [telemetryMiddleware, ...(options.middleware || [])].filter(Boolean),
    ...(responseFormat ? { responseFormat } : {}),
  });
  const invokeConfig = {
    ...(options.threadId ? { configurable: { thread_id: options.threadId } } : {}),
    ...(options.maxTurns ? { recursionLimit: Math.max(2, Number(options.maxTurns) * 2 + 2) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
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
  } catch (error) {
    const isRecursion = error?.name === 'GraphRecursionError' || /recursion limit/i.test(error?.message || '');
    if (!isRecursion) throw error;
    // 撞递归上限不再裸抛：返回空结果 + 标记，由上层用已收集证据做 best-effort 兜底。
    if (typeof options.onEvent === 'function') options.onEvent({ type: 'agent.recursion_limit', error: error.message });
    return {
      ran: true,
      recursionLimitHit: true,
      result: { content: '', messageCount: 0, messages: [] },
    };
  } finally {
    await mcpTools.close();
  }
}

module.exports = {
  createLangChainTools,
  createModelTelemetryMiddleware,
  filterToolsByConfigAction,
  loadLangChainRuntime,
  normalizeLangChainResult,
  normalizeConfigAction,
  runLangChainAgent,
};
