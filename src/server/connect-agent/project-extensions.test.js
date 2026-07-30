'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  deleteProjectMcp,
  deleteProjectSkill,
  listProjectExtensions,
  saveProjectMcp,
  saveProjectSkill,
} = require('./project-extensions');

test('project extensions install, list and remove MCP and Skills', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-extensions-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = { path: root };

  saveProjectMcp(project, {
    name: 'docs',
    transport: 'stdio',
    command: 'node',
    args: ['server.js'],
    env: { API_KEY: 'secret' },
  });
  saveProjectSkill(project, {
    name: 'review',
    description: 'Review source',
    instructions: 'Inspect the selected source before editing.',
    allowedTools: ['Read', 'Grep'],
  });

  const catalog = listProjectExtensions(project, {
    id: 'codex',
    name: 'Codex',
    connected: true,
    capabilities: { externalTools: true },
  });
  assert.equal(catalog.provider.id, 'codex');
  assert.equal(catalog.mcpServers[0].name, 'docs');
  assert.equal(catalog.mcpServers[0].source, 'project');
  assert.equal(catalog.mcpServers[0].config.env.API_KEY, '已配置');
  assert.equal(catalog.skills[0].name, 'review');
  assert.equal(catalog.skills[0].source, 'project');
  assert.equal(catalog.skills[0].instructions, 'Inspect the selected source before editing.');
  assert.ok(catalog.tools.some(tool => tool.name === 'expand_selection_context'));

  saveProjectMcp(project, {
    name: 'docs',
    transport: 'stdio',
    command: 'node',
    args: ['updated.js'],
    env: { API_KEY: '已配置' },
  });
  const saved = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8'));
  assert.equal(saved.mcpServers.docs.env.API_KEY, 'secret');
  assert.deepEqual(saved.mcpServers.docs.args, ['updated.js']);

  deleteProjectMcp(project, 'docs');
  deleteProjectSkill(project, 'review');
  assert.deepEqual(listProjectExtensions(project).mcpServers, []);
  assert.deepEqual(listProjectExtensions(project).skills, []);
});
