'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildConnectAgentInputLog,
  buildConnectAgentTaskPrompt,
  connectAgentInitialInstructions,
  connectAgentOutputSchema,
} = require('./task-prompt');

test('located task prompt contains only the task and a stable selection reference', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '增加 ROI 列',
    pageUrl: 'https://example.test/data',
    selectionBindings: [{
      uid: 'selection_1',
      binding: {
        targets: [{
          file: 'src/StoreTable.vue',
          role: 'render',
          targetSnippet: "title: '毛利率'",
          importChain: ['src/index.vue', 'src/StoreTable.vue'],
          reasons: ['命中文案'],
        }],
        investigation: { summary: 'large investigation payload' },
        originSelections: [{ markup: '<table>large DOM</table>' }],
      },
    }],
  });

  assert.match(prompt, /增加 ROI 列/);
  assert.match(prompt, /本轮选区：\n@selection_1/);
  assert.doesNotMatch(prompt, /@选区\d+/);
  assert.match(prompt, /\.gocapture\/selections\/selection_1\.json/);
  assert.match(prompt, /不要在项目外搜索选区 ID/);
  assert.doesNotMatch(prompt, /src\/StoreTable\.vue/);
  assert.doesNotMatch(prompt, /title: '毛利率'/);
  assert.doesNotMatch(prompt, /GoCapture/);
  assert.doesNotMatch(prompt, /importChain/);
  assert.doesNotMatch(prompt, /large investigation payload/);
  assert.doesNotMatch(prompt, /large DOM/);
  assert.doesNotMatch(prompt, /AGENTS\.md/);
});

test('located prompt keeps only the selection id and excludes Locator evidence', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '@选区1 文案加粗',
    selectionBindings: [{
      uid: 'selection_1',
      binding: {
        targets: [{
          file: 'src/PwdForm.vue',
          role: 'main-render',
          line: 31,
          anchor: '登 录',
          targetSnippet: '<n-button>登 录</n-button>',
          codeSnippet: 'large surrounding source',
          reasons: ['long Locator explanation'],
        }, {
          file: 'src/login.vue',
          role: 'assembly',
          codeSnippet: 'assembly source',
        }],
        investigation: {
          reason: 'long Locator conclusion',
          relations: [{
            from: 'src/login.vue',
            to: 'src/PwdForm.vue',
            type: 'renders',
            evidence: 'long relation evidence',
          }],
        },
      },
    }],
  });

  assert.match(prompt, /需求：\n@selection_1 文案加粗/);
  assert.match(prompt, /本轮选区：\n@selection_1/);
  assert.doesNotMatch(prompt, /@选区\d+/);
  assert.match(prompt, /\.gocapture\/selections\/selection_1\.json/);
  assert.doesNotMatch(prompt, /src\/PwdForm\.vue:31/);
  assert.doesNotMatch(prompt, /<n-button>登 录<\/n-button>/);
  assert.doesNotMatch(prompt, /large surrounding source/);
  assert.doesNotMatch(prompt, /src\/login\.vue/);
  assert.doesNotMatch(prompt, /long Locator explanation/);
  assert.doesNotMatch(prompt, /long Locator conclusion/);
  assert.doesNotMatch(prompt, /long relation evidence/);
});

test('agent prompt replaces frontend selection aliases with stable selection ids', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '@选区3 修改标题，@选区1 调整按钮',
    selectionBindings: [{
      uid: 'selection_title',
      index: 3,
      token: '@选区3',
      binding: { targets: [{ file: 'src/title.ts', line: 3 }] },
    }, {
      uid: 'selection_button',
      index: 1,
      token: '@选区1',
      binding: { targets: [{ file: 'src/button.ts', line: 8 }] },
    }],
  });

  assert.match(prompt, /@selection_title 修改标题，@selection_button 调整按钮/);
  assert.match(prompt, /本轮选区：\n@selection_title/);
  assert.match(prompt, /@selection_button/);
  assert.doesNotMatch(prompt, /@选区\d+/);
});

test('same project thread sends only the stable selection id', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '继续增加状态列',
    projectSession: {
      threadId: 'thread_project',
      selections: {
        selection_1: {
          threadId: 'thread_project',
          meaning: '经营数据页面的店铺统计表格',
        },
      },
    },
    selectionBindings: [{
      uid: 'selection_1',
      binding: {
        targets: [{
          file: 'src/StoreTable.vue',
          codeSnippet: 'large source snippet',
        }],
        agentContext: {
          threadId: 'thread_project',
          meaning: '经营数据页面的店铺统计表格',
        },
      },
    }],
  });

  assert.match(prompt, /selection_1/);
  assert.doesNotMatch(prompt, /经营数据页面的店铺统计表格/);
  assert.doesNotMatch(prompt, /large source snippet/);
  assert.doesNotMatch(prompt, /src\/StoreTable\.vue/);
});

