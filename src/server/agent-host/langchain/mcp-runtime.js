'use strict';

const { loadMcpServers } = require('../mcp/config');
const { isMcpProviderStopped, markMcpServerStatus } = require('../mcp/bootstrap');

function tryRequire(moduleName) {
  try {
    return require(moduleName);
  } catch (error) {
    return null;
  }
}

function loadMcpAdapter() {
  const adapter = tryRequire('@langchain/mcp-adapters');
  return {
    available: typeof adapter?.MultiServerMCPClient === 'function',
    MultiServerMCPClient: adapter?.MultiServerMCPClient,
    missing: adapter ? [] : ['@langchain/mcp-adapters'],
  };
}

function serverToLangChainConfig(server) {
  if (server.transport === 'stdio') {
    return {
      transport: 'stdio',
      command: server.command,
      args: server.args || [],
      env: server.env || {},
      ...(server.cwd ? { cwd: server.cwd } : {}),
    };
  }
  if (server.url) {
    return {
      transport: server.transport || 'http',
      url: server.url,
      ...(server.headers ? { headers: server.headers } : {}),
    };
  }
  return null;
}

function configuredServers(project) {
  const projectPath = project?.path || project?.projectRoot || '';
  return loadMcpServers(projectPath).filter(server => !isMcpProviderStopped(server.name));
}

async function loadMcpLangChainTools(project, options = {}) {
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
  const adapter = loadMcpAdapter();
  if (!adapter.available) {
    return {
      available: false,
      missing: adapter.missing,
      tools: [],
      close: async () => {},
    };
  }
  const servers = configuredServers(project);
  if (!servers.length) {
    return {
      available: true,
      missing: [],
      tools: [],
      close: async () => {},
    };
  }
  const mcpServers = {};
  for (const server of servers) {
    const config = serverToLangChainConfig(server);
    if (config) mcpServers[server.name] = config;
  }
  const client = new adapter.MultiServerMCPClient({
    mcpServers,
    prefixToolNameWithServerName: true,
    additionalToolNamePrefix: 'mcp',
    useStandardContentBlocks: true,
    onConnectionError: ({ serverName, error }) => {
      markMcpServerStatus(serverName, {
        status: 'failed',
        toolCount: 0,
        tools: [],
        error: error?.message || String(error),
      });
      onEvent({ type: 'mcp.error', server: serverName, error: error?.message || String(error) });
    },
    beforeToolCall: ({ serverName, name, args }) => {
      onEvent({ type: 'tool.start', toolCall: { tool: `mcp__${serverName}__${name}`, input: args || {} } });
      return { args };
    },
    afterToolCall: ({ serverName, name, result }) => {
      onEvent({ type: 'tool.result', observation: { tool: `mcp__${serverName}__${name}`, providerId: `mcp.${serverName}`, ok: true, result } });
      return { result };
    },
  });
  try {
    const tools = await client.getTools();
    const byServer = new Map();
    for (const tool of tools) {
      const match = String(tool.name || '').match(/^mcp__(.*?)__(.*)$/);
      const serverName = match?.[1] || 'unknown';
      if (!byServer.has(serverName)) byServer.set(serverName, []);
      byServer.get(serverName).push(tool.name);
    }
    for (const server of servers) {
      const toolNames = byServer.get(server.name) || [];
      markMcpServerStatus(server.name, {
        status: 'ready',
        toolCount: toolNames.length,
        tools: toolNames,
        error: '',
      });
    }
    onEvent({ type: 'mcp.ready', serverCount: servers.length, toolCount: tools.length });
    return {
      available: true,
      missing: [],
      tools,
      close: async () => {
        if (typeof client.close === 'function') await client.close();
      },
    };
  } catch (error) {
    for (const server of servers) {
      markMcpServerStatus(server.name, {
        status: 'failed',
        toolCount: 0,
        tools: [],
        error: error.message || String(error),
      });
    }
    onEvent({ type: 'mcp.error', error: error.message || String(error) });
    try {
      if (typeof client.close === 'function') await client.close();
    } catch (closeError) {
      // ignore
    }
    return {
      available: false,
      missing: [],
      tools: [],
      error: error.message || String(error),
      close: async () => {},
    };
  }
}

module.exports = {
  loadMcpAdapter,
  loadMcpLangChainTools,
  serverToLangChainConfig,
};
