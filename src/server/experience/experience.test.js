const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AIMessage, fakeModel } = require('langchain');
const { scanProject } = require('../core/project');
const { enhanceLocatedPrompt } = require('./prompt-enhancer');
const { listAgentTools, executeAgentTool } = require('../agent-host/tools/registry');

function write(root, file, content) {
  const absolute = path.join(root, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

// 新经验流程：侦察（找项目已有同类实现）→ 照先例产计划。不再匹配/蒸馏/保存经验文档。
async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-'));
  write(root, 'src/components/md-table/index.vue', '<template><div class="md-table"><slot /></div></template>\n<script>export function useTable(){}</script>');
  write(root, 'src/views/order/list.vue', '<template><md-table :columns="c" /></template>\n<script>import { MdTable, useTable } from "@/components/md-table"</script>');
  write(root, 'src/hooks/authority/index.ts', 'export function useAuthority(){ return {} }');
  const project = scanProject(root);
  const langchainModel = fakeModel()
    .respond(new AIMessage(JSON.stringify([
      { role: 'component', path: 'src/components/md-table', keywords: ['md-table'], explain: '表格' },
    ])))
    .respond(new AIMessage('# src/components/md-table\n\n```vue\n<md-table :columns="c" />\n```\n'))
    .respond(new AIMessage(JSON.stringify({
      changePlan: {
        selectionUnderstanding: 'order/list 页新增记录表格',
        summary: '照项目 md-table 新增记录表格',
        targets: [{ file: 'src/views/order/list.vue', anchor: 'md-table', line: 0, whatToChange: '用 md-table + useTable 新增记录表格', why: '需求' }],
        affected: [], reusePatterns: ['复用 md-table + useTable'], risks: [], verification: [], openQuestions: [],
      },
      confirmedFacts: [], assumptions: [],
    })));

  const logs = [];
  const result = await enhanceLocatedPrompt({
    project,
    body: {
      pagePath: '/order',
      searchPayload: { url: 'http://localhost/order', userPrompt: '在这个页面加一个记录表格', selectionInstructions: [] },
    },
    modelItems: [{ file: 'src/views/order/list.vue', locateLevel: 'exact', codeSnippet: '<md-table />', directionGuess: '', prompt: 'x', confidence: 100 }],
    log: message => logs.push(message),
    toolRuntime: { listTools: listAgentTools, executeTool: executeAgentTool },
    langchainModel,
  });

  assert.equal(result.mode, 'recon');
  assert.ok(result.changePlan.targets.length >= 1);
  assert.equal(result.changePlan.targets[0].file, 'src/views/order/list.vue');
  assert.ok(
    result.recon.reuse.some(item => item.path.includes('md-table')),
    'recon.reuse 应包含项目公共件 md-table'
  );
  assert.ok(logs.some(line => line.includes('实现侦察')));
  fs.rmSync(root, { recursive: true, force: true });
}

run().then(() => {
  console.log('experience tests passed');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});

(function changePlanHelperChecks() {
  const { normalizeChangePlan, changePlanToText, changePlanMatchesRoughSource } = require('./prompt-enhancer');

  // normalize: 缺字段/脏类型 → 结构齐备
  const plan = normalizeChangePlan({
    summary: '  改成本单元格  ',
    targets: [{ file: 'src/columns.tsx', anchor: '点击设置', line: '15', whatToChange: '改文案', why: '需求' }, { file: '' }],
    affected: [{ file: 'src/types.ts', reason: '类型' }, {}],
    reusePatterns: ['复用 useTable', ''],
    risks: [{ risk: '可能影响提交参数', mitigation: '检查接口 payload' }],
    verification: [{ step: '构建通过' }],
    openQuestions: [{ question: '是否需要必填校验？' }],
  });
  assert.equal(plan.summary, '改成本单元格');
  assert.equal(plan.targets.length, 1);
  assert.equal(plan.targets[0].line, 15);
  assert.equal(plan.affected.length, 1);
  assert.deepEqual(plan.reusePatterns, ['复用 useTable']);
  assert.deepEqual(plan.risks, ['可能影响提交参数']);
  assert.deepEqual(plan.verification, ['step: 构建通过']);
  assert.deepEqual(plan.openQuestions, ['是否需要必填校验？']);

  // 派生文本包含关键信息
  const text = changePlanToText(plan, { userRequirement: 'x' });
  assert.match(text, /修改计划/);
  assert.match(text, /src\/columns\.tsx:15/);
  assert.match(text, /点击设置/);

  // 护栏：粗定位源码有 ≥3 锚点时，计划必须引用其中 ≥2，否则视为跑偏
  const task = { targets: [{ file: 'src/columns.tsx', codeSnippet: 'renderCostCell useTable NButton clickSetup' }] };
  const good = normalizeChangePlan({ summary: '', targets: [{ file: 'src/columns.tsx', whatToChange: '在 renderCostCell 用 useTable 调整 NButton' }] });
  const bad = normalizeChangePlan({ summary: '', targets: [{ file: 'src/other.vue', whatToChange: '改了别的无关内容' }] });
  assert.equal(changePlanMatchesRoughSource(task, good), true);
  assert.equal(changePlanMatchesRoughSource(task, bad), false);
  console.log('changePlan helper checks passed');
})();

(function roughTaskOriginSelectionCheck() {
  const { roughTask, buildChangePlanPrompt } = require('./prompt-enhancer');
  // 扩区后 selectionInstructions 只剩「删除选区」；但 body.originSelections 保住了扩区前的原始选区 ¥3。
  const body = {
    searchPayload: { url: 'http://x', userPrompt: '@选区1 删除选区', selectionInstructions: [{ index: 1, instruction: '删除选区' }] },
    originSelections: [{ token: '@选区1', tag: 'div', text: '¥3', className: '', attrs: { style: 'color: rgb(153, 153, 153)' }, ancestors: 'td[data-col-key=cost] > div', summary: '¥3' }],
  };
  const task = roughTask(body, [{ file: 'src/index.vue', codeSnippet: 'region', scopeAlignment: 'approximate' }]);
  assert.equal(task.selections[0].text, '¥3');                       // 原始选区优先于指令文本
  assert.equal(task.selections[0].ancestors, 'td[data-col-key=cost] > div');
  const prompt = buildChangePlanPrompt({ roughTask: task, targetFiles: [], recon: {} });
  assert.ok(prompt.includes('¥3'));                                  // 变更计划 LLM 能看到用户到底选了什么
  assert.ok(prompt.includes('data-col-key=cost'));
  // 没有 originSelections 时退回指令文本，不报错
  const fallback = roughTask({ searchPayload: { selectionInstructions: [{ index: 1, instruction: 'x' }] } }, []);
  assert.equal(fallback.selections[0].instruction, 'x');
  console.log('roughTask origin-selection checks passed');
})();