test('a different project thread still resolves evidence from the local reference file', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '继续修改',
    projectSession: {
      threadId: 'thread_new',
      selections: {
        selection_1: {
          threadId: 'thread_old',
          meaning: '店铺统计表格',
          source: {
            targets: [{
              file: 'src/StoreTable.vue',
              targetSnippet: 'source evidence',
            }],
          },
        },
      },
    },
    selectionBindings: [{
      uid: 'selection_1',
      binding: {
        targets: [{
          file: 'src/StoreTable.vue',
          targetSnippet: 'source evidence',
        }],
        agentContext: {
          threadId: 'thread_old',
          meaning: '店铺统计表格',
        },
      },
    }],
  });

  assert.match(prompt, /本轮选区：\n@selection_1/);
  assert.doesNotMatch(prompt, /@选区\d+/);
  assert.doesNotMatch(prompt, /src\/StoreTable\.vue/);
  assert.doesNotMatch(prompt, /source evidence/);
});

test('an unlocated selection sends compressed DOM directly to the Agent', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '继续调整这一块',
    projectSession: {
      threadId: 'thread_project',
      selections: {
        selection_1: {
          threadId: 'thread_project',
          meaning: '登录页的提交按钮',
        },
      },
    },
    locatorEvidence: {
      selections: [{
        selectionId: 'selection_1',
        markup: '<button>large DOM evidence</button>',
      }],
    },
  });

  assert.match(prompt, /本轮选区：\n@selection_1/);
  assert.doesNotMatch(prompt, /@选区\d+/);
  assert.doesNotMatch(prompt, /登录页的提交按钮/);
  assert.match(prompt, /large DOM evidence/);
  assert.doesNotMatch(prompt, /位置文件：/);
});

test('an id-only binding and runtime DOM collapse into one stable reference', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '文案加粗',
    selectionBindings: [{
      uid: 'selection_1',
      binding: { targets: [] },
    }],
    locatorEvidence: {
      selections: [{
        selectionId: 'selection_1',
        tag: 'button',
        text: '登 录',
        markup: '<button><span>登 录</span></button>',
      }],
    },
  });

  assert.match(prompt, /本轮选区：\n@selection_1/);
  assert.doesNotMatch(prompt, /@选区\d+/);
  assert.match(prompt, /<button><span>登 录<\/span><\/button>/);
  assert.doesNotMatch(prompt, /@selection_1 → -/);
});

test('connect agent output schema restricts locations to known selections', () => {
  const schema = connectAgentOutputSchema([
    { uid: 'selection_1', binding: {} },
  ], {
    selections: [{ selectionId: 'selection_2' }],
  });
  assert.deepEqual(
    schema.properties.selectionLocations.items.properties.selectionId.enum,
    ['selection_1', 'selection_2'],
  );
});

test('connect agent input log contains the exact provider prompt and output contract', () => {
  const prompt = '请修改 src/StoreTable.vue';
  const outputSchema = {
    type: 'object',
    required: ['summary'],
  };
  const log = buildConnectAgentInputLog({
    providerId: 'codex',
    projectRoot: '/tmp/project',
    threadId: 'thread_1',
    prompt,
    outputSchema,
  });

  assert.match(log, /^Agent 模型输入上下文：/);
  assert.match(log, /"provider": "codex"/);
  assert.match(log, /"thread": "thread_1"/);
  assert.match(log, /请修改 src\/StoreTable\.vue/);
  assert.match(log, /Structured output schema:/);
  assert.match(log, /"required": \[\s*"summary"/);
});

test('new thread input log shows the one-time selection reference protocol', () => {
  const log = buildConnectAgentInputLog({
    providerId: 'codex',
    projectRoot: '/tmp/project',
    initialInstructions: connectAgentInitialInstructions(),
    prompt: '修改',
    outputSchema: {},
  });

  assert.match(log, /Thread 初始化指令:/);
  assert.match(log, /\.gocapture\/selections\/<selectionId>\.json/);
});

test('unlocated task prompt embeds bounded DOM but excludes unrelated project evidence', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '修改按钮',
    locatorEvidence: {
      route: { bestPageFile: 'src/login.vue' },
      projectStructure: 'very large project structure',
      selections: [{
        selectionId: 'selection_1',
        index: 1,
        tag: 'button',
        markup: `<button>${'x'.repeat(13000)}</button>`,
      }],
      captured: {
        apiRequests: Array.from({ length: 20 }, (_, index) => `/api/${index}`),
      },
    },
  });

  assert.match(prompt, /本轮选区：\n@selection_1/);
  assert.doesNotMatch(prompt, /@选区\d+/);
  assert.doesNotMatch(prompt, /src\/login\.vue/);
  assert.match(prompt, /"markup": "<button>x+/);
  assert.doesNotMatch(prompt, /very large project structure/);
  assert.doesNotMatch(prompt, /\/api\/19/);
  assert.doesNotMatch(prompt, /GoCapture/);
});
