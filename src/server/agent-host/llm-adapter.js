'use strict';

const { runLangChainAgent } = require('./langchain/runtime');

async function runAgentTask(project, options = {}, deps = {}) {
  const result = await runLangChainAgent(project, {
    adapter: options.adapter,
    langchainModel: options.langchainModel,
    objective: options.objective || options.prompt || '',
    stage: options.stage,
    systemPrompt: options.systemPrompt || '你是 Magnus Agent Host 中的 LLM，必须按当前任务要求返回结果。',
    signal: options.signal,
    temperature: options.temperature,
    configAction: options.configAction || [],
    maxTurns: options.maxTurns,
    middleware: options.middleware,
    responseFormat: options.responseFormat,
    readOnlyOnly: options.readOnlyOnly,
    threadId: options.threadId,
    onEvent: options.onEvent || (event => {
      if (event.type === 'llm.log') options.onLog?.(event.log);
      if (event.type === 'llm.input') options.onLog?.(`Agent LLM 输入：stage=${options.stage || 'agent-llm'}；messages=${(event.messages || []).length}；tools=${event.toolCount ?? 0}`);
      if (event.type === 'llm.output') options.onLog?.(`Agent LLM 输出：stage=${options.stage || 'agent-llm'}；${String(event.rawText || '').length} 字符`);
    }),
  }, {
    tools: Array.isArray(deps.tools) ? deps.tools : [],
    executeTool: deps.executeTool || (async () => null),
    textCache: deps.textCache || new Map(),
    langchainTools: Array.isArray(deps.langchainTools) ? deps.langchainTools : [],
    toolGuard: deps.toolGuard,
  });
  if (!result.ran) throw new Error(result.reason);
  return {
    adapter: { id: options.adapter?.id || '', name: options.adapter?.name || 'API 模型', type: 'api' },
    rawText: result.result?.content || '',
    result: result.result,
    structuredResponse: result.result?.structuredResponse || null,
    recursionLimitHit: Boolean(result.recursionLimitHit),
    logs: [],
  };
}

async function runAgentLlmTask(adapter, prompt, project, options = {}) {
  return runAgentTask(project, {
    adapter,
    langchainModel: options.langchainModel,
    objective: prompt,
    stage: options.stage,
    systemPrompt: options.systemPrompt || '你是 Magnus Agent Host 中的 LLM，必须按当前任务要求返回结果。',
    signal: options.signal,
    temperature: options.temperature,
    configAction: options.configAction || [],
    maxTurns: options.maxTurns,
    responseFormat: options.responseFormat,
    onLog: options.onLog,
  });
}

module.exports = {
  runAgentTask,
  runAgentLlmTask,
};
