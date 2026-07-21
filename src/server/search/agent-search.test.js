'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { fakeModel } = require('langchain');
const { runAgentSearch } = require('./agent-search');
const { createFinalizationMiddleware } = require('./dom-agent/agents/dom-locator-agent');

function fixtureProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-dom-agent-'));
  for (const [filePath, text] of Object.entries(files)) {
    const full = path.join(root, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return {
    path: root,
    kind: 'unknown',
    files: Object.keys(files).map(filePath => ({ path: filePath })),
  };
}

function requestBody(markup, prompt = '@选区1 修改') {
  return {
    adapter: { id: 'fake', name: 'fake', type: 'api' },
    prompt,
    selections: [{
      index: 1,
      element: {
        tag: 'div',
        outerHtml: markup,
        text: markup.replace(/<[^>]+>/g, ' '),
      },
    }],
  };
}

test('DOM Locator uses a LangChain search tool before resolving source', async () => {
  const project = fixtureProject({
    'src/login.vue': '<template><button class="login-submit">登 录</button></template>',
    'src/other.vue': '<template><div>注册</div></template>',
  });
  const model = fakeModel()
    .respondWithTools([{
      id: 'search_1',
      name: 'search_source_evidence',
      args: { anchors: [{ text: '登 录', kind: 'text' }], mode: 'any' },
    }])
    .respondWithTools([{
      id: 'finish_1',
      name: 'finish_dom_location',
      args: {
        status: 'resolved',
        files: [{
          file: 'src/login.vue',
          role: 'render',
          confidence: 96,
          line: 1,
          anchor: '登 录',
          reason: '源码直接生成所选按钮文案',
          snippet: '<button class="login-submit">登 录</button>',
        }],
        relations: [],
        coveredDom: ['登录按钮'],
        missingEvidence: [],
        needMoreDom: false,
        reason: '候选已由源码证据解释选区',
      },
    }]);
  const logs = [];
  const result = await runAgentSearch(project, requestBody('<button><span>登 录</span></button>'), {
    langchainModel: model,
    onLog: log => logs.push(log),
  });
  assert.equal(result.needMoreDom, false);
  assert.equal(result.hits[0].file, 'src/login.vue');
  assert.equal(result.agent.stage, 'dom-locator');
  assert.ok(logs.some(log => log.includes('工具调用：search_source_evidence')));
});

test('DOM Locator preserves complementary files and their source relation', async () => {
  const project = fixtureProject({
    'src/task/index.vue': '<fieldset><legend>执行信息</legend><component /></fieldset>',
    'src/task/subtask.vue': '<Form-item label="执行人"/><Form-item label="反馈附件"/>',
    'src/file-upload.vue': '<div class="file-upload-component">上传附件</div>',
  });
  const model = fakeModel().respondWithTools([{
    id: 'finish_combo',
    name: 'finish_dom_location',
    args: {
      status: 'resolved',
      files: [
        { file: 'src/task/index.vue', role: 'main-render', confidence: 93, reason: '生成外框' },
        { file: 'src/task/subtask.vue', role: 'co-render', confidence: 96, reason: '生成内部字段' },
        { file: 'src/file-upload.vue', role: 'child', confidence: 94, reason: '生成上传区域' },
      ],
      relations: [
        { from: 'src/task/index.vue', to: 'src/task/subtask.vue', type: 'delegates-rendering', evidence: '动态组件证据' },
        { from: 'src/task/subtask.vue', to: 'src/file-upload.vue', type: 'child-render', evidence: '调用上传组件' },
      ],
      coveredDom: ['fieldset 外框', '执行人和反馈附件', '上传附件'],
      missingEvidence: [],
      needMoreDom: false,
      reason: '三个文件共同解释完整 DOM',
    },
  }]);
  const result = await runAgentSearch(project, requestBody('<fieldset><legend>执行信息</legend><label>执行人</label><label>反馈附件</label></fieldset>'), {
    langchainModel: model,
  });
  assert.equal(result.hits.length, 3);
  assert.equal(result.composite.render.file, 'src/task/index.vue');
  assert.deepEqual(result.composite.coRenders.map(item => item.file), ['src/task/subtask.vue']);
  assert.deepEqual(result.composite.children.map(item => item.file), ['src/file-upload.vue']);
  assert.equal(result.composite.relations.length, 2);
});

test('DOM Locator asks for expansion only after the model ends investigation as insufficient', async () => {
  const project = fixtureProject({
    'src/page.vue': '<template><button>登录</button></template>',
  });
  const model = fakeModel().respondWithTools([{
    id: 'finish_expand',
    name: 'finish_dom_location',
    args: {
      status: 'need-more-context',
      files: [],
      relations: [],
      coveredDom: [],
      missingEvidence: ['选区只有运行时值，无法提出可验证的源码假设'],
      needMoreDom: true,
      reason: '需要扩区取得稳定上下文',
    },
  }]);
  const result = await runAgentSearch(project, requestBody('<span>1</span>'), {
    langchainModel: model,
  });
  assert.equal(result.needMoreDom, true);
  assert.equal(result.hits.length, 0);
  assert.equal(result.agent.stage, 'expand-boundary');
});

test('DOM Locator final model round exposes only the finish tool', async () => {
  const middleware = createFinalizationMiddleware(2);
  const tools = [{ name: 'read_file' }, { name: 'finish_dom_location' }];
  const handler = async request => request;
  const first = await middleware.wrapModelCall({ tools, systemPrompt: 'system' }, handler);
  const second = await middleware.wrapModelCall({ tools, systemPrompt: 'system' }, handler);
  assert.deepEqual(first.tools.map(tool => tool.name), ['read_file', 'finish_dom_location']);
  assert.deepEqual(second.tools.map(tool => tool.name), ['finish_dom_location']);
  assert.match(second.systemPrompt, /调查预算上限/);
});
