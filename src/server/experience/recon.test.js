'use strict';

const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanProject } = require('../core/project');
const { parseReconPlan, keywordVariants, runRecon } = require('./recon');

function mkProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return scanProject(root);
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
  const invoke = async (stage, prompt) => {
    assert.equal(stage, 'recon');
    assert.match(prompt, /Structure\.md/);
    assert.doesNotMatch(prompt, /Project\.md 摘要|featureDirectory/); // 不再喂 Project.md / 功能目录
    return JSON.stringify([
      { role: 'component', path: 'src/components/md-table', keywords: ['md-table'], explain: '表格' },
    ]);
  };
  const result = await runRecon(project, { requirement: '添加一个选择记录列表', invoke });
  assert.equal(result.reuse.length, 1);
  const md = result.reuse[0];
  assert.equal(md.path, 'src/components/md-table');
  assert.equal(md.usage.path, 'src/views/order/list.vue', '用法样例应是用它的业务页，不是它自身');
  assert.match(md.usage.snippet, /<md-table/);
  assert.match(md.usage.snippet, /import \{ MdTable \}/, '变体 MdTable 命中，抽到 import 行');
  assert.match(md.usage.snippet, /useTable\(/);
  fs.rmSync(project.path, { recursive: true, force: true });
});
