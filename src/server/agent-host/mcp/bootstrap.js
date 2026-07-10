'use strict';

// 把配置里的 MCP server 登记成 Magnus ToolProvider（走唯一扩展点 registerAgentToolProvider）。
// 懒连接 + 全量登记：
//   · 有缓存的 server → 直接用缓存的工具清单登记，不 spawn；首次 tools/call 时才连接。
//   · 无缓存的 server → 首次连接一次拿 tools/list 并缓存（之后就走缓存路径）。
//   · 单个 server 失败只跳过它、不影响其它，也不拖垮 host。

const { registerAgentToolProvider, unregisterAgentToolProvider } = require('../tools/registry');
const { createMcpToolProvider } = require('../tools/mcp-provider');
const { loadMcpServers } = require('./config');
const { createStdioMcpClient } = require('./stdio-client');
const { readToolsCache, writeToolsCache } = require('./cache');

// 当前活跃的 MCP 连接：providerId(`mcp.<name>`) -> client。用于重绑项目/改配置时关掉旧子进程、注销旧 provider。
const activeClients = new Map();

// 供前端观测：每个 server 的状态 + 一份日志环形缓冲。
const serverStatus = new Map(); // name -> { name, status:'ready'|'failed', toolCount, tools:[名], error, updatedAt }
const logBuffer = [];
function pushLog(line) {
  logBuffer.push({ at: new Date().toISOString(), line: String(line) });
  if (logBuffer.length > 200) logBuffer.shift();
}
function getMcpStatus() {
  return {
    servers: [...serverStatus.values()],
    logs: logBuffer.slice(-100),
  };
}

function disposeClient(providerId) {
  const client = activeClients.get(providerId);
  if (client) {
    try { client.close(); } catch (error) { /* ignore */ }
    activeClients.delete(providerId);
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 把 MCP 原始工具描述映射成 createMcpToolProvider 需要的形状。
function toProviderTool(tool) {
  return {
    name: String(tool.name || ''),
    title: tool.title || tool.name,
    description: tool.description || '',
    inputSchema: tool.inputSchema || tool.inputJSONSchema || { type: 'object', properties: {} },
    access: 'external',
    // MCP 工具的读写/并发语义由 server 决定，本地保守当作「可写、非并发安全」，权限交给上游把关。
    readOnly: false,
    concurrencySafe: false,
  };
}

async function registerServer(server, { onLog, connectTimeoutMs }) {
  const client = createStdioMcpClient(server); // 懒连接：此处不 connect
  let tools = readToolsCache(server);
  if (!tools) {
    tools = await withTimeout(client.listTools(), connectTimeoutMs, `MCP ${server.name} 连接`);
    writeToolsCache(server, tools);
  }
  registerAgentToolProvider(createMcpToolProvider({
    serverName: server.name,
    tools: tools.map(toProviderTool),
    executeTool: async ({ toolName, input }) => {
      const result = await client.callTool(toolName, input); // 首次调用时才真正连接
      return result;
    },
  }));
  return {
    name: server.name,
    toolCount: tools.length,
    tools: tools.map(tool => `mcp__${server.name}__${tool.name}`),
    client,
  };
}

async function registerConfiguredMcpProviders(projectPath, options = {}) {
  const externalLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  const log = line => { pushLog(line); externalLog(line); };
  // 首连超时放宽到 30s：npx 冷启动要下载 MCP 包，8s 不够。登记是 fire-and-forget，不阻塞项目绑定。
  const connectTimeoutMs = Number(options.connectTimeoutMs || 30000);
  const servers = loadMcpServers(projectPath);
  const nextIds = new Set(servers.map(server => `mcp.${server.name}`));

  // 清理「不在新配置里」的旧 MCP provider（换项目 / 删了某个 server 时）：关子进程 + 注销。
  for (const providerId of [...activeClients.keys()]) {
    if (!nextIds.has(providerId)) {
      disposeClient(providerId);
      unregisterAgentToolProvider(providerId);
      serverStatus.delete(providerId.replace(/^mcp\./, ''));
      log(`MCP 注销（旧配置）：${providerId}`);
    }
  }

  const registered = [];
  for (const server of servers) {
    const providerId = `mcp.${server.name}`;
    try {
      disposeClient(providerId); // 同名重建前先关掉旧连接，避免子进程泄漏
      log(`MCP 登记中：${server.name}（${server.command} ${server.args.join(' ')}）`);
      const info = await registerServer(server, { onLog: log, connectTimeoutMs });
      activeClients.set(providerId, info.client);
      serverStatus.set(server.name, {
        name: server.name,
        status: 'ready',
        toolCount: info.toolCount,
        tools: info.tools,
        error: '',
        updatedAt: new Date().toISOString(),
      });
      registered.push(info);
      log(`MCP 已登记：${server.name}（${info.toolCount} 个工具：${info.tools.join('、')}）`);
    } catch (error) {
      serverStatus.set(server.name, {
        name: server.name,
        status: 'failed',
        toolCount: 0,
        tools: [],
        error: error.message || String(error),
        updatedAt: new Date().toISOString(),
      });
      log(`MCP 登记失败（跳过）：${server.name} — ${error.message || error}`);
    }
  }
  return registered;
}

module.exports = {
  registerConfiguredMcpProviders,
  getMcpStatus,
};
