'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { fakeModel } = require('langchain');
const { scanProject } = require('../../core/project');
const {
  buildFallbackPlan,
  buildPlanningInput,
  createExpandScopeTool,
  createPlanningExperienceWindowMiddleware,
  createScopeGateMiddleware,
  hydratePlanningSources,
  isToolGated,
  runPlanningAgent,
} = require('./index');

const RESEARCH_TOOLS = new Set([
  'search_text', 'search_source_evidence', 'find_files', 'find_symbol',
  'find_imports', 'find_importers', 'trace_file_evidence_flow',
  'find_related_examples', 'consult_project_knowledge', 'recon_inspect', 'recon_search',
]);
// skills 也在 builtinToolNames 内（provider builtin.skills，名字 skill__*），故与精读工具一样常开。
const BUILTIN_TOOLS = new Set(['read_file', 'inspect_symbol_occurrences', 'read_closed_blocks', 'skill__do_change', ...RESEARCH_TOOLS]);

test('isToolGated hides research + MCP by default, keeps precise-read / skills / expand_scope', () => {
  const escalation = { expanded: false };
  const ctx = { escalation, researchTools: RESEARCH_TOOLS, builtinToolNames: BUILTIN_TOOLS };
  assert.strictEqual(isToolGated('read_file', ctx), false, 'precise read always available');
  assert.strictEqual(isToolGated('skill__do_change', ctx), false, 'skills always available');
  assert.strictEqual(isToolGated('expand_scope', ctx), false, 'escalation entry always available');
  assert.strictEqual(isToolGated('consult_project_knowledge', ctx), true, 'research gated');
  assert.strictEqual(isToolGated('search_text', ctx), true, 'research gated');
  assert.strictEqual(isToolGated('get-library-docs', ctx), true, 'MCP/dynamic gated');
});

test('isToolGated reveals everything after a single expand_scope escalation', () => {
  const escalation = { expanded: true };
  const ctx = { escalation, researchTools: RESEARCH_TOOLS, builtinToolNames: BUILTIN_TOOLS };
  assert.strictEqual(isToolGated('search_text', ctx), false, 'research revealed');
  assert.strictEqual(isToolGated('get-library-docs', ctx), false, 'MCP revealed');
});

test('createScopeGateMiddleware exposes native wrapModelCall + wrapToolCall hooks', () => {
  const middleware = createScopeGateMiddleware({ expanded: false }, {
    researchTools: RESEARCH_TOOLS,
    builtinToolNames: BUILTIN_TOOLS,
  });
  assert.strictEqual(middleware.name, 'PlanningScopeGate');
  assert.strictEqual(typeof middleware.wrapModelCall, 'function');
  assert.strictEqual(typeof middleware.wrapToolCall, 'function');
});

test('expand_scope tool flips the single expanded flag with a reason', async () => {
  const escalation = { expanded: false };
  const expandTool = createExpandScopeTool(escalation);
  await expandTool.invoke({ reason: '需检查其它页面是否有同名 label 要同步改' });
  assert.strictEqual(escalation.expanded, true);
});

test('buildFallbackPlan synthesizes a minimal plan from located sources (never hard-fails)', () => {
  const plan = buildFallbackPlan({
    requirement: '执行人 label加粗',
    locatedSources: [
      { file: 'src/b-components/task-manage/index.vue', role: 'container', confidence: 100, codeSnippet: '<legend>执行信息</legend>' },
      { file: 'src/b-components/task-manage/common@2x/subtask.vue', role: 'main-render', confidence: 100, line: 23, anchor: '<Form-item label="执行人" required>', codeSnippet: '<Modal title="执行费用">...' },
    ],
  });
  assert.strictEqual(plan.status, 'needs_confirmation');
  assert.strictEqual(plan.targets.length, 1);
  // 选 render 角色的文件作为目标
  assert.strictEqual(plan.targets[0].file, 'src/b-components/task-manage/common@2x/subtask.vue');
  // 用 DOM Locator 的精确锚点/行号，而不是代码片段首行的 <Modal>
  assert.strictEqual(plan.targets[0].anchor, '<Form-item label="执行人" required>');
  assert.strictEqual(plan.targets[0].line, 23);
  assert.ok(plan.targets[0].whatToChange.includes('执行人 label加粗'));
  assert.ok(plan.summary.includes('执行人 label加粗'));
  assert.ok(plan.risks.some(r => r.includes('人工确认')));
});

test('buildFallbackPlan degrades to requirement-only plan when no located sources', () => {
  const plan = buildFallbackPlan({ requirement: '改点东西', locatedSources: [] });
  assert.strictEqual(plan.targets.length, 0);
  assert.ok(plan.summary.length > 0);
});

