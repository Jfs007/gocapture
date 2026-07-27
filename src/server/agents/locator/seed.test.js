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
  createDomLocatorContextMiddleware,
  createDomLocatorToolGuard,
  normalizeLocatorDecision,
} = require('./index');

function fixtureProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-dom-seed-'));
  const projectFiles = [];
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    projectFiles.push({ path: file, size: Buffer.byteLength(content), mtimeMs: Date.now() });
  }
  return { name: 'fixture', path: root, kind: 'unknown', stack: [], files: projectFiles };
}

test('extractSeedAnchors preserves exact visible phrases and individual labels', () => {
  const anchors = extractSeedAnchors([
    { directText: '应用上架、店铺配置' },
    { directText: '执行信息 执行人 反馈附件 备注' },
  ]);
  assert.ok(anchors.includes('应用上架、店铺配置'));
  assert.ok(anchors.includes('执行人'));
  assert.ok(anchors.includes('反馈附件'));
  assert.ok(anchors.every(a => a.length <= 64));
});

test('extractSeedAnchors drops only text outside the operational size boundary', () => {
  const anchors = extractSeedAnchors([{
    directText: '这是一段用于验证输入边界的超长可见文字'.repeat(5),
  }]);
  assert.deepEqual(anchors, []);
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
  assert.deepEqual(
    seed.candidates[0].matchedAnchors.map(match => match.text).sort(),
    ['反馈附件', '备注', '执行人'].sort()
  );
  assert.ok(seed.candidates[0].matchedAnchors.every(match => match.line > 0 && match.snippet));
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

test('objective gives one ReAct agent seed facts and requires finish-tool submission', () => {
  const objective = buildDomLocatorObjective({
    hasKnowledgeTool: true,
    projectStructure: 'SHOULD_NOT_BE_INCLUDED',
    routeFacts: { pagePath: '/task' },
    domSelections: [{ directText: '执行信息 执行人' }],
    anchorSeed: {
      anchors: ['执行信息', '执行人'],
      candidates: [{
        file: 'src/task/subtask.vue',
        matchedAnchorCount: 2,
        matchedAnchors: [{ text: '执行人', line: 12, snippet: '<label>执行人</label>' }],
      }],
    },
  });
  assert.match(objective, /锚点交集候选/);
  assert.match(objective, /src\/task\/subtask\.vue/);
  assert.match(objective, /必须调用 finish_dom_location/);
  assert.doesNotMatch(objective, /SHOULD_NOT_BE_INCLUDED/);
});

test('DOM Locator retains LangChain context editing inside the same ReAct run', () => {
  const middleware = createDomLocatorContextMiddleware();
  assert.ok(middleware);
  assert.equal(typeof middleware.wrapModelCall, 'function');
});

test('DOM Locator stops repeated line-range pagination and redirects to symbol evidence', () => {
  const guard = createDomLocatorToolGuard({ forceFinish: false });
  assert.equal(guard('read_file', {
    files: ['src/task/index.js'],
    around: '80-200',
  }), null);

  const blocked = guard('read_file', {
    files: ['src/task/index.js'],
    around: '200-350',
  });
  assert.equal(blocked.blocked, true);
  assert.deepEqual(blocked.files, ['src/task/index.js']);
  assert.equal(blocked.requestedRange, '200-350');
  assert.match(blocked.note, /inspect_symbol_occurrences/);

  assert.equal(guard('inspect_symbol_occurrences', {
    file: 'src/task/index.js',
    symbols: ['target'],
    missingFact: 'target 的来源',
    decisionImpact: '确认目标关系',
  }), null);
});

test('DOM Locator range guard remains independent per file and ignores focused reads', () => {
  const guard = createDomLocatorToolGuard({ forceFinish: false });
  assert.equal(guard('read_file', { files: ['src/a.js'], around: '80-160' }), null);
  assert.equal(guard('read_file', { files: ['src/b.js'], around: '80-160' }), null);
  assert.equal(guard('read_file', { files: ['src/a.js'], around: 'knownSymbol' }), null);
  assert.equal(guard('read_file', { files: ['src/a.js'], terms: ['knownSymbol'] }), null);
});

test('buildFallbackDecision ranks evidence + seed candidates within known files', () => {
  const project = { files: [{ path: 'src/b-components/task-manage/common@2x/subtask.vue' }, { path: 'src/x.vue' }] };
  const evidenceCandidates = new Map([['src/b-components/task-manage/common@2x/subtask.vue', 3]]);
  const anchorSeed = { candidates: [{ file: 'src/x.vue', matchedAnchorCount: 1 }, { file: 'src/not-in-project.vue', matchedAnchorCount: 9 }] };

  const decision = buildFallbackDecision({ anchorSeed, evidenceCandidates, project, recursionLimitHit: true });
  assert.strictEqual(decision.status, 'unresolved');
  assert.deepEqual(decision.files, []);
  assert.strictEqual(decision.candidateFacts[0].file, 'src/b-components/task-manage/common@2x/subtask.vue');
  // 不存在于项目文件列表的候选被剔除（不编造文件）
  assert.strictEqual(decision.candidateFacts.some(f => f.file === 'src/not-in-project.vue'), false);
  assert.match(decision.reason, /递归上限/);
});

test('buildFallbackDecision returns null when no known candidate', () => {
  const project = { files: [{ path: 'src/a.vue' }] };
  const decision = buildFallbackDecision({ anchorSeed: { candidates: [{ file: 'src/ghost.vue', matchedAnchorCount: 5 }] }, evidenceCandidates: new Map(), project, recursionLimitHit: false });
  assert.strictEqual(decision, null);
});

test('Locator normalizes the ReAct finish-tool payload and preserves its target snippet', () => {
  const project = { files: [{ path: 'src/page.js' }] };
  const decision = normalizeLocatorDecision({
    status: 'resolved',
    files: [{
      file: 'src/page.js',
      role: 'render',
      confidence: 99,
      reason: '真实源码证据',
      targetSnippet: '<section>目标节点</section>',
    }],
    relations: [],
    coveredDom: ['目标节点'],
    missingEvidence: [],
    needMoreDom: false,
    reason: '已定位',
  }, project);
  assert.equal(decision.status, 'resolved');
  assert.equal(decision.files[0].file, 'src/page.js');
  assert.equal(decision.files[0].targetSnippet, '<section>目标节点</section>');
});

test('plain completion text is not accepted as a Locator decision', () => {
  const decision = normalizeLocatorDecision('所有证据已完备，直接提交。', {
    files: [{ path: 'src/page.js' }],
  });
  assert.equal(decision.status, 'unresolved');
  assert.deepEqual(decision.files, []);
});
