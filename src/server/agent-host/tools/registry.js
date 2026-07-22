'use strict';

const { experienceToolProvider } = require('./experience-tools');
const { knowledgeToolProvider } = require('./knowledge-tools');
const { projectToolProvider } = require('./project-tools');

const toolProviders = [
  projectToolProvider,
  knowledgeToolProvider,
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

function unregisterAgentToolProvider(id) {
  const index = toolProviders.findIndex(item => item.id === id);
  if (index < 0) return false;
  toolProviders.splice(index, 1);
  return true;
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
  if (Array.isArray(executionContext.allowedTools) && executionContext.allowedTools.length) {
    const allowed = new Set(executionContext.allowedTools.map(String));
    if (!allowed.has(name)) {
      throw new Error(`Tool is not allowed in this agent context: ${name || '-'}`);
    }
  }
  if (Array.isArray(executionContext.blockedTools) && executionContext.blockedTools.map(String).includes(name)) {
    throw new Error(`Tool is blocked in this agent context: ${name || '-'}`);
  }
  const descriptor = listAgentTools().find(tool => tool.name === name);
  if (descriptor && executionContext.readOnlyOnly && descriptor.access !== 'read' && descriptor.access !== 'external') {
    throw new Error(`Tool requires non-read access in a read-only agent context: ${name}`);
  }
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
  unregisterAgentToolProvider,
};
