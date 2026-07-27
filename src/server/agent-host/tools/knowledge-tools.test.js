'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { executeAgentTool, listAgentTools } = require('./registry');

function fixtureProject(files, stack = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-knowledge-tools-'));
  const projectFiles = [];
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    projectFiles.push({ path: file, size: Buffer.byteLength(content), mtimeMs: Date.now() });
  }
  return { name: 'fixture', path: root, kind: 'unknown', stack, files: projectFiles };
}

// 模拟扫描/解释阶段烘焙好的结构化知识（含 context7 派生的 frameworkProfiles）。
function writeKnowledge(project, knowledge) {
  fs.mkdirSync(path.join(project.path, '.gocapture'), { recursive: true });
  fs.writeFileSync(path.join(project.path, '.gocapture', 'project-knowledge.json'), JSON.stringify(knowledge));
}

async function consult(project, input) {
  const output = await executeAgentTool(project, { tool: 'consult_project_knowledge', input });
  return output.result;
}

const IVIEW_PROFILE = {
  name: 'iView',
  version: '3.x',
  classPrefixes: [{ prefix: 'ivu-', action: 'skip', reason: 'iView 核心 class' }],
  signatureHints: [{ domPattern: 'label.ivu-form-item-label{text=X}', sourceConstruct: '<Form-item label="X">', searchAs: 'label="X"' }],
};

test('consult_project_knowledge is registered as a read-only builtin tool', () => {
  const tool = listAgentTools().find(item => item.name === 'consult_project_knowledge');
  assert.ok(tool, 'tool should be discoverable');
  assert.strictEqual(tool.access, 'read');
  assert.strictEqual(tool.source, 'builtin');
  assert.strictEqual(tool.readOnly, true);
});

test('consumes baked frameworkProfiles + measured custom prefix (no false positive)', async () => {
  const project = fixtureProject({ 'src/a.vue': '<div></div>' }, ['Vue', 'View UI']);
  writeKnowledge(project, {
    version: 2,
    frameworks: ['View UI'],
    frameworkProfiles: [IVIEW_PROFILE],
    customClassPrefixes: [{ prefix: 'dc-', occurrences: 120, action: 'downweight' }],
    businessDirs: ['src/b-components', 'src/view'],
  });

  const out = await consult(project, {
    intent: '执行人后面加执行部门',
    domClasses: ['ivu-input', 'dc-fieldset', 'file-upload-component'],
    domTexts: ['执行人'],
  });

  // 框架签名来自烘焙的 context7 派生 profile
  assert.strictEqual(out.framework.name, 'iView');
  assert.ok(out.framework.classPolicy.some(p => p.prefix === 'ivu-' && p.action === 'skip'));
  assert.ok(out.signatureHints.some(h => h.searchAs === 'label="X"' && h.source === 'context7-derived'));
  assert.ok(out.signatureHints.every(h => h.mustVerify === true));
  // 自定义前缀（实测）进 classPolicy 且标注本地验证
  assert.ok(out.framework.classPolicy.some(p => p.prefix === 'dc-' && p.action === 'downweight'));
  const skipped = out.anchorPlan.skip;
  assert.ok(skipped.some(s => s.text === 'ivu-input'), 'framework class skipped');
  assert.ok(skipped.some(s => s.text === 'dc-fieldset' && /本地扫描验证/.test(s.why)), 'dc- via measured prefix');
  assert.strictEqual(skipped.some(s => s.text === 'file-upload-component'), false, 'no false-positive when knowledge present');
  assert.deepStrictEqual(out.searchScopes.preferredRoots, ['src/b-components', 'src/view']);
});

test('anchor plan flags data-bound text and recommends static labels', async () => {
  const project = fixtureProject({ 'src/a.vue': '<div></div>' }, ['Vue', 'View UI']);
  writeKnowledge(project, { version: 2, frameworks: ['View UI'], frameworkProfiles: [IVIEW_PROFILE], customClassPrefixes: [], businessDirs: [] });

  const out = await consult(project, {
    intent: '定位',
    domTexts: ['执行人', '1、对XX产品（明星/艺人）XX信息在什么平台检测（即需求）'],
  });
  assert.ok(out.anchorPlan.recommended.some(a => a.text === '执行人'));
  assert.strictEqual(out.anchorPlan.dataBoundSuspects.length, 1);
  assert.strictEqual(out.anchorPlan.recommended.some(t => t.text.includes('XX')), false);
});

test('degrades to heuristics when project-knowledge.json is absent', async () => {
  const project = fixtureProject({ 'src/a.vue': '<div></div>' });
  const out = await consult(project, {
    intent: '定位',
    domClasses: ['dc-legend'],
    domTexts: ['备注'],
  });
  assert.strictEqual(out.framework.name, 'unknown');
  assert.deepStrictEqual(out.experienceLeads, []);
  assert.ok(out.notes.some(n => n.includes('project-knowledge.json')));
  // 无结构化知识时，短前缀走启发式回退降权
  assert.ok(out.anchorPlan.skip.some(s => s.text === 'dc-legend' && /启发式/.test(s.why)));
  assert.ok(out.anchorPlan.recommended.some(a => a.text === '备注'));
});