test('buildFallbackPlan emits an add-sibling skeleton for definition-driven change with a reference example', () => {
  const plan = buildFallbackPlan({
    requirement: '给经营数据下加一个腾讯经营数据菜单',
    locatedSources: [
      { file: 'src/router/modules/data-center.ts', role: 'definition', confidence: 100, line: 14, anchor: "title: '经营数据'" },
      { file: 'src/layout/menu/index.vue', role: 'main-render', confidence: 98 },
    ],
    referenceExamples: [
      { file: 'src/views/data-center/operation-data/dy-shop-data/index.vue', role: 'reference-example' },
    ],
  });
  assert.strictEqual(plan.status, 'needs_confirmation');
  // 落点是 definition 文件，不是通用渲染器
  assert.strictEqual(plan.targets[0].file, 'src/router/modules/data-center.ts');
  // 兄弟模板作为复用线索 + 待确认项带出，而不是把需求原文塞进 whatToChange
  assert.ok(plan.reusePatterns.some(pattern => pattern.includes('dy-shop-data')));
  assert.ok(plan.affected.some(item => item.file.includes('dy-shop-data')));
  assert.ok(plan.questions.length >= 1);
  assert.ok(plan.summary.includes('新建同级实现'));
});

function write(root, file, content) {
  const absolute = path.join(root, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

function structuredArgs() {
  return {
    status: 'ready',
    understanding: '所选字段已经定位到目标源码片段',
    summary: '调整所选字段的展示样式',
    targets: [{
      file: 'src/form.js',
      anchor: 'priceField',
      line: 8,
      whatToChange: '调整 priceField 对应标签的展示样式',
      why: '用户要求修改所选标签',
    }],
    affected: [],
    reusePatterns: [],
    risks: [],
    verification: ['确认目标字段展示符合需求'],
    questions: [],
    confirmedFacts: ['DOM Locator 已确认目标文件和片段'],
    assumptions: [],
    usedCapabilities: [],
  };
}

test('buildPlanningInput only carries located evidence and requirement', () => {
  const investigation = { status: 'resolved', reason: 'matched', relations: [] };
  const input = buildPlanningInput({
    pagePath: '/form',
    originSelections: [{ token: '@选区1', text: '价格' }],
    searchPayload: { userPrompt: '@选区1 修改样式' },
  }, [{
    file: 'src/form.js',
    sourceRole: 'render',
    codeSnippet: 'priceField',
    sourceInvestigation: investigation,
  }]);
  assert.equal(input.requirement, '@选区1 修改样式');
  assert.equal(input.locatedSources[0].file, 'src/form.js');
  assert.equal(input.investigations[0].status, 'resolved');
  assert.equal(Object.hasOwn(input, 'projectContext'), false);
  assert.equal(Object.hasOwn(input, 'recon'), false);
});

test('hydratePlanningSources includes complete located files before the first model call', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'planning-source-'));
  write(root, 'src/form.js', 'const priceField = "价格";\nexport default priceField;');
  const project = scanProject(root);
  const input = buildPlanningInput({}, [{ file: 'src/form.js', codeSnippet: 'priceField' }]);
  const hydrated = hydratePlanningSources(project, input);

  assert.equal(hydrated.input.locatedSources[0].sourceContent.complete, true);
  assert.match(hydrated.input.locatedSources[0].sourceContent.content, /1: const priceField/);
  assert.equal(hydrated.completeFiles.has('src/form.js'), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('Planning experience tools are exposed for one model round only', async () => {
  const logs = [];
  const middleware = createPlanningExperienceWindowMiddleware(line => logs.push(line));
  const request = {
    tools: [
      { name: 'read_file' },
      { name: 'recon_inspect' },
      { name: 'recon_search' },
    ],
  };
  const handler = async value => value.tools.map(tool => tool.name);

  assert.deepEqual(await middleware.wrapModelCall(request, handler), [
    'read_file',
    'recon_inspect',
    'recon_search',
  ]);
  assert.deepEqual(await middleware.wrapModelCall(request, handler), ['read_file']);
  assert.equal(logs.length, 1);
});

test('Planning Agent can finish directly without invoking Recon or source tools', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'planning-'));
  write(root, 'src/form.js', 'const priceField = "价格";');
  const project = scanProject(root);
  const model = fakeModel().respondWithTools([{
    id: 'final_plan',
    name: 'magnus_change_plan',
    args: structuredArgs(),
  }]);
  const logs = [];
  const result = await runPlanningAgent(project, {
    langchainModel: model,
    body: {
      pagePath: '/form',
      originSelections: [{ token: '@选区1', text: '价格' }],
      searchPayload: { userPrompt: '@选区1 修改样式' },
    },
    modelItems: [{
      file: 'src/form.js',
      sourceRole: 'render',
      locateLevel: 'exact',
      codeSnippet: 'const priceField = "价格";',
      sourceInvestigation: { status: 'resolved', reason: 'matched' },
      confidence: 100,
    }],
    log: line => logs.push(line),
  });
  assert.equal(result.mode, 'langchain-planning-agent');
  assert.equal(result.planning.status, 'ready');
  assert.equal(result.changePlan.targets[0].file, 'src/form.js');
  assert.ok(!logs.some(line => line.includes('Planning Agent Tool →')));
  fs.rmSync(root, { recursive: true, force: true });
});
