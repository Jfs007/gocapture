'use strict';

const { experienceToolProvider } = require('./experience-tools');
const { projectToolProvider } = require('./project-tools');

const toolProviders = [
  projectToolProvider,
  experienceToolProvider,
];

function assertToolProvider(provider) {
  if (!provider || typeof provider !== 'object') throw new Error('Tool provider must be an object.');
  if (!provider.id) throw new Error('Tool provider requires id.');
  if (typeof provider.listTools !== 'function') throw new Error(`Tool provider ${provider.id} requires listTools().`);
  if (typeof provider.canExecute !== 'function') throw new Error(`Tool provider ${provider.id} requires canExecute().`);
  if (typeof provider.execute !== 'function') throw new Error(`Tool provider ${provider.id} requires execute().`);
}

function registerAgentToolProvider(provider) {
  assertToolProvider(provider);
  const index = toolProviders.findIndex(item => item.id === provider.id);
  if (index >= 0) {
    toolProviders[index] = provider;
  } else {
    toolProviders.push(provider);
  }
  return provider;
}

function listAgentToolProviders() {
  return toolProviders.map(provider => ({
    id: provider.id,
    title: provider.title || provider.id,
    source: provider.source || 'unknown',
    kind: provider.kind || 'tool-provider',
    description: provider.description || '',
    toolCount: provider.listTools().length,
  }));
}

function normalizeToolCall(toolCall) {
  const name = String(toolCall?.tool || toolCall?.name || toolCall?.operation || '');
  const input = toolCall?.input && typeof toolCall.input === 'object'
    ? toolCall.input
    : toolCall || {};
  return { name, input };
}

function normalizeExecutionContext(context) {
  if (context instanceof Map) return { textCache: context };
  if (!context || typeof context !== 'object') return { textCache: new Map() };
  return {
    ...context,
    textCache: context.textCache || new Map(),
  };
}

function listAgentTools() {
  return toolProviders.flatMap(provider => provider.listTools());
}

async function executeAgentTool(project, toolCall, context = {}) {
  const { name, input } = normalizeToolCall(toolCall);
  const executionContext = normalizeExecutionContext(context);
  const provider = toolProviders.find(item => item.canExecute(name));
  if (!provider) {
    throw new Error(`Unknown agent tool: ${name || '-'}`);
  }
  const result = await provider.execute({
    ...executionContext,
    project,
    name,
    input,
  });
  return {
    tool: name,
    providerId: provider.id,
    result,
  };
}

module.exports = {
  executeAgentTool,
  listAgentToolProviders,
  listAgentTools,
  registerAgentToolProvider,
};
