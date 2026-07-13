'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { scanProject } = require('../../../core/project');
const { runAgentSearch } = require('../../agent-search');
const { candidateSourceRole } = require('../source/source-role');
const { extractMarkupBindings } = require('./relation-adapters/markup-bindings');
const {
  buildSourceRelationGraph,
  relationGraphComposite,
} = require('./source-relation-graph');

function projectFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-source-relation-'));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return { root, project: scanProject(root) };
}

test('relation graph joins definition, business prop binding and direct renderer through barrels', t => {
  const fixture = projectFixture({
    'src/components/index.ts': "export { default as MdCheckGroup } from './md-check-group/index.vue'",
    'src/components/md-check-group/index.vue': [
      '<template><div class="check-group">',
      '<div v-for="item in options" class="check-group_item">{{ item.label }}</div>',
      '</div></template>',
      '<script setup lang="ts">',
      'defineProps({ options: { type: Array, default: () => [] } })',
      '</script>',
    ].join('\n'),
    'src/constants/index.ts': "export * from './options'",
    'src/constants/options.ts': [
      'export const DELIVERY_TARGET_OPTIONS = [',
      "  { label: '下单', value: 1 },",
      "  { label: '下单和ROI', value: 2 },",
      ']',
    ].join('\n'),
    'src/views/new-create.vue': [
      '<template>',
      '  <md-check-group :options="DELIVERY_TARGET_OPTIONS" />',
      '</template>',
      '<script setup lang="ts">',
      "import { MdCheckGroup } from '@/components'",
      "import { DELIVERY_TARGET_OPTIONS } from '@/constants'",
      '</script>',
    ].join('\n'),
  });
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const graph = buildSourceRelationGraph(fixture.project, {
    candidates: [
      {
        file: 'src/components/md-check-group/index.vue',
        sourceRole: 'render-like',
        referenceOnly: false,
        excerpt: 'check-group',
      },
      {
        file: 'src/constants/options.ts',
        sourceRole: 'definition-like',
        referenceOnly: true,
        excerpt: '下单 下单和ROI',
      },
    ],
  }, new Map());

  assert.equal(graph.status, 'unique-complete');
  assert.equal(graph.bundles[0].owner, 'src/views/new-create.vue');
  assert.equal(graph.bundles[0].renderer, 'src/components/md-check-group/index.vue');
  assert.equal(graph.bundles[0].definition, 'src/constants/options.ts');
  assert.equal(graph.bundles[0].symbol, 'DELIVERY_TARGET_OPTIONS');
  assert.equal(graph.bundles[0].prop, 'options');
  const composite = relationGraphComposite(graph);
  assert.equal(composite.render.file, 'src/views/new-create.vue');
  assert.equal(composite.children[0].file, 'src/components/md-check-group/index.vue');
});

test('TypeScript exported factories are not classified as definitions only because they use export const', () => {
  const role = candidateSourceRole('src/components/createCell.ts', [
    'export const createCell = (value: string) => {',
    "  return runtimeRenderer('div', { role: 'button' }, value)",
    '}',
  ].join('\n'));
  assert.equal(role.role, 'unknown');
  assert.equal(role.referenceOnly, false);
});

test('TypeScript exported object and array data remain definition nodes for relation tracing', () => {
  const role = candidateSourceRole('src/constants/options.ts', [
    'export const OPTIONS: Array<{ label: string }> = [',
    "  { label: '下单' },",
    ']',
  ].join('\n'));
  assert.equal(role.role, 'definition-like');
  assert.equal(role.referenceOnly, true);
});

test('markup adapter normalizes Vue, React, Angular and Svelte prop binding syntax', () => {
  const cases = [
    '<CheckGroup :options="OPTIONS" />',
    '<CheckGroup options={OPTIONS} />',
    '<check-group [options]="OPTIONS"></check-group>',
    '<CheckGroup bind:options="OPTIONS" />',
  ];
  for (const markup of cases) {
    const relations = extractMarkupBindings({ file: 'src/view.tsx', text: markup });
    assert.equal(relations.length, 1);
    assert.equal(relations[0].component, 'check-group');
    assert.deepEqual(relations[0].bindings[0], { prop: 'options', expression: 'OPTIONS' });
  }
});

test('DOM Agent prefers a complete local relation bundle over the highest-scoring renderer', async t => {
  const fixture = projectFixture({
    'src/components/index.ts': "export { default as MdCheckGroup } from './md-check-group/index.vue'",
    'src/components/md-check-group/index.vue': [
      '<template><div class="check-group">',
      '<div v-for="item in options" class="check-group_item">{{ item.label }}</div>',
      '</div></template>',
      '<script setup lang="ts">defineProps({ options: Array })</script>',
    ].join('\n'),
    'src/constants/index.ts': "export * from './options'",
    'src/constants/options.ts': "export const OPTIONS = [{ label: '下单' }, { label: '下单和ROI' }]",
    'src/views/new-create.vue': [
      '<template><MdCheckGroup :options="OPTIONS" /></template>',
      "<script setup lang=\"ts\">import { MdCheckGroup } from '@/components'",
      "import { OPTIONS } from '@/constants'</script>",
    ].join('\n'),
  });
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  let modelCalls = 0;
  const result = await runAgentSearch(fixture.project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    userPrompt: '@选区1 定位源码',
    selections: [{
      element: {
        rawOuterHtml: '<div class="check-group"><div class="check-group_item">下单</div><div class="check-group_item">下单和ROI</div></div>',
      },
      sourceLocate: { componentChain: [] },
    }],
  }, {
    runModelTask: async () => {
      modelCalls += 1;
      return {
        adapter: { id: 'test', name: 'test', type: 'api' },
        rawText: JSON.stringify({
          searches: [
            { keywords: ['check-group', 'check-group_item'], mode: 'all', range: 'same-structure', priority: 1, reason: 'structure' },
            { keywords: ['下单', '下单和ROI'], mode: 'all', range: 'same-structure', priority: 2, reason: 'content' },
          ],
          needMoreDom: false,
        }),
        logs: [],
      };
    },
  });
  assert.equal(modelCalls, 1);
  assert.equal(result.hits[0].file, 'src/views/new-create.vue');
  assert.equal(result.composite.children[0].file, 'src/components/md-check-group/index.vue');
  assert.equal(result.composite.references[0].file, 'src/constants/options.ts');
});
