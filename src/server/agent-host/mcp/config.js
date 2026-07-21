'use strict';

// MCP 配置加载：对齐 Claude 的 .mcp.json 格式。
//   { "mcpServers": { "<name>": { "command","args","env","cwd" } | { "url","type","headers" } } }
// 合并「用户级 ~/.magnus/mcp.json」+「项目级 <projectPath>/.mcp.json」，项目覆盖用户。

const fs = require('fs');
const os = require('os');
const path = require('path');

function readMcpServers(file) {
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return json && typeof json.mcpServers === 'object' && json.mcpServers ? json.mcpServers : {};
  } catch (error) {
    return {};
  }
}

function userConfigPath() {
  return path.join(os.homedir(), '.magnus', 'mcp.json');
}

function normalizeServer(name, raw) {
  if (!raw || typeof raw !== 'object' || raw.disabled) return null;
  const base = { name: String(name) };
  if (raw.command) {
    return {
      ...base,
      transport: 'stdio',
      command: String(raw.command),
      args: Array.isArray(raw.args) ? raw.args.map(String) : [],
      env: raw.env && typeof raw.env === 'object' ? raw.env : {},
      cwd: raw.cwd ? String(raw.cwd) : null,
    };
  }
  if (raw.url) {
    return {
      ...base,
      transport: String(raw.transport || raw.type || 'http'),
      url: String(raw.url),
      headers: raw.headers && typeof raw.headers === 'object' ? raw.headers : undefined,
    };
  }
  return null;
}

function loadMcpServers(projectPath) {
  const user = readMcpServers(userConfigPath());
  const project = projectPath ? readMcpServers(path.join(projectPath, '.mcp.json')) : {};
  const merged = { ...user, ...project };
  return Object.entries(merged)
    .map(([name, raw]) => normalizeServer(name, raw))
    .filter(Boolean);
}

module.exports = {
  loadMcpServers,
  userConfigPath,
};
