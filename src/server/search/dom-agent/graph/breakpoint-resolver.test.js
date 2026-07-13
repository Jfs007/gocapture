'use strict';

const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanProject } = require('../../../core/project');
const { buildFileMap } = require('../../import-trace');
const { resolveBreakpoint, localPrimitives } = require('./breakpoint-resolver');

// 真实断点：task-module 用 <component :is="component">，component = componentMap[type]（注册表 + 动态 key）。
// 静态无法确定它渲染 subtask 还是 add.batch —— 这正是断点。
function factoryProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-'));
  const files = {
    'src/task-module.vue': [
      '<template><component :is="component" /></template>',
      '<script>',
      'import { componentMap } from "./registry"',
      'export default { props: ["type"], computed: { component(){ return componentMap[this.type] } } }',
      '</script>',
    ].join('\n'),
    'src/registry.ts': [
      'import Subtask from "./subtask.vue"',
      'import AddBatch from "./add.batch.vue"',
      'export const componentMap = { subtask: Subtask, addBatch: AddBatch }',
    ].join('\n'),
    'src/subtask.vue': '<template><span>执行人</span></template>',
    'src/add.batch.vue': '<template><span>执行部门</span></template>',
  };
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return { root, project: scanProject(root) };
}

test('breakpoint loop: LLM proposes a verification step, local executes it, then resolves the dynamic render target', async () => {
  const { root, project } = factoryProject();
  try {
    let round = 0;
    const invoke = async (stage, prompt) => {
      round += 1;
      if (round === 1) {
        // 第一轮：只回「下一步验证什么」，不猜文件。
        return JSON.stringify({ action: 'find_symbol', args: { name: 'componentMap' }, reason: '定位注册表定义' });
      }
      // 第二轮：本地已把 find_symbol 的结果回灌，模型据真实事实收敛。
      assert.match(prompt, /registry\.ts/);   // 本地确定性搜索命中了注册表文件
      assert.match(prompt, /subtask/);        // 注册表里能看到 subtask -> Subtask
      return JSON.stringify({ action: 'resolve', args: { file: 'src/subtask.vue' }, reason: 'componentMap.subtask' });
    };
    const out = await resolveBreakpoint({
      project,
      wallFile: 'src/task-module.vue',
      unresolvedImports: [{ specifier: './registry', resolvedFile: 'src/registry.ts' }],
      targetCandidates: ['src/subtask.vue', 'src/add.batch.vue'],
      chain: ['src/route.vue', 'src/task-module.vue'],
    }, { invoke });
    assert.equal(out.resolved, true);
    assert.equal(out.file, 'src/subtask.vue');
    assert.equal(out.via.length, 1);                 // 恰好用了一次本地验证
    assert.equal(out.via[0].action, 'find_symbol');
    assert.equal(round, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('breakpoint loop: returns ambiguous (not a guessed file) when the LLM gives up', async () => {
  const { root, project } = factoryProject();
  try {
    const invoke = async () => JSON.stringify({ action: 'give_up', reason: 'type 由接口返回，运行时才决定' });
    const out = await resolveBreakpoint({
      project,
      wallFile: 'src/task-module.vue',
      targetCandidates: ['src/subtask.vue', 'src/add.batch.vue'],
    }, { invoke, maxRounds: 2 });
    assert.equal(out.resolved, false);
    assert.match(out.reason, /接口/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('breakpoint loop: bounded rounds — never loops forever, returns ambiguous', async () => {
  const { root, project } = factoryProject();
  try {
    let calls = 0;
    const invoke = async () => { calls += 1; return JSON.stringify({ action: 'search_text', args: { term: '不存在的词' } }); };
    const out = await resolveBreakpoint({
      project,
      wallFile: 'src/task-module.vue',
      targetCandidates: ['src/subtask.vue'],
    }, { invoke, maxRounds: 2 });
    assert.equal(out.resolved, false);
    assert.equal(out.reason, 'max-rounds');
    assert.equal(out.via.length, 2);
    assert.equal(calls, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// route.vue --(组件边)--> task-module.vue --(动态 <component :is> = componentMap[type]，墙)--> subtask.vue
function factoryRouteProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bpr-'));
  const files = {
    'src/route.vue': '<template><task-module /></template>\n<script>import TaskModule from "./task-module.vue"</script>',
    'src/task-module.vue': [
      '<template><component :is="component" /></template>',
      '<script>',
      'import { componentMap } from "./registry"',
      'export default { props: ["type"], computed: { component(){ return componentMap[this.type] } } }',
      '</script>',
    ].join('\n'),
    'src/registry.ts': 'import Subtask from "./subtask.vue"\nexport const componentMap = { subtask: Subtask }',
    'src/subtask.vue': '<template><span>执行人</span></template>',
  };
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return { root, project: scanProject(root) };
}

test('breakpoint wiring: static traversal misses the dynamic target, breakpoint augmentation reaches it', async () => {
  const { routeComponentRelations, augmentRouteRelationsWithBreakpoints } = require('./source-relation-graph');
  const { root, project } = factoryRouteProject();
  try {
    const routeTrace = { matched: true, bestPageFile: 'src/route.vue', hits: [{ file: 'src/route.vue' }] };
    const candidates = [{
      file: 'src/subtask.vue',
      referenceOnly: false,
      matchedGroups: [{ source: 'planned-group', keywords: ['执行人', '反馈附件'] }],
    }];
    // 静态：动态墙拦住，subtask 到不了。
    const staticRelations = routeComponentRelations(project, routeTrace, candidates, new Map());
    assert.ok(!staticRelations.some(relation => relation.candidateFile === 'src/subtask.vue'));

    let round = 0;
    const invoke = async () => {
      round += 1;
      if (round === 1) return JSON.stringify({ action: 'find_symbol', args: { name: 'componentMap' } });
      return JSON.stringify({ action: 'resolve', args: { file: 'src/subtask.vue' } });
    };
    const relations = await augmentRouteRelationsWithBreakpoints(project, routeTrace, candidates, new Map(), { invoke });
    const bridged = relations.find(relation => relation.candidateFile === 'src/subtask.vue');
    assert.ok(bridged, 'subtask 应在断点解析后可达');
    assert.equal(bridged.via, 'breakpoint');
    assert.deepEqual(bridged.chain, ['src/route.vue', 'src/task-module.vue', 'src/subtask.vue']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('breakpoint wiring: additive & guarded — no invoke or give_up leaves the static result unchanged', async () => {
  const { augmentRouteRelationsWithBreakpoints } = require('./source-relation-graph');
  const { root, project } = factoryRouteProject();
  try {
    const routeTrace = { matched: true, bestPageFile: 'src/route.vue', hits: [{ file: 'src/route.vue' }] };
    const candidates = [{
      file: 'src/subtask.vue',
      referenceOnly: false,
      matchedGroups: [{ source: 'planned-group', keywords: ['执行人', '反馈附件'] }],
    }];
    // 无 invoke：不发任何模型调用，原样返回静态结果。
    const noInvoke = await augmentRouteRelationsWithBreakpoints(project, routeTrace, candidates, new Map(), {});
    assert.ok(!noInvoke.some(relation => relation.candidateFile === 'src/subtask.vue'));
    // give_up：不臆造边。
    const gaveUp = await augmentRouteRelationsWithBreakpoints(project, routeTrace, candidates, new Map(), {
      invoke: async () => JSON.stringify({ action: 'give_up', reason: 'type 运行时才定' }),
    });
    assert.ok(!gaveUp.some(relation => relation.candidateFile === 'src/subtask.vue'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('local primitives delegate to the shared discovery core (find_symbol / find_importers / search_text)', () => {
  const { root, project } = factoryProject();
  try {
    const primitives = localPrimitives(project, new Map());
    const symbol = primitives.find_symbol({ name: 'componentMap' });
    assert.ok(symbol.matches.some(item => item.path === 'src/registry.ts'));
    const importers = primitives.find_importers({ file: 'src/subtask.vue' });
    assert.ok(importers.matches.some(item => item.path === 'src/registry.ts'));
    const text = primitives.search_text({ term: '执行人' });
    assert.ok(text.matches.some(item => item.path === 'src/subtask.vue'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
