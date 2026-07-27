'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getMcpStatus, registerConfiguredMcpProviders } = require('./bootstrap');
const { loadMcpLangChainTools } = require('../langchain/mcp-runtime');
const { listAgentTools, listAgentToolProviders } = require('../tools/registry');

const MOCK_SERVER = `'use strict';
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => {
  buffer += c;
  let i;
  while ((i = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (line) handle(line);
  }
});
const send = p => process.stdout.write(JSON.stringify(p) + '\\n');
function handle(line) {
  let m;
  try { m = JSON.parse(line); } catch { return; }
  if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mock', version: '0.0.1' } } });
  if (m.method === 'notifications/initialized') return;
  if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'echo', description: '回显文本', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }] } });
  if (m.method === 'tools/call') {
    const a = m.params?.arguments || {};
    return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'echo:' + (a.text ?? '') }] } });
  }
  if (m.id !== undefined) send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'method not found' } });
}
`;

function makeMockProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-mcp-'));
  const serverPath = path.join(dir, 'mock-server.js');
  fs.writeFileSync(serverPath, MOCK_SERVER);
  fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({
    mcpServers: { mock: { command: process.execPath, args: [serverPath] } },
  }));
  return dir;
}

test('MCP 配置登记只更新状态，不注册成 GoCapture provider', async () => {
  const projectDir = makeMockProject();
  const registered = await registerConfiguredMcpProviders(projectDir, {});
  assert.equal(registered.length, 1);
  assert.equal(registered[0].name, 'mock');
  assert.equal(registered[0].runtimeLoaded, false);
  assert.ok(getMcpStatus().servers.some(server => server.name === 'mock' && server.status === 'configured'));
  assert.ok(!listAgentToolProviders().some(provider => provider.id === 'mcp.mock'));
  assert.ok(!listAgentTools().some(tool => tool.name === 'mcp__mock__echo'));
});

test('MCP tools 由 LangChain runtime 加载并可直接调用', async () => {
  const projectDir = makeMockProject();
  const runtime = await loadMcpLangChainTools({ path: projectDir });
  try {
    assert.equal(runtime.available, true);
    const echo = runtime.tools.find(tool => tool.name === 'mcp__mock__echo');
    assert.ok(echo, '应出现 mcp__mock__echo');
    const output = await echo.invoke({ text: 'hi' });
    assert.match(typeof output === 'string' ? output : JSON.stringify(output), /echo:hi/);
    assert.ok(getMcpStatus().servers.some(server => server.name === 'mock' && server.status === 'ready' && server.toolCount === 1));
  } finally {
    await runtime.close();
  }
});
