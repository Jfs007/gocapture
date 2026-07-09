'use strict';

const TOOL_DEFAULTS = {
  inputSchema: { type: 'object', properties: {} },
  outputSchema: undefined,
  access: 'read',
  category: 'general',
  isEnabled: () => true,
  validateInput: input => ({ ok: true, input }),
  checkPermissions: input => ({ behavior: 'allow', input }),
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => false,
};

function buildTool(definition) {
  if (!definition || typeof definition !== 'object') throw new Error('Tool definition must be an object.');
  if (!definition.name) throw new Error('Tool definition requires name.');
  if (typeof definition.call !== 'function') throw new Error(`Tool ${definition.name} requires call().`);
  return Object.freeze({
    ...TOOL_DEFAULTS,
    title: definition.title || definition.name,
    description: definition.description || '',
    ...definition,
  });
}

function publicToolDescriptor(tool, provider) {
  return {
    name: tool.name,
    title: tool.title || tool.name,
    description: tool.description || '',
    category: tool.category || 'general',
    access: tool.access || 'read',
    inputSchema: tool.inputSchema || TOOL_DEFAULTS.inputSchema,
    outputSchema: tool.outputSchema,
    readOnly: !!tool.isReadOnly({}),
    concurrencySafe: !!tool.isConcurrencySafe({}),
    destructive: !!tool.isDestructive({}),
    providerId: provider.id,
    source: provider.source || 'unknown',
  };
}

module.exports = {
  buildTool,
  publicToolDescriptor,
};
