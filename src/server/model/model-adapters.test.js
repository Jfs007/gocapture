const assert = require('node:assert/strict');
const test = require('node:test');
const { buildModelPrompt } = require('./model-adapters');

test('model locate prompt only contains candidate hits, concise selection and requirement', () => {
  const project = {
    path: '/tmp/project',
    kind: 'vue-vite',
    stackText: 'Vue / Vite',
  };
  const body = {
    searchPayload: {
      userPrompt: '@选区1 增加批量添加操作',
      selectionInstructions: [{ index: 1, instruction: '增加批量添加操作' }],
      selections: [{
        index: 1,
        element: {
          tag: 'div',
          className: 'md-batch-action-bar md-batch-action-bar active',
          text: '批量分配运营 批量一键投放 批量删除',
          attrs: {
            'data-v-1234abcd': '',
            'aria-describedby': 'runtime-abcdef123',
            title: '这是一个超过十个字符的属性文案',
          },
          subtree: {
            nodes: Array.from({ length: 6 }, () => ({
              tag: 'button',
              className: 'n-button n-button--small',
              text: '批量删除',
            })),
          },
        },
      }],
    },
    candidateHits: [{
      file: 'src/page.vue',
      score: 800,
      reasons: ['文案同文件命中', 'class 同文件命中'],
    }],
    selectedCandidateHits: [{
      file: 'src/page.vue',
      score: 800,
      reasons: ['文案同文件命中'],
    }],
  };

  const prompt = buildModelPrompt(project, body, new Map(), null, {
    files: [{
      file: 'src/page.vue',
      text: '// selection/code anchor\n<button>批量删除</button>',
      rawLength: 1000,
      tokenEstimate: 20,
      mode: 'pruned-chain',
    }],
  });

  assert.match(prompt, /按照给定结构化响应格式返回复核结果/);
  assert.match(prompt, /候选文件:/);
  assert.match(prompt, /选区摘要:/);
  assert.match(prompt, /需求: @选区1 增加批量添加操作/);
  assert.match(prompt, /src\/page\.vue/);
  assert.match(prompt, /这是一个超过十个字符的属性文案/);
  assert.doesNotMatch(prompt, /data-v-1234abcd/);
  assert.doesNotMatch(prompt, /aria-describedby/);
  assert.doesNotMatch(prompt, /selection\/code anchor/);
  assert.doesNotMatch(prompt, /接口引用链|国际化线索|候选文件摘要|推测方向|code片段/);
  assert.ok(prompt.length < 1800);
});
