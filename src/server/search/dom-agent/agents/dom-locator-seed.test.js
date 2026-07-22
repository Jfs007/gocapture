'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  extractSeedAnchors,
  computeAnchorSeed,
  buildDomLocatorObjective,
  buildFallbackDecision,
} = require('./dom-locator-agent');

function fixtureProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-dom-seed-'));
  const projectFiles = [];
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    projectFiles.push({ path: file, size: Buffer.byteLength(content), mtimeMs: Date.now() });
  }
  return { name: 'fixture', path: root, kind: 'unknown', stack: [], files: projectFiles };
}

test('extractSeedAnchors keeps static labels and drops data-bound sentences', () => {
  const anchors = extractSeedAnchors([{ directText: '执行信息 执行人 反馈附件 暂无反馈附件 备注' }]);
  assert.ok(anchors.includes('执行人'));
  assert.ok(anchors.includes('反馈附件'));
  // 长句/占位不会进来（此选区没有，验证不误纳空白）
  assert.ok(anchors.every(a => a.length <= 8));
});

test('computeAnchorSeed ranks the file where labels co-occur highest', async () => {
  const project = fixtureProject({
    'src/b-components/subtask.vue': '<Form-item label="执行人"/>\n<Form-item label="反馈附件"/>\n<Form-item label="备注"/>',
    'src/other/a.vue': '<Form-item label="执行人"/>',
    'src/other/b.vue': '<div>无关</div>',
  });

  const seed = await computeAnchorSeed(project, [{ directText: '执行人 反馈附件 备注' }], new Map());
  assert.ok(seed, 'seed produced');
  assert.ok(seed.candidates.length >= 1);
  // 三个 label 共现的 subtask.vue 应排第一（matchedAnchorCount 最高）
  assert.strictEqual(seed.candidates[0].file, 'src/b-components/subtask.vue');
  assert.ok(seed.candidates[0].matchedAnchorCount >= 2);
});

test('computeAnchorSeed ranks a rare-anchor match above equal-count common-anchor matches', async () => {
  const project = fixtureProject({
    'src/subtask.vue': '<Form-item label="反馈附件"/>\n<Form-item label="备注"/>',
    'src/mediaA.vue': '<Form-item label="执行人"/>\n<Form-item label="备注"/>',
    'src/mediaB.vue': '<Form-item label="执行人"/>\n<Form-item label="备注"/>',
    'src/mediaC.vue': '<Form-item label="执行人"/>',
  });
  const seed = await computeAnchorSeed(project, [{ directText: '执行人 反馈附件 备注' }], new Map());
  // subtask 与 mediaA/B 命中数都是 2，但 subtask 命中稀有的“反馈附件”→ 稀有度更高 → 排第一
  assert.strictEqual(seed.candidates[0].file, 'src/subtask.vue');
});

test('objective injects the anchor-seed block with a verify-first directive', () => {
  const objective = buildDomLocatorObjective({
    userPrompt: 'x',
    anchorSeed: { anchors: ['执行人', '反馈附件'], candidates: [{ file: 'src/b-components/subtask.vue', matchedAnchorCount: 2 }] },
  });
  assert.ok(objective.includes('锚点交集候选'));
  assert.ok(objective.includes('src/b-components/subtask.vue'));
  assert.ok(objective.includes('read_file'));
  // 有种子时路由结构性降级为一行背景，不再作为“事实块”喂进去
  assert.ok(objective.includes('页面路由（仅背景）'));
  assert.ok(!objective.includes('页面与路由事实'));
});

test('objective omits the seed block when there are no candidates', () => {
  const objective = buildDomLocatorObjective({ userPrompt: 'x', anchorSeed: { anchors: [], candidates: [] } });
  assert.ok(!objective.includes('锚点交集候选'));
});

test('buildFallbackDecision ranks evidence + seed candidates within known files', () => {
  const project = { files: [{ path: 'src/b-components/task-manage/common@2x/subtask.vue' }, { path: 'src/x.vue' }] };
  const evidenceCandidates = new Map([['src/b-components/task-manage/common@2x/subtask.vue', 3]]);
  const anchorSeed = { candidates: [{ file: 'src/x.vue', matchedAnchorCount: 1 }, { file: 'src/not-in-project.vue', matchedAnchorCount: 9 }] };

  const decision = buildFallbackDecision({ anchorSeed, evidenceCandidates, project, recursionLimitHit: true });
  assert.strictEqual(decision.status, 'need-more-context');
  assert.strictEqual(decision.files[0].file, 'src/b-components/task-manage/common@2x/subtask.vue');
  assert.strictEqual(decision.files[0].role, 'render');
  // 不存在于项目文件列表的候选被剔除（不编造文件）
  assert.strictEqual(decision.files.some(f => f.file === 'src/not-in-project.vue'), false);
  assert.match(decision.reason, /递归上限/);
});

test('buildFallbackDecision returns null when no known candidate', () => {
  const project = { files: [{ path: 'src/a.vue' }] };
  const decision = buildFallbackDecision({ anchorSeed: { candidates: [{ file: 'src/ghost.vue', matchedAnchorCount: 5 }] }, evidenceCandidates: new Map(), project, recursionLimitHit: false });
  assert.strictEqual(decision, null);
});
