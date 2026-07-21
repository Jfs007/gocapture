'use strict';

const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AIMessage, fakeModel } = require('langchain');
const { scanProject } = require('../core/project');
const { parseReconPlan, keywordVariants, runRecon } = require('./recon');
const { extractUsageDoc } = require('./usage-doc');
const { saveComponentExperiences } = require('./component-experience');

function mkProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return scanProject(root);
}

function modelWith(...messages) {
  return messages.reduce(
    (model, message) => model.respond(new AIMessage(typeof message === 'string' ? message : JSON.stringify(message))),
    fakeModel()
  );
}

test('parseReconPlan：解析 {role,path,keywords} 数组，丢弃缺 path/keywords 的项', () => {
  const raw = '```json\n[{"role":"component","path":"src/components/md-table","keywords":["md-table"," "],"explain":"x"},{"role":"api","path":"","keywords":[]}]\n```';
  const plan = parseReconPlan(raw);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].path, 'src/components/md-table');
  assert.deepEqual(plan[0].keywords, ['md-table']);
});

test('keywordVariants：md-table ↔ MdTable，提高命中率', () => {
  assert.ok(keywordVariants('md-table').includes('MdTable'));
  assert.ok(keywordVariants('MdTable').includes('md-table'));
});

test('runRecon：LLM 只挑公共件，本地按变体搜谁用了它并抽真实调用点', async () => {
  const project = mkProject({
    'src/components/md-table/index.vue': '<template><div class="md-table"><slot /></div></template>',
    // 用它的业务页（用 PascalCase import + kebab 模板标签，验证变体命中）
    'src/views/order/list.vue': [
      '<template>', '  <md-table :columns="columns" :data="data" @update:pagination="paginationChange" />', '</template>',
      '<script setup lang="ts">', "import { MdTable } from '@/components'", "import { useTable } from '@/components/md-table/hooks/useTable'",
      'const { data, columns, pagination, paginationChange } = useTable({ api: getList })', '</script>',
    ].join('\n'),
  });
  const langchainModel = modelWith(
    [{ role: 'component', path: 'src/components/md-table', keywords: ['md-table'], explain: '表格' }],
    [
      '# src/components/md-table',
      '## Template 用法',
      '```vue',
      '<md-table :columns="columns" :data="data" @update:pagination="paginationChange" />',
      '```',
      '## 数据 Hook',
      '```ts',
      'import { MdTable } from "@/components"',
      'import { useTable } from "@/components/md-table/hooks/useTable"',
      'const { data, columns, pagination, paginationChange } = useTable({ api: getList })',
      '```',
    ].join('\n')
  );
  const logs = [];
  const result = await runRecon(project, { requirement: '添加一个选择记录列表', langchainModel, log: line => logs.push(line) });
  assert.match(logs.join('\n'), /Structure\.md/);
  assert.doesNotMatch(logs.join('\n'), /Project\.md 摘要|featureDirectory/);
  assert.match(logs.join('\n'), /本地证据包/);
  assert.equal(result.reuse.length, 1);
  const md = result.reuse[0];
  assert.equal(md.path, 'src/components/md-table');
  assert.equal(md.usage.path, 'src/views/order/list.vue', '用法样例应是用它的业务页，不是它自身');
  assert.match(md.usage.snippet, /<md-table/);
  assert.match(md.usage.snippet, /import \{ MdTable \}/, '变体 MdTable 命中，抽到 import 行');
  assert.match(md.usage.snippet, /useTable\(/);
  fs.rmSync(project.path, { recursive: true, force: true });
});

test('runRecon：多个业务文件使用同一公共件时优先选择体积更小的示例文件', async () => {
  const largeColumns = Array.from({ length: 80 }, (_, index) => `const noise${index} = ${index}`).join('\n');
  const project = mkProject({
    'src/components/md-table/index.vue': '<template><div class="md-table"><slot /></div></template>',
    'src/views/order/large.vue': [
      '<template>',
      '  <md-table :columns="columns" :data="data" />',
      '</template>',
      '<script setup>',
      "import { MdTable } from '@/components'",
      "import { useTable } from '@/components/md-table'",
      largeColumns,
      'const { data, columns } = useTable({ api: getLargeList })',
      '</script>',
    ].join('\n'),
    'src/views/order/small.vue': [
      '<template><md-table :columns="columns" :data="data" /></template>',
      '<script setup>',
      "import { MdTable } from '@/components'",
      "import { useTable } from '@/components/md-table'",
      'const { data, columns } = useTable({ api: getSmallList })',
      '</script>',
    ].join('\n'),
  });
  const langchainModel = modelWith(
    [{ role: 'component', path: 'src/components/md-table', keywords: ['md-table'] }],
    '# src/components/md-table\n\n```vue\n<md-table :columns="columns" :data="data" />\n```\n'
  );

  const result = await runRecon(project, { requirement: '添加一个选择记录列表', langchainModel });
  assert.equal(result.reuse.length, 1);
  assert.equal(result.reuse[0].usage.path, 'src/views/order/small.vue');
  fs.rmSync(project.path, { recursive: true, force: true });
});

test('runRecon：命中已有经验包时直接复用，不因文档质量重新取证', async () => {
  const project = mkProject({
    'src/components/md-table/index.vue': '<template><div class="md-table"><slot /></div></template>',
    'src/views/order/list.vue': '<template><md-table /></template>',
  });
  saveComponentExperiences(project, [{
    componentPath: 'src/components/md-table',
    name: 'md-table',
    role: 'component',
    keywords: ['md-table'],
    usagePath: 'src/views/order/list.vue',
    usageFiles: ['src/views/order/list.vue'],
    files: 1,
    doc: [
      '# `src/components/md-table` 最小完整用法',
      '',
      '## 说明',
      '已有经验文档，即使不是完整调用点格式，也应优先复用。',
    ].join('\n'),
  }]);
  const logs = [];
  const result = await runRecon(project, {
    requirement: '添加一个选择记录列表',
    langchainModel: modelWith([
      { role: 'component', path: 'src/components/md-table', keywords: ['md-table'] },
    ]),
    log: line => logs.push(line),
  });
  assert.match(logs.join('\n'), /侦察命中经验清单/);
  assert.doesNotMatch(logs.join('\n'), /侦察用法裁剪输入/);
  assert.equal(result.reuse.length, 1);
  assert.match(result.reuse[0].usage.snippet, /已有经验文档/);
  fs.rmSync(project.path, { recursive: true, force: true });
});

test('runRecon：已有经验包的 evidence 使用文件不存在时判为失效并重新取证', async () => {
  const project = mkProject({
    'src/components/md-table/index.vue': '<template><div class="md-table"><slot /></div></template>',
    'src/views/order/current.vue': [
      '<template><md-table :columns="columns" :data="rows" /></template>',
      '<script setup>',
      "import { useTable } from '@/components/md-table'",
      'const { rows, columns } = useTable({ api: getList })',
      '</script>',
    ].join('\n'),
  });
  saveComponentExperiences(project, [{
    componentPath: 'src/components/md-table',
    name: 'md-table',
    role: 'component',
    keywords: ['md-table'],
    usagePath: 'src/views/order/deleted.vue',
    usageFiles: ['src/views/order/deleted.vue'],
    files: 1,
    doc: '# `src/components/md-table` 最小完整用法\n\n旧文档，但 evidence 已失效。\n',
  }]);
  const logs = [];
  const result = await runRecon(project, {
    requirement: '添加一个选择记录列表',
    log: line => logs.push(line),
    langchainModel: modelWith(
      [{ role: 'component', path: 'src/components/md-table', keywords: ['md-table'] }],
      '# src/components/md-table\n\n```vue\n<md-table :columns="columns" :data="rows" />\n```\n'
    ),
  });
  assert.match(logs.join('\n'), /侦察用法裁剪输入/);
  assert.equal(result.reuse.length, 1);
  assert.equal(result.reuse[0].usage.path, 'src/views/order/current.vue');
  assert.match(logs.join('\n'), /侦察经验清单失效/);
  fs.rmSync(project.path, { recursive: true, force: true });
});

test('extractUsageDoc：从真实业务文件抽公共能力调用点、导入和绑定变量定义', () => {
  const project = mkProject({
    'src/components/md-table/index.vue': '<template><div /></template>',
    'src/views/order/list.vue': [
      '<template>',
      '  <section>',
      '    <md-table',
      '      :columns="columns"',
      '      :data="rows"',
      '      @update:pagination="paginationChange"',
      '    />',
      '  </section>',
      '</template>',
      '<script setup lang="ts">',
      "import { MdTable } from '@/components'",
      "import { useTable } from '@/components/md-table/hooks/useTable'",
      'const { rows, columns, paginationChange } = useTable({',
      '  api: getList,',
      '  columns: [',
      "    { title: '选择时间', key: 'selectTime' },",
      '  ],',
      '})',
      '</script>',
    ].join('\n'),
  });

  const doc = extractUsageDoc(project, {
    capabilityPath: 'src/components/md-table',
    usagePath: 'src/views/order/list.vue',
    terms: ['md-table'],
  });

  assert.ok(doc, '应抽出使用文档');
  assert.match(doc.markdown, /## 调用点/);
  assert.match(doc.markdown, /<md-table/);
  assert.match(doc.markdown, /## 导入依赖/);
  assert.match(doc.markdown, /import \{ MdTable \}/);
  assert.match(doc.markdown, /useTable/);
  assert.match(doc.markdown, /## 绑定变量定义/);
  assert.match(doc.markdown, /const \{ rows, columns, paginationChange \}/);
  fs.rmSync(project.path, { recursive: true, force: true });
});
