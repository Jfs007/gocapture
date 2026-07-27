'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { registerConfiguredSkillProviders } = require('./bootstrap');
const { listAgentTools, listAgentToolProviders, executeAgentTool } = require('../tools/registry');

test('Skills 闭环：.gocapture/skills/*/SKILL.md → 登记 → skill__<name> 可见 → 调用返回指令', async () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-skill-'));
  const skillDir = path.join(projectDir, '.gocapture', 'skills', 'pr-review');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
    '---',
    'name: pr-review',
    'description: 审查 PR 变更并给出结构化意见',
    'allowed-tools: [read_file, search_text]',
    '---',
    '# 步骤',
    '1. 读取 diff',
    '2. 逐项给出意见',
  ].join('\n'));

  const skills = registerConfiguredSkillProviders(projectDir, {});
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, 'pr-review');
  assert.deepEqual(skills[0].allowedTools, ['read_file', 'search_text']);

  assert.ok(listAgentToolProviders().some(p => p.id === 'builtin.skills' && p.source === 'skill'));
  const tool = listAgentTools().find(t => t.name === 'skill__pr-review');
  assert.ok(tool, '应出现 skill__pr-review');
  assert.match(tool.description, /审查 PR/);

  const output = await executeAgentTool({ path: projectDir }, { tool: 'skill__pr-review', input: {} });
  assert.equal(output.providerId, 'builtin.skills');
  assert.match(output.result.instructions, /逐项给出意见/);
  assert.deepEqual(output.result.allowedTools, ['read_file', 'search_text']);

  // 换到没有 skills 的项目 → provider 被注销
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-skill-empty-'));
  registerConfiguredSkillProviders(empty, {});
  assert.ok(!listAgentToolProviders().some(p => p.id === 'builtin.skills'), '无 skill 的项目应注销 builtin.skills');
});
