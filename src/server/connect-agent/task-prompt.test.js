'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildSourceHandoff,
  buildConnectAgentInputLog,
  buildConnectAgentTaskPrompt,
  connectAgentOutputSchema,
  compactUnlocatedEvidence,
} = require('./task-prompt');

test('located task prompt contains only the task and confirmed source locations', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '增加 ROI 列',
    pageUrl: 'https://example.test/data',
    selectionBindings: [{
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
  assert.match(prompt, /src\/StoreTable\.vue/);
  assert.match(prompt, /title: '毛利率'/);
  assert.doesNotMatch(prompt, /Magnus/);
  assert.doesNotMatch(prompt, /importChain/);
  assert.doesNotMatch(prompt, /large investigation payload/);
  assert.doesNotMatch(prompt, /large DOM/);
  assert.doesNotMatch(prompt, /AGENTS\.md/);
});

test('source handoff forwards only the primary address and Locator target snippet', () => {
  const handoff = buildSourceHandoff({
    targets: [{
      file: 'src/PwdForm.vue',
      role: 'main-render',
      line: 31,
      anchor: '登 录',
      reasons: ['按钮属性与选区一致'],
      codeSnippet: '<n-form>large surrounding source</n-form>',
      targetSnippet: '<n-button>登 录</n-button>',
    }, {
      file: 'src/login.vue',
      role: 'assembly',
      reasons: ['装配 PwdForm'],
      codeSnippet: 'unrelated assembly source must not be forwarded',
    }],
    investigation: {
      reason: '登录按钮由 PwdForm 直接渲染。',
      relations: [{
        from: 'src/login.vue',
        to: 'src/PwdForm.vue',
        type: 'renders',
        evidence: '<PwdForm />',
      }],
    },
  });

  assert.deepEqual(handoff, {
    file: 'src/PwdForm.vue',
    line: 31,
    anchor: '登 录',
    targetSnippet: '<n-button>登 录</n-button>',
  });
});

test('source handoff prefers the exact business definition target over a generic renderer', () => {
  const handoff = buildSourceHandoff({
    targets: [
      {
        file: 'src/layout/menu/index.vue',
        role: 'main-render',
        anchor: 'menu options',
      },
      {
        file: 'src/router/modules/data-center.ts',
        role: 'definition',
        line: 14,
        anchor: "title: '经营数据'",
        targetSnippet: "{ title: '经营数据', children: [] }",
      },
    ],
  });

  assert.deepEqual(handoff, {
    file: 'src/router/modules/data-center.ts',
    line: 14,
    anchor: "title: '经营数据'",
    targetSnippet: "{ title: '经营数据', children: [] }",
  });
});

test('located prompt excludes Locator explanations and surrounding source', () => {
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

  assert.match(prompt, /src\/PwdForm\.vue:31/);
  assert.match(prompt, /<n-button>登 录<\/n-button>/);
  assert.doesNotMatch(prompt, /large surrounding source/);
  assert.doesNotMatch(prompt, /src\/login\.vue/);
  assert.doesNotMatch(prompt, /long Locator explanation/);
  assert.doesNotMatch(prompt, /long Locator conclusion/);
  assert.doesNotMatch(prompt, /long relation evidence/);
});

test('same project thread reuses selection meaning without repeating source code', () => {
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
  assert.match(prompt, /经营数据页面的店铺统计表格/);
  assert.doesNotMatch(prompt, /large source snippet/);
  assert.doesNotMatch(prompt, /src\/StoreTable\.vue/);
});

test('a different project thread receives source evidence again', () => {
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

  assert.match(prompt, /src\/StoreTable\.vue/);
  assert.match(prompt, /source evidence/);
});

test('same project thread reuses an unlocated selection meaning without repeating DOM', () => {
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

  assert.match(prompt, /登录页的提交按钮/);
  assert.doesNotMatch(prompt, /large DOM evidence/);
});

test('connect agent output schema restricts meanings to known selections', () => {
  const schema = connectAgentOutputSchema([
    { uid: 'selection_1', binding: {} },
  ], {
    selections: [{ selectionId: 'selection_2' }],
  });
  assert.deepEqual(
    schema.properties.selectionMeanings.items.properties.selectionId.enum,
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

test('unlocated task prompt keeps compact route and DOM facts without project structure', () => {
  const prompt = buildConnectAgentTaskPrompt({
    userInstruction: '修改按钮',
    locatorEvidence: {
      route: { bestPageFile: 'src/login.vue' },
      projectStructure: 'very large project structure',
      selections: [{
        index: 1,
        tag: 'button',
        markup: `<button>${'x'.repeat(13000)}</button>`,
      }],
      captured: {
        apiRequests: Array.from({ length: 20 }, (_, index) => `/api/${index}`),
      },
    },
  });

  assert.match(prompt, /src\/login\.vue/);
  assert.match(prompt, /\[truncated /);
  assert.doesNotMatch(prompt, /very large project structure/);
  assert.doesNotMatch(prompt, /\/api\/19/);
  assert.doesNotMatch(prompt, /Magnus/);
});

test('compactUnlocatedEvidence returns null for missing evidence', () => {
  assert.equal(compactUnlocatedEvidence(null), null);
});
