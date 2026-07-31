'use strict';

const { loadMcpServers } = require('./config');

const serverStatus = new Map();
const stoppedServers = new Set();
const logBuffer = [];

function pushLog(line) {
  logBuffer.push({ at: new Date().toISOString(), line: String(line) });
  if (logBuffer.length > 200) logBuffer.shift();
}

function configuredToolLabel(server) {
  if (server.transport === 'stdio') {
    return `${server.command} ${(server.args || []).join(' ')}`.trim();
  }
  return `${server.transport || 'http'} ${server.url || ''}`.trim();
}

function markMcpServerStatus(name, patch) {
  if (!name) return;
  const previous = serverStatus.get(name) || {
    name,
    status: 'unknown',
    toolCount: 0,
    tools: [],
    error: '',
    updatedAt: '',
  };
  serverStatus.set(name, {
    ...previous,
    ...patch,
    name,
    updatedAt: new Date().toISOString(),
  });
}

function getMcpStatus() {
  return {
    servers: [...serverStatus.values()],
    logs: logBuffer.slice(-100),
  };
}

async function registerConfiguredMcpProviders(projectPath, options = {}) {
  const externalLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  const log = line => { pushLog(line); externalLog(line); };
  const servers = loadMcpServers(projectPath);
  const configuredNames = new Set(servers.map(server => server.name));
  for (const name of [...serverStatus.keys()]) {
    if (!configuredNames.has(name)) serverStatus.delete(name);
  }
  for (const server of servers) {
    if (stoppedServers.has(server.name)) {
      markMcpServerStatus(server.name, {
        status: 'stopped',
        toolCount: 0,
        tools: [],
        error: '',
        config: configuredToolLabel(server),
      });
      continue;
    }
    markMcpServerStatus(server.name, {
      status: 'configured',
      toolCount: 0,
      tools: [],
      error: '',
      config: configuredToolLabel(server),
    });
    log(`MCP 已发现：${server.name}（${configuredToolLabel(server)}）；将在 LangChain Agent 运行时加载`);
  }
  return servers.map(server => ({
    name: server.name,
    toolCount: 0,
    tools: [],
    runtimeLoaded: false,
  }));
}

function stopMcpProvider(name) {
  const value = String(name || '').replace(/^mcp\./, '').trim();
  if (!value) throw new Error('MCP stop requires server name.');
  stoppedServers.add(value);
  markMcpServerStatus(value, {
    status: 'stopped',
    toolCount: 0,
    tools: [],
    error: '',
  });
  pushLog(`MCP 已停止：${value}`);
  return { name: value, status: 'stopped' };
}

function resumeMcpProvider(name) {
  const value = String(name || '').replace(/^mcp\./, '').trim();
  if (!value) throw new Error('MCP resume requires server name.');
  stoppedServers.delete(value);
  markMcpServerStatus(value, {
    status: 'configured',
    error: '',
  });
  pushLog(`MCP 已恢复：${value}`);
  return { name: value, status: 'configured' };
}

function isMcpProviderStopped(name) {
  return stoppedServers.has(String(name || '').replace(/^mcp\./, '').trim());
}

module.exports = {
  getMcpStatus,
  isMcpProviderStopped,
  markMcpServerStatus,
  registerConfiguredMcpProviders,
  resumeMcpProvider,
  stopMcpProvider,
};
