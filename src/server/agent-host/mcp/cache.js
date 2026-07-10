'use strict';

// MCP 工具清单磁盘缓存：支持「全量登记 + 懒连接」——启动时从缓存登记工具名（模型可见），
// 真正 tools/call 时才 spawn；只有「从没连过」的 server 才在首次连接一次以填充缓存。

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const cacheDir = path.join(os.homedir(), '.magnus', 'mcp-cache');

function cacheFile(server) {
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify({ command: server.command, args: server.args, env: server.env, cwd: server.cwd }))
    .digest('hex')
    .slice(0, 16);
  return path.join(cacheDir, `${server.name}-${hash}.json`);
}

function readToolsCache(server) {
  try {
    const data = JSON.parse(fs.readFileSync(cacheFile(server), 'utf8'));
    return Array.isArray(data?.tools) ? data.tools : null;
  } catch (error) {
    return null;
  }
}

function writeToolsCache(server, tools) {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile(server), JSON.stringify({ tools, cachedAt: new Date().toISOString() }), 'utf8');
  } catch (error) {
    /* 缓存失败不影响功能 */
  }
}

module.exports = {
  readToolsCache,
  writeToolsCache,
};
