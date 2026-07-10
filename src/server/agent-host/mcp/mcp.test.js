'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { registerConfiguredMcpProviders } = require('./bootstrap');
const { listAgentTools, listAgentToolProviders, executeAgentTool } = require('../tools/registry');

// 测试用的最小 MCP stdio server（内联，不在源码树里留 fixture 文件）。
const MOCK_SERVER = `'use strict';
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => {
  buffer += c; let i;
  while ((i = buffer.indexOf('\\n')) >= 0) { const line = buffer.slice(0,i).trim(); buffer = buffer.slice(i+1); if (line) handle(line); }
});
const send = p => process.stdout.write(JSON.stringify(p) + '\\n');
function handle(line){ let m; try { m = JSON.parse(line); } catch { return; }
  if (m.method === 'initialize') return send({ jsonrpc:'2.0', id:m.id, result:{ protocolVersion:'2024-11-05', capabilities:{tools:{}}, serverInfo:{name:'mock',version:'0.0.1'} } });
  if (m.method === 'notifications/initialized') return;
  if (m.method === 'tools/list') return send({ jsonrpc:'2.0', id:m.id, result:{ tools:[{ name:'echo', description:'回显文本', inputSchema:{ type:'object', properties:{ text:{type:'string'} }, required:['text'] } }] } });
  if (m.method === 'tools/call') { const a = m.params?.arguments || {}; return send({ jsonrpc:'2.0', id:m.id, result:{ content:[{ type:'text', text:'echo:' + (a.text ?? '') }] } }); }
  if (m.id !== undefined) send({ jsonrpc:'2.0', id:m.id, error:{ code:-32601, message:'method not found' } });
}
`;

function makeMockProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-mcp-'));
  const serverPath = path.join(dir, 'mock-server.js');
  fs.writeFileSync(serverPath, MOCK_SERVER);
  fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({
    mcpServers: { mock: { command: process.execPath, args: [serverPath] } },
  }));
  return dir;
}

test('MCP stdio 闭环：.mcp.json → 登记 provider → 工具可见(mcp__server__tool) → 统一入口调用', async () => {
  const projectDir = makeMockProject();
  const registered = await registerConfiguredMcpProviders(projectDir, {});
  try {
    assert.equal(registered.length, 1);
    assert.equal(registered[0].name, 'mock');
    assert.equal(registered[0].toolCount, 1);
    assert.ok(listAgentToolProviders().some(p => p.id === 'mcp.mock' && p.source === 'mcp'));

    const echo = listAgentTools().find(tool => tool.name === 'mcp__mock__echo');
    assert.ok(echo, '应出现 mcp__mock__echo');

    const output = await executeAgentTool({ path: projectDir }, { tool: 'mcp__mock__echo', input: { text: 'hi' } });
    assert.equal(output.providerId, 'mcp.mock');
    assert.equal(output.result?.content?.[0]?.text, 'echo:hi');
  } finally {
    registered.forEach(item => item.client && item.client.close());
  }
});

test('MCP 重绑清理：新配置里没有的 server → 旧 provider 注销、子进程关闭', async () => {
  const withMock = makeMockProject();
  await registerConfiguredMcpProviders(withMock, {});
  assert.ok(listAgentToolProviders().some(p => p.id === 'mcp.mock'), '绑定含 mock 的项目后应有 mcp.mock');

  const noMcp = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-mcp-empty-'));
  await registerConfiguredMcpProviders(noMcp, {});
  assert.ok(!listAgentToolProviders().some(p => p.id === 'mcp.mock'), '换到无 MCP 的项目后 mcp.mock 应被注销');
});
