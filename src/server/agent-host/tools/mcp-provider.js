'use strict';

const { createToolProvider } = require('./provider');
const { buildTool } = require('./tool');

function createMcpToolProvider({ serverName, tools, executeTool }) {
  const normalizedServerName = String(serverName || '').trim();
  if (!normalizedServerName) throw new Error('MCP tool provider requires serverName.');
  if (!Array.isArray(tools)) throw new Error('MCP tool provider requires tools.');
  if (typeof executeTool !== 'function') throw new Error('MCP tool provider requires executeTool().');

  return createToolProvider({
    id: `mcp.${normalizedServerName}`,
    title: `MCP: ${normalizedServerName}`,
    source: 'mcp',
    description: `Tools provided by MCP server ${normalizedServerName}.`,
    tools: tools.map(tool => {
      const toolName = String(tool.name || '').trim();
      if (!toolName) throw new Error(`MCP server ${normalizedServerName} provided a tool without name.`);
      const publicName = toolName.startsWith('mcp__')
        ? toolName
        : `mcp__${normalizedServerName}__${toolName}`;
      return buildTool({
        name: publicName,
        title: tool.title || toolName,
        description: tool.description || '',
        category: 'mcp',
        access: tool.access || 'external',
        inputSchema: tool.inputSchema || tool.inputJSONSchema || { type: 'object', properties: {} },
        isReadOnly: () => !!tool.readOnly,
        isConcurrencySafe: () => !!tool.concurrencySafe,
        call: context => executeTool({
          serverName: normalizedServerName,
          toolName,
          publicName,
          input: context.input,
          context,
        }),
      });
    }),
  });
}

module.exports = {
  createMcpToolProvider,
};
