'use strict';

// MCP stdio 客户端：与 MCP server 子进程用「换行分隔的 JSON-RPC 2.0」通信。
// 连接一次复用；initialize 握手 → tools/list → tools/call。懒连接（首次用到才 spawn）。

const { spawn } = require('child_process');

const PROTOCOL_VERSION = '2024-11-05';
const CLIENT_INFO = { name: 'magnus', version: '1.0.0' };

function createStdioMcpClient({ command, args = [], env = {}, cwd } = {}) {
  if (!command) throw new Error('MCP stdio client requires command.');
  let child = null;
  let ready = null;
  let nextId = 1;
  let buffer = '';
  const pending = new Map();

  function failAll(error) {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  }

  function handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      return; // 忽略 server 打到 stdout 的非 JSON 日志
    }
    if (message.id === undefined || !pending.has(message.id)) return; // 通知/无主响应，忽略
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message || `MCP error ${message.error.code || ''}`));
    else entry.resolve(message.result);
  }

  function write(payload) {
    if (!child || !child.stdin.writable) throw new Error('MCP server 未连接');
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  function request(method, params, timeoutMs = 30000) {
    const id = nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP ${method} 超时（${timeoutMs}ms）`));
      }, timeoutMs);
      pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      try {
        write({ jsonrpc: '2.0', id, method, params: params || {} });
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }

  function notify(method, params) {
    write({ jsonrpc: '2.0', method, params: params || {} });
  }

  function connect(timeoutMs = 45000) {
    if (ready) return ready;
    ready = (async () => {
      child = spawn(command, args, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.on('error', error => failAll(error));
      child.on('exit', (code, signal) => {
        failAll(new Error(`MCP server 进程退出（code=${code} signal=${signal || '-'}）`));
        child = null;
        ready = null;
      });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        buffer += chunk;
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (line) handleLine(line);
        }
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', () => {}); // 诊断信息交由 server 自己落盘，这里不阻塞

      await request('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      }, timeoutMs);
      notify('notifications/initialized');
    })().catch(error => {
      ready = null;
      throw error;
    });
    return ready;
  }

  async function listTools() {
    await connect();
    const result = await request('tools/list', {});
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  async function callTool(name, args) {
    await connect();
    return request('tools/call', { name, arguments: args || {} }, 120000);
  }

  function close() {
    failAll(new Error('MCP client 已关闭'));
    if (child) {
      try { child.kill(); } catch (error) { /* ignore */ }
      child = null;
    }
    ready = null;
  }

  return { connect, listTools, callTool, close };
}

module.exports = {
  createStdioMcpClient,
  PROTOCOL_VERSION,
};
