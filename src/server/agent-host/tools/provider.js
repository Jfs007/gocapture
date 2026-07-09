'use strict';

const { publicToolDescriptor } = require('./tool');

function createToolProvider(definition) {
  if (!definition || typeof definition !== 'object') throw new Error('Tool provider definition must be an object.');
  if (!definition.id) throw new Error('Tool provider requires id.');
  const tools = Array.isArray(definition.tools) ? definition.tools.slice() : [];
  const provider = {
    id: definition.id,
    title: definition.title || definition.id,
    source: definition.source || 'builtin',
    kind: definition.kind || 'tool-provider',
    description: definition.description || '',
    listTools() {
      return tools.map(tool => publicToolDescriptor(tool, provider));
    },
    canExecute(name) {
      return tools.some(tool => tool.name === name || (tool.aliases || []).includes(name));
    },
    async execute(context) {
      const tool = tools.find(item => item.name === context.name || (item.aliases || []).includes(context.name));
      if (!tool) throw new Error(`Unknown provider tool: ${context.name || '-'}`);
      if (!tool.isEnabled(context)) throw new Error(`Tool disabled: ${tool.name}`);
      const validation = await tool.validateInput(context.input, context);
      if (validation && validation.ok === false) {
        throw new Error(validation.message || `Invalid input for tool: ${tool.name}`);
      }
      const input = validation?.input || context.input;
      const permission = await tool.checkPermissions(input, context);
      if (permission && permission.behavior === 'deny') {
        throw new Error(permission.message || `Permission denied for tool: ${tool.name}`);
      }
      return tool.call({
        ...context,
        name: tool.name,
        input: permission?.input || input,
      });
    },
  };
  return Object.freeze(provider);
}

module.exports = {
  createToolProvider,
};
