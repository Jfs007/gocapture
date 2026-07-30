'use strict';

const { z } = require('zod');
const { loadMcpLangChainTools } = require('../../agent-host/langchain/mcp-runtime');
const { loadSkills } = require('../../agent-host/skills/loader');

async function createProjectExtensionSession(project, options = {}) {
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
  const handlers = new Map();
  const definitions = [];
  const projectPath = String(project?.path || project?.projectRoot || '').trim();

  for (const skill of loadSkills(projectPath)) {
    const name = `skill__${safeToolPart(skill.name)}`;
    definitions.push({
      name,
      description: skill.description
        || `Load the ${skill.name} project Skill instructions before continuing.`,
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      source: 'skill',
      sourceName: skill.name,
    });
    handlers.set(name, async () => ({
      skill: skill.name,
      description: skill.description,
      allowedTools: skill.allowedTools,
      instructions: skill.body,
      source: skill.source,
    }));
  }

  const mcp = await loadMcpLangChainTools(project, {
    onEvent: event => onEvent({
      type: 'agent-extension-event',
      event,
      message: extensionEventMessage(event),
    }),
  });
  for (const tool of mcp.tools || []) {
    const name = String(tool.name || '').trim();
    if (!name || handlers.has(name)) continue;
    definitions.push({
      name,
      description: String(tool.description || name),
      inputSchema: jsonSchemaForTool(tool),
      source: 'mcp',
    });
    handlers.set(name, input => tool.invoke(input || {}));
  }

  return {
    definitions,
    async invoke(name, input) {
      const handler = handlers.get(String(name || ''));
      if (!handler) throw new Error(`项目扩展工具不存在：${name}`);
      return handler(input || {});
    },
    has(name) {
      return handlers.has(String(name || ''));
    },
    async close() {
      await mcp.close();
    },
  };
}

function jsonSchemaForTool(tool) {
  const schema = tool?.schema || tool?.lc_kwargs?.schema;
  if (!schema) return permissiveObjectSchema();
  try {
    const value = typeof z.toJSONSchema === 'function'
      ? z.toJSONSchema(schema)
      : null;
    if (value && typeof value === 'object') {
      delete value.$schema;
      return value;
    }
  } catch (error) {
    // Some MCP adapters expose a plain JSON schema instead of Zod.
  }
  if (schema && typeof schema === 'object' && schema.type) return schema;
  return permissiveObjectSchema();
}

function permissiveObjectSchema() {
  return {
    type: 'object',
    additionalProperties: true,
    properties: {},
  };
}

function safeToolPart(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'unnamed';
}

function extensionEventMessage(event) {
  if (event?.type === 'mcp.ready') {
    return `Agent MCP 已加载：${event.serverCount || 0} 个服务，${event.toolCount || 0} 个工具`;
  }
  if (event?.type === 'mcp.error') {
    return `Agent MCP 加载失败：${event.error || event.server || '未知错误'}`;
  }
  return '';
}

module.exports = {
  createProjectExtensionSession,
  jsonSchemaForTool,
  safeToolPart,
};
