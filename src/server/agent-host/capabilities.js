'use strict';

const DEFAULT_AGENT_CONFIG_ACTION = ['builtin', 'experience', 'skill', 'mcp'];

function normalizeConfigAction(options = {}, fallback = []) {
  const raw = options.configAction || options.configActions || options.capabilities || fallback;
  if (Array.isArray(raw)) return new Set(raw.map(item => String(item).trim()).filter(Boolean));
  if (raw && typeof raw === 'object') {
    return new Set(Object.entries(raw)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => String(name).trim())
      .filter(Boolean));
  }
  return new Set();
}

function filterToolsByConfigAction(tools, options = {}) {
  const actions = normalizeConfigAction(options, options.defaultConfigAction || []);
  if (!actions.size) return [];
  const allowedTools = new Set(Array.isArray(options.allowedTools) ? options.allowedTools.map(String) : []);
  const allowedToolNames = new Set(Array.isArray(options.allowedToolNames) ? options.allowedToolNames.map(String) : []);
  const blockedProviders = new Set(Array.isArray(options.blockedProviders) ? options.blockedProviders.map(String) : []);
  const blockedCategories = new Set(Array.isArray(options.blockedCategories) ? options.blockedCategories.map(String) : []);
  return (tools || []).filter(tool => {
    const source = String(tool.source || 'unknown');
    const category = String(tool.category || '');
    if (!actions.has(source) && !actions.has(category)) return false;
    if (source === 'mcp') return false;
    if (allowedTools.size && !allowedTools.has(tool.name)) return false;
    if (allowedToolNames.size && !allowedToolNames.has(tool.name)) return false;
    if (blockedProviders.has(tool.providerId)) return false;
    if (blockedCategories.has(category)) return false;
    if (options.readOnlyOnly && tool.access !== 'read' && tool.access !== 'external') return false;
    return true;
  });
}

module.exports = {
  DEFAULT_AGENT_CONFIG_ACTION,
  filterToolsByConfigAction,
  normalizeConfigAction,
};
