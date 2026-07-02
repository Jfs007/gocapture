const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  compressDomMarkup,
  analyzeEvidenceSufficiency,
  domAgentTrigger,
  executeSearchPlan,
  filterFollowUpSearchesByEvidence,
  inspectCandidates,
  resolveByRouteRelation,
  runAgentSearch,
  traceRouteCandidateRelations,
  validateJudgeRouteDecision,
} = require('./agent-search');
const {
  buildLocatorSystemPrompt,
  buildLocatorUserInput,
  normalizeLocatorDecision,
  validateLocatorDecision,
  locatorDecisionToSearchPlan,
} = require('./locator-protocol');

function fixtureProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-agent-search-'));
  const projectFiles = [];
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    projectFiles.push({
      path: file,
      size: Buffer.byteLength(content),
      mtimeMs: Date.now(),
    });
  }
  return {
    name: 'fixture',
    path: root,
    kind: 'unknown',
    stack: [],
    files: projectFiles,
  };
}

test('locator protocol accepts explicit search plans from the model', () => {
  const decision = normalizeLocatorDecision({
    status: 'ready',
    understanding: {
      userTarget: '修改供应来源输入框',
      selectedDomAnchors: ['data-col-key=source', 'placeholder=请输入供应来源'],
    },
    evidenceAssessment: { sufficient: true },
    nextPlan: [{
      id: 'p1',
      capability: 'locate-structure',
      searches: [{
        keywords: ['source', '请输入供应来源'],
        mode: 'all',
        range: 'same-structure',
        reason: '验证列 key 和 placeholder 是否在同一渲染结构中出现',
      }],
      relation: 'same-rendering-context',
      scopeHint: 'route-entry-first',
      purpose: '验证列 key 和 placeholder 是否在同一渲染结构中出现',
    }],
  });
  const validation = validateLocatorDecision(decision);
  assert.equal(validation.valid, true);

  const plan = locatorDecisionToSearchPlan(decision);
  assert.deepEqual(plan.searches[0].keywords, ['source', '请输入供应来源']);
  assert.equal(plan.searches[0].range, 'same-structure');

  const invalid = validateLocatorDecision(normalizeLocatorDecision({
    status: 'ready',
    nextPlan: [{
      capability: 'locate-structure',
      relation: 'same-scope',
    }],
  }));
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join('\n'), /searches\.keywords/);
});

test('locator prompt distinguishes container descendant text from structural anchors', () => {
  const prompt = buildLocatorSystemPrompt();
  assert.match(prompt, /后代文本的扁平汇总/);
  assert.match(prompt, /<magnus-repeat>/);
  assert.match(prompt, /componentChain 中即使 file 为空/);
  assert.match(prompt, /mode=any 只用于同一语义锚点的替代写法/);
  assert.match(prompt, /页面路由只提供页面范围/);
});

test('locator resolve-route plan asks for more DOM instead of searching runtime evidence', () => {
  const decision = normalizeLocatorDecision({
    status: 'need-more-context',
    nextPlan: [{
      capability: 'expand-dom',
      relation: 'same-rendering-context',
      scopeHint: 'route-entry-first',
      purpose: '当前选区只有运行时选中值，需要扩区',
    }],
  });
  const validation = validateLocatorDecision(decision);
  assert.equal(validation.valid, true);
  const plan = locatorDecisionToSearchPlan(decision);
  assert.deepEqual(plan.searches, []);
  assert.equal(plan.needMoreDom, true);
});

test('locator planner input carries Project.md tech stack context', () => {
  const input = buildLocatorUserInput({
    project: {
      context: {
        technicalStackMarkdown: '## 技术栈\n- Vue\n- Naive UI',
      },
    },
    body: {
      userPrompt: '按钮加粗',
      pagePath: '/demo',
    },
    routeTrace: {
      matched: true,
      bestPageFile: 'src/views/demo.vue',
      hits: [{ file: 'src/views/demo.vue', routePath: '/demo', reasons: ['路径精确匹配'] }],
    },
    domSelections: [{
      index: 1,
      tag: 'button',
      markup: '<button>提交</button>',
      rawMarkupLength: 19,
      compressedMarkupLength: 19,
      compression: { enabled: false, repeatedGroupCount: 0, repeatedGroups: [] },
    }],
  });
  assert.equal(input.techStack.markdown, '## 技术栈\n- Vue\n- Naive UI');
  assert.equal(input.pageContext.route.bestPageFile, 'src/views/demo.vue');
  assert.equal(Object.prototype.hasOwnProperty.call(input, 'selectionFacts'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(input, 'evidenceCatalog'), false);
  assert.ok(input.domSelections[0].markup.includes('<button>提交</button>'));
});

test('compress DOM collapses repeated sibling structures and keeps stable anchors', () => {
  const markup = [
    '<div class="panel">',
    '<div class="row"><a href="/a">Alpha</a></div>',
    '<div class="row"><a href="/b">Beta</a></div>',
    '<div class="row"><a href="/c">Gamma</a></div>',
    '<div class="row"><a href="/d">Delta</a></div>',
    '</div>',
  ].join('');
  const result = compressDomMarkup(markup);
  assert.equal(result.enabled, true);
  assert.ok(result.markup.includes('/a'));
  assert.ok(result.markup.includes('/b'));
  assert.ok(result.markup.includes('magnus-repeat'));
  assert.ok(!result.markup.includes('href="/d"'));
  assert.equal(result.repeatedGroups[0].count, 4);
});

test('compress DOM repeat summary keeps descendant attribute anchors and drops runtime ids', () => {
  const markup = [
    '<div data-n-id="ce167487">',
    '<div class="cell" aria-labelledby="e3e85ba9"><a href="/one" data-col-key="name">Name</a></div>',
    '<div class="cell" aria-labelledby="e3e85ba9"><a href="/two" data-col-key="cost">Cost</a></div>',
    '<div class="cell" aria-labelledby="e3e85ba9"><a href="/three" data-col-key="status">Status</a></div>',
    '</div>',
  ].join('');
  const result = compressDomMarkup(markup);
  assert.ok(result.markup.includes('href=/one'));
  assert.ok(result.markup.includes('data-col-key=name'));
  assert.ok(result.markup.includes('href=/three'));
  assert.ok(!result.markup.includes('ce167487'));
  assert.ok(!result.markup.includes('e3e85ba9'));
});

test('compress DOM keeps distinct selected item when repeated structure differs', () => {
  const markup = [
    '<div class="children">',
    '<div class="item"><a href="/index">腾讯广告3.0</a></div>',
    '<div class="item"><a href="/ads-ks-cid">快手CID</a></div>',
    '<div class="item selected"><a href="/ks-niu"><span>磁力金牛</span><em>全站|标准</em></a></div>',
    '<div class="item"><a href="/ads-dy-qc">巨量千川</a></div>',
    '<div class="item"><a href="/ks-dr">磁力达人</a></div>',
    '</div>',
  ].join('');
  const result = compressDomMarkup(markup);
  assert.ok(result.markup.includes('腾讯广告3.0'));
  assert.ok(result.markup.includes('快手CID'));
  assert.ok(result.markup.includes('磁力金牛'));
  assert.ok(result.markup.includes('全站|标准'));
  assert.ok(result.markup.includes('magnus-repeat'));
});

test('DOM Agent triggers when the component chain has no project file', () => {
  const project = fixtureProject({
    'src/Page.vue': '<template><div /></template>',
  });
  const trigger = domAgentTrigger({
    selections: [{
      element: {
        outerHtml: '<div class="target"></div>',
      },
      sourceLocate: {
        componentChain: [{ file: '/missing/Page.vue' }],
      },
    }],
  }, { project, threshold: 8000 });
  assert.equal(trigger.enabled, true);
  assert.equal(trigger.missingComponentFile, true);
});

test('DOM Agent triggers for oversized DOM even with a resolved component file', () => {
  const project = fixtureProject({
    'src/Page.vue': '<template><div /></template>',
  });
  const trigger = domAgentTrigger({
    selections: [{
      element: {
        rawOuterHtml: `<div>${'x'.repeat(9000)}</div>`,
      },
      sourceLocate: {
        componentChain: [{ file: 'src/Page.vue' }],
      },
    }],
  }, { project, threshold: 8000 });
  assert.equal(trigger.enabled, true);
  assert.equal(trigger.oversized, true);
  assert.equal(trigger.missingComponentFile, false);
});

test('candidate inspection prefers complete code matches over comment-only matches', () => {
  const project = fixtureProject({
    'src/Exact.vue': [
      '<template>',
      '  <div class="materials-list">',
      '    <div class="material-item"><i class="play-icon" /></div>',
      '  </div>',
      '</template>',
    ].join('\n'),
    'src/Comment.vue': [
      '<template><div /></template>',
      '<!-- <div class="materials-list"><div class="material-item"><i class="play-icon" /></div></div> -->',
    ].join('\n'),
  });
  const plan = {
    searches: [{
      keywords: ['materials-list', 'material-item', 'play-icon'],
      mode: 'all',
      range: 'same-structure',
      priority: 1,
      reason: 'fixture',
    }],
  };
  const cache = new Map();
  const candidates = executeSearchPlan(project, plan, cache);
  const inspection = inspectCandidates(project, candidates, plan, cache);
  assert.equal(inspection.candidates[0].file, 'src/Exact.vue');
  assert.deepEqual(inspection.candidates[0].commentOnly, []);
  assert.equal(inspection.candidates[1].commentOnly.length, 3);
});

test('search plan keeps partial structural evidence when planner over-constrains a group', () => {
  const project = fixtureProject({
    'src/RegionShell.vue': [
      '<template>',
      '  <section class="feature-shell stable-region" />',
      '</template>',
    ].join('\n'),
    'src/region-data.ts': [
      "export const region = [{ title: '业务标题' }, { title: '子项名称' }]",
    ].join('\n'),
  });
  const plan = {
    searches: [{
      keywords: ['feature-shell', 'stable-region', '业务标题'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'planner over-constrained mixed evidence',
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  const files = candidates.map(candidate => candidate.file);
  assert.ok(files.includes('src/RegionShell.vue'));
  assert.ok(files.includes('src/region-data.ts'));
  const regionShell = candidates.find(candidate => candidate.file === 'src/RegionShell.vue');
  assert.ok(regionShell.matchedGroups.some(group => group.source === 'keyword-fallback'));
  assert.deepEqual(regionShell.matchedKeywords.sort(), ['feature-shell', 'stable-region']);
});

test('class-token searches require class context instead of bare object values', () => {
  const project = fixtureProject({
    'src/Component.vue': '<template><section class="metric-card">x</section></template>',
    'src/ObjectValue.ts': "export const value = { token: 'metric-card' }",
    'src/styles.css': '.metric-card { color: red; }',
  });
  const plan = {
    searches: [{
      keywords: ['metric-card'],
      keywordTypes: { 'metric-card': 'class-token' },
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'class context',
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  const files = candidates.map(item => item.file);
  assert.ok(files.includes('src/Component.vue'));
  assert.ok(files.includes('src/styles.css'));
  assert.ok(!files.includes('src/ObjectValue.ts'));
});

test('serialized DOM attributes are split and matched as an attribute relation', async () => {
  const project = fixtureProject({
    'src/MenuNode.vue': [
      '<template>',
      '  <div class="org-menu-node">',
      '    <Submenu data-c-name="sub-menu" />',
      '  </div>',
      '</template>',
    ].join('\n'),
    'src/ObjectValue.ts': [
      "export const values = { 'sub-menu': true }",
      "export const field = 'data-c-name'",
    ].join('\n'),
  });
  const outputs = [
    JSON.stringify({
      searches: [{
        keywords: ['data-c-name="sub-menu"', 'org-menu-node'],
        mode: 'all',
        range: 'same-structure',
        priority: 1,
        reason: 'DOM attribute and class',
      }],
      needMoreDom: false,
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/MenuNode.vue',
        role: 'render',
        confidence: 98,
        reason: '属性与 class 在同一模板结构中',
      }],
      followUpSearches: [],
    }),
  ];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: {
        rawOuterHtml: '<li class="org-menu-node" data-c-name="sub-menu"></li>',
      },
      sourceLocate: { componentChain: [] },
    }],
  }, {
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.deepEqual(result.agent.plan.searches[0].keywords, [
    'data-c-name',
    'sub-menu',
    'org-menu-node',
  ]);
  assert.deepEqual(result.agent.plan.searches[0].attributePairs, [{
    key: 'data-c-name',
    value: 'sub-menu',
  }]);
  assert.equal(result.hits[0]?.file, 'src/MenuNode.vue');
  assert.ok(!result.agent.inspection.candidates.some(candidate => {
    return candidate.file === 'src/ObjectValue.ts';
  }));
});

test('component chain names without files remain valid planner search evidence', async () => {
  const project = fixtureProject({
    'src/components/org-tree/index.vue': [
      '<template><div class="org-tree"><slot /></div></template>',
      '<script>export default { name: "org-tree" }</script>',
    ].join('\n'),
  });
  const outputs = [
    JSON.stringify({
      searches: [{
        keywords: ['org-tree'],
        mode: 'all',
        range: 'same-file',
        priority: 1,
        reason: 'runtime component name',
      }],
      needMoreDom: false,
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/components/org-tree/index.vue',
        role: 'render',
        confidence: 98,
        reason: '组件名称与运行时 componentChain 一致',
      }],
      followUpSearches: [],
    }),
  ];
  const prompts = [];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: { rawOuterHtml: '<ul><li>运行时项目</li></ul>' },
      sourceLocate: {
        componentChain: [{ name: 'org-tree', file: '' }],
      },
    }],
  }, {
    runModelTask: async (_adapter, prompt) => {
      prompts.push(prompt);
      return {
        adapter: { id: 'test', name: 'test', type: 'api' },
        rawText: outputs.shift(),
        logs: [],
      };
    },
  });
  const plannerInput = JSON.parse(prompts[0]);
  assert.equal(plannerInput.domSelections[0].directText, '');
  assert.equal(plannerInput.domSelections[0].textScope, 'descendant-flat-text');
  assert.equal(result.agent.plan.searches[0].keywords[0], 'org-tree');
  assert.equal(result.hits[0]?.file, 'src/components/org-tree/index.vue');
});

test('static text hits with incompatible DOM tags are removed before candidate judging', async () => {
  const project = fixtureProject({
    'src/MenuNode.vue': '<template><span class="nav-name">考核列表</span></template>',
    'src/AssessmentPage.vue': '<template><h2 style="min-width:200px;">考核列表</h2></template>',
  });
  const outputs = [
    JSON.stringify({
      searches: [{
        keywords: ['考核列表'],
        mode: 'all',
        range: 'same-file',
        priority: 1,
        reason: 'DOM text',
      }],
      needMoreDom: false,
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/MenuNode.vue',
        role: 'render',
        confidence: 98,
        reason: '静态文案所在标签与 DOM 一致',
      }],
      followUpSearches: [],
    }),
  ];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: {
        rawOuterHtml: '<span data-v-893827c4="" class="nav-name">考核列表</span>',
        text: '考核列表',
      },
      sourceLocate: { componentChain: [] },
    }],
  }, {
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.equal(result.hits[0]?.file, 'src/MenuNode.vue');
  assert.ok(!result.agent.inspection.candidates.some(candidate => {
    return candidate.file === 'src/AssessmentPage.vue';
  }));
});

test('static text hits with incompatible static classes are removed', () => {
  const project = fixtureProject({
    'src/UploadSection.vue': '<template><div class="section-title">商品替换图</div></template>',
    'src/ShotSection.vue': '<template><div class="section-label">商品替换图</div></template>',
    'src/ModalA.vue': '<template><div class="modal-label">商品替换图</div></template>',
    'src/ModalB.vue': '<template><div class="modal-label">商品替换图</div></template>',
  });
  const plan = {
    searches: [{
      keywords: ['商品替换图'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM text',
      domTextStructures: {
        商品替换图: [{ tag: 'div', classes: ['section-title'] }],
      },
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  assert.equal(candidates.length, 4);
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  assert.deepEqual(inspection.candidates.map(candidate => candidate.file), [
    'src/UploadSection.vue',
  ]);
});

test('dynamic source classes are not rejected by static class consistency checks', () => {
  const project = fixtureProject({
    'src/DynamicTitle.vue': '<template><div :class="titleClass">商品替换图</div></template>',
  });
  const plan = {
    searches: [{
      keywords: ['商品替换图'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM text',
      domTextStructures: {
        商品替换图: [{ tag: 'div', classes: ['section-title'] }],
      },
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  assert.ok(inspection.candidates.some(candidate => candidate.file === 'src/DynamicTitle.vue'));
});

test('custom component tags are not rejected by native HTML tag consistency checks', () => {
  const project = fixtureProject({
    'src/MenuNode.vue': '<template><NavName>考核列表</NavName></template>',
  });
  const plan = {
    searches: [{
      keywords: ['考核列表'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM text',
      domTextStructures: {
        考核列表: [{ tag: 'span', classes: ['nav-name'] }],
      },
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  assert.ok(inspection.candidates.some(candidate => candidate.file === 'src/MenuNode.vue'));
});

test('a unique render candidate covering every DOM anchor removes subset-only candidates', () => {
  const project = fixtureProject({
    'src/shot-confirm/index.vue': [
      '<template>',
      '  <div class="product-upload-section">',
      '    <div class="section-title">商品替换图</div>',
      '  </div>',
      '</template>',
    ].join('\n'),
    'src/prompt-edit-modal.vue': [
      '<template><div class="modal-label">商品替换图</div></template>',
    ].join('\n'),
    'src/shot-confirm/useHook.ts': [
      "export function validate() { return { message: '已标记商品分镜，请上传商品替换图' } }",
    ].join('\n'),
  });
  const plan = {
    searches: [{
      keywords: ['product-upload-section'],
      keywordTypes: { 'product-upload-section': 'class-token' },
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM class',
    }, {
      keywords: ['商品替换图'],
      mode: 'all',
      range: 'same-file',
      priority: 2,
      reason: 'DOM text',
      domTextStructures: {
        商品替换图: [{ tag: 'div', classes: ['section-title'] }],
      },
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  assert.equal(candidates.length, 3);
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  assert.deepEqual(inspection.candidates.map(candidate => candidate.file), [
    'src/shot-confirm/index.vue',
  ]);
});

test('full DOM anchor coverage returns a final hit without requesting another expansion round', async () => {
  const project = fixtureProject({
    'src/shot-confirm/index.vue': [
      '<template>',
      '  <div class="product-upload-section">',
      '    <div class="section-title">商品替换图</div>',
      '  </div>',
      '</template>',
    ].join('\n'),
    'src/prompt-edit-modal.vue': '<template><div class="modal-label">商品替换图</div></template>',
    'src/shot-confirm/useHook.ts': "export const message = '已标记商品分镜，请上传商品替换图'",
  });
  const outputs = [
    JSON.stringify({
      searches: [{
        keywords: ['product-upload-section'],
        mode: 'all',
        range: 'same-file',
        priority: 1,
        reason: 'DOM class',
      }, {
        keywords: ['商品替换图'],
        mode: 'all',
        range: 'same-file',
        priority: 2,
        reason: 'DOM text',
      }],
      needMoreDom: false,
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/shot-confirm/index.vue',
        role: 'render',
        confidence: 99,
        reason: '唯一同时匹配容器 class 和标题节点',
      }],
      followUpSearches: [],
    }),
  ];
  const logs = [];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: {
        rawOuterHtml: '<div class="product-upload-section"><div class="section-title">商品替换图</div></div>',
        text: '商品替换图',
      },
      sourceLocate: { componentChain: [] },
    }],
  }, {
    onLog: log => logs.push(log),
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.equal(result.needMoreDom, undefined);
  assert.deepEqual(result.hits.map(hit => hit.file), ['src/shot-confirm/index.vue']);
  const kindLog = logs.find(log => log.startsWith('DOM Agent 检索词定性：')) || '';
  assert.match(kindLog, /"keyword": "product-upload-section"/);
  assert.match(kindLog, /"kind": "class"/);
  assert.match(kindLog, /"keyword": "商品替换图"/);
  assert.match(kindLog, /"kind": "text"/);
});

test('JSON text collections are definition references instead of render candidates', () => {
  const project = fixtureProject({
    'src/menu-data.json': JSON.stringify({
      items: ['组织架构', '绩效', '周计划与总结'],
    }),
    'src/MenuNode.vue': [
      '<template>',
      '  <div class="org-menu-node">',
      '    <Submenu data-c-name="sub-menu" />',
      '  </div>',
      '</template>',
    ].join('\n'),
  });
  const plan = {
    searches: [{
      keywords: ['组织架构', '绩效', '周计划与总结'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM texts',
    }, {
      keywords: ['data-c-name', 'sub-menu', 'org-menu-node'],
      keywordTypes: {
        'data-c-name': 'attribute-name',
        'sub-menu': 'attribute-value',
        'org-menu-node': 'class-token',
      },
      attributePairs: [{ key: 'data-c-name', value: 'sub-menu' }],
      mode: 'all',
      range: 'same-structure',
      priority: 2,
      reason: 'DOM structure',
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  const json = inspection.candidates.find(candidate => candidate.file === 'src/menu-data.json');
  assert.equal(json.sourceRole, 'definition-like');
  assert.equal(json.referenceOnly, true);
  const evidence = analyzeEvidenceSufficiency(plan, inspection, []);
  assert.equal(evidence.insufficient, false);
  assert.equal(evidence.primaryCandidateCount, 1);
});

test('style and definition candidates do not force expansion when one render candidate remains', () => {
  const project = fixtureProject({
    'src/components/MetricCard.ts': [
      "import { defineComponent, h } from 'vue'",
      'export default defineComponent({',
      "  setup() { return () => h('section', { class: ['metric-card'] }, []) }",
      '})',
    ].join('\n'),
    'src/locales/zh-CN.ts': [
      'export default {',
      "  metrics: { roi: '投产比' }",
      '}',
    ].join('\n'),
    'src/styles.css': '.metric-card { border: 1px solid #ddd; }',
  });
  const plan = {
    searches: [{
      keywords: ['metric-card', '投产比'],
      keywordTypes: { 'metric-card': 'class-token' },
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM class + text',
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  const roles = new Map(inspection.candidates.map(item => [item.file, item.sourceRole]));
  assert.equal(roles.get('src/components/MetricCard.ts'), 'render-like');
  assert.equal(roles.get('src/styles.css'), 'style-reference');
  assert.equal(roles.get('src/locales/zh-CN.ts'), 'definition-like');
  const evidence = analyzeEvidenceSufficiency(plan, inspection, []);
  assert.equal(evidence.insufficient, false);
  assert.match(evidence.reason, /只剩一个可渲染源码候选/);
});

test('style and definition candidates do not force expansion before judging render candidates', () => {
  const project = fixtureProject({
    'src/views/dashboard/DashboardPage.ts': [
      "import { defineComponent, h } from 'vue'",
      "import MetricCard from '../../components/MetricCard'",
      'export default defineComponent({',
      '  setup() {',
      "    return () => h(MetricCard, { titleKey: 'metrics.roi', trend: '目标 3.5+' })",
      '  }',
      '})',
    ].join('\n'),
    'src/components/MetricCard.ts': [
      "import { defineComponent, h } from 'vue'",
      'export default defineComponent({',
      "  setup() { return () => h('section', { class: ['metric-card'] }, []) }",
      '})',
    ].join('\n'),
    'src/locales/zh-CN.ts': [
      'export default {',
      "  metrics: { roi: '投产比' }",
      '}',
    ].join('\n'),
    'src/styles.css': '.metric-card { border: 1px solid #ddd; }',
  });
  const plan = {
    searches: [
      {
        keywords: ['投产比', '目标 3.5+'],
        mode: 'any',
        range: 'same-structure',
        priority: 1,
        reason: 'DOM text anchors',
      },
      {
        keywords: ['metric-card'],
        keywordTypes: { 'metric-card': 'class-token' },
        mode: 'all',
        range: 'same-structure',
        priority: 2,
        reason: 'DOM class anchor',
      },
    ],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  const files = inspection.candidates.map(item => item.file);
  assert.ok(files.includes('src/views/dashboard/DashboardPage.ts'));
  assert.ok(files.includes('src/components/MetricCard.ts'));
  assert.ok(files.includes('src/locales/zh-CN.ts'));
  assert.ok(files.includes('src/styles.css'));
  const evidence = analyzeEvidenceSufficiency(plan, inspection, []);
  assert.equal(evidence.insufficient, false);
  assert.equal(evidence.primaryCandidateCount, 2);
  assert.equal(evidence.referenceCandidateCount, 2);
  assert.match(evidence.reason, /多个可渲染源码候选进入 Judge/);
});

test('definition candidates record import relation to render candidates', () => {
  const project = fixtureProject({
    'src/components/Component.vue': [
      '<script setup>',
      "import { labels } from '../define'",
      '</script>',
      '<template><button>{{ labels.exportReport }}</button></template>',
    ].join('\n'),
    'src/define.ts': [
      'export const labels = {',
      "  exportReport: '导出报表'",
      '}',
    ].join('\n'),
  });
  const plan = {
    searches: [{
      keywords: ['导出报表'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM text',
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  candidates.push({
    file: 'src/components/Component.vue',
    score: 80,
    matchedGroups: [{ source: 'keyword-fallback', keywords: ['labels'] }],
    matchedKeywords: ['labels'],
    positions: [0],
  });
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  const definition = inspection.candidates.find(item => item.file === 'src/define.ts');
  assert.ok(definition.definitionLinks.some(link => {
    return link.type === 'import-relation'
      && link.renderFile === 'src/components/Component.vue';
  }));
});

test('definition text can discover render candidates through key path references', () => {
  const project = fixtureProject({
    'src/components/ActionBar.vue': [
      '<script setup>',
      "const label = t('actions.exportReport')",
      '</script>',
      '<template><button>{{ label }}</button></template>',
    ].join('\n'),
    'src/locales/zh-CN.ts': [
      'export default {',
      "  actions: { createPlan: '新增计划', exportReport: '导出报表', batchApprove: '批量审批' }",
      '}',
    ].join('\n'),
  });
  const plan = {
    searches: [{
      keywords: ['导出报表'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM text',
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  const files = inspection.candidates.map(item => item.file);
  assert.ok(files.includes('src/locales/zh-CN.ts'));
  assert.ok(files.includes('src/components/ActionBar.vue'));
  const render = inspection.candidates.find(item => item.file === 'src/components/ActionBar.vue');
  assert.ok(render.matchedGroups.some(group => group.source === 'definition-key-reference'));
  const definition = inspection.candidates.find(item => item.file === 'src/locales/zh-CN.ts');
  assert.ok(definition.definitionLinks.some(link => {
    return link.type === 'key-reference'
      && link.renderFile === 'src/components/ActionBar.vue'
      && link.terms.includes('actions.exportReport');
  }));
});

test('high-frequency standalone definition keys do not create false render relations', () => {
  const project = fixtureProject({
    'src/router.ts': "export default { meta: { title: '组织架构' } }",
    'src/A.vue': '<template><div>{{ title }}</div></template>',
    'src/B.vue': '<template><div>{{ title }}</div></template>',
    'src/C.vue': '<template><div>{{ title }}</div></template>',
    'src/D.vue': '<template><div>{{ title }}</div></template>',
    'src/E.vue': '<template><div>{{ title }}</div></template>',
  });
  const plan = {
    searches: [{
      keywords: ['组织架构'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM text',
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  for (const file of ['src/A.vue', 'src/B.vue', 'src/C.vue', 'src/D.vue', 'src/E.vue']) {
    candidates.push({
      file,
      score: 30,
      matchedGroups: [{ source: 'keyword-fallback', keywords: ['title'] }],
      matchedKeywords: ['title'],
      positions: [0],
    });
  }
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  const definition = inspection.candidates.find(item => item.file === 'src/router.ts');
  assert.deepEqual(definition.definitionLinks, []);
});

test('definition import owners become render candidates without an extra model relation call', async () => {
  const project = fixtureProject({
    'src/components/ActionBar.vue': [
      '<script setup>',
      "import { labels } from '../labels'",
      '</script>',
      '<template><button>{{ labels.exportReport }}</button></template>',
    ].join('\n'),
    'src/labels.ts': [
      "export const labels = createLabels({ exportReport: makeLabel('导出报表') })",
    ].join('\n'),
  });
  const outputs = [
    JSON.stringify({
      searches: [{
        keywords: ['导出报表'],
        mode: 'all',
        range: 'same-file',
        priority: 1,
        reason: 'DOM text',
      }],
      needMoreDom: false,
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/components/ActionBar.vue',
        role: 'render',
        confidence: 95,
        reason: '渲染组件直接引用文案定义',
      }],
      followUpSearches: [],
    }),
  ];
  let modelCalls = 0;
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    userPrompt: '修改导出按钮',
    selections: [{
      element: { rawOuterHtml: '<button>导出报表</button>' },
      sourceLocate: { componentChain: [] },
    }],
  }, {
    runModelTask: async () => {
      modelCalls += 1;
      return {
        adapter: { id: 'test', name: 'test', type: 'api' },
        rawText: outputs.shift(),
        logs: [],
      };
    },
  });
  assert.equal(modelCalls, 2);
  assert.equal(result.hits[0]?.file, 'src/components/ActionBar.vue');
  assert.ok(result.agent.inspection.candidates.some(candidate => {
    return candidate.file === 'src/labels.ts'
      && candidate.definitionLinks.some(link => link.renderFile === 'src/components/ActionBar.vue');
  }));
});

test('definition relation resolver can link an indirect definition to an existing render candidate', async () => {
  const project = fixtureProject({
    'src/components/ActionBar.vue': [
      '<template><section class="action-bar"><button>{{ labels.exportReport }}</button></section></template>',
    ].join('\n'),
    'src/labels.ts': [
      "export const labels = createLabels({ exportReport: makeLabel('导出报表') })",
    ].join('\n'),
  });
  const outputs = [
    JSON.stringify({
      searches: [{
        keywords: ['action-bar'],
        mode: 'all',
        range: 'same-file',
        priority: 1,
        reason: 'DOM class',
      }, {
        keywords: ['导出报表'],
        mode: 'all',
        range: 'same-file',
        priority: 2,
        reason: 'DOM text',
      }],
      needMoreDom: false,
    }),
    JSON.stringify({
      status: 'linked',
      relations: [{
        definitionFile: 'src/labels.ts',
        renderFile: 'src/components/ActionBar.vue',
        confidence: 92,
        reason: '渲染片段读取 labels.exportReport，定义片段提供同名 key',
      }],
      searches: [],
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/components/ActionBar.vue',
        role: 'render',
        confidence: 95,
        reason: '组件直接生成选区',
      }],
      followUpSearches: [],
    }),
  ];
  const logs = [];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    userPrompt: '修改导出按钮',
    selections: [{
      element: { rawOuterHtml: '<section class="action-bar"><button>导出报表</button></section>' },
      sourceLocate: { componentChain: [] },
    }],
  }, {
    onLog: log => logs.push(log),
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.equal(result.hits[0]?.file, 'src/components/ActionBar.vue');
  assert.ok(logs.some(log => log.startsWith('DOM Agent 定义关系分析输入')));
  assert.ok(logs.some(log => log.startsWith('DOM Agent 定义关系分析输出')));
  assert.ok(result.agent.definitionResolution.relations.length);
});

test('definition relation resolver rejects invented search keywords', async () => {
  const project = fixtureProject({
    'src/labels.ts': [
      "export const labels = createLabels({ exportReport: makeLabel('导出报表') })",
    ].join('\n'),
  });
  const outputs = [
    JSON.stringify({
      searches: [{
        keywords: ['导出报表'],
        mode: 'all',
        range: 'same-file',
        priority: 1,
        reason: 'DOM text',
      }],
      needMoreDom: false,
    }),
    JSON.stringify({
      status: 'search',
      relations: [],
      searches: [{
        keywords: ['imaginaryComponent', 'exportReport'],
        mode: 'any',
        range: 'same-file',
        reason: 'find render usage',
      }],
    }),
  ];
  const logs = [];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: { rawOuterHtml: '<button>导出报表</button>' },
      sourceLocate: { componentChain: [] },
    }],
  }, {
    onLog: log => logs.push(log),
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.equal(result.needMoreDom, true);
  assert.ok(logs.some(log => {
    return log.includes('定义关系检索词过滤')
      && log.includes('imaginaryComponent');
  }));
});

test('style reference candidates are not accepted as final source when render candidates exist', async () => {
  const project = fixtureProject({
    'src/Card.vue': '<template><section class="metric-card">投产比</section></template>',
    'src/styles.css': '.metric-card { color: red; }',
  });
  const outputs = [
    JSON.stringify({
      status: 'ready',
      understanding: { userTarget: '定位指标卡片', selectedDomAnchors: ['metric-card'] },
      evidenceAssessment: { sufficient: true },
      nextPlan: [{
        capability: 'locate-structure',
        searches: [{
          keywords: ['metric-card'],
          mode: 'all',
          range: 'same-file',
          reason: 'DOM class',
        }],
        relation: 'same-rendering-context',
        scopeHint: 'route-entry-first',
        purpose: '定位指标卡片',
      }],
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/styles.css',
        role: 'render',
        confidence: 99,
        reason: 'model wrongly selected style',
      }],
      followUpSearches: [],
    }),
  ];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: {
        rawOuterHtml: '<section class="metric-card">投产比</section>',
      },
      sourceLocate: { componentChain: [] },
    }],
  }, {
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.notEqual(result.hits[0]?.file, 'src/styles.css');
});

test('evidence analysis asks for more DOM when local search has multiple candidates', () => {
  const project = fixtureProject({
    'src/A.vue': '<template><div style="font-size: 12px; color: #999">¥2.8</div></template>',
    'src/B.vue': '<template><div style="font-size: 12px; color: #999">¥7.1</div></template>',
  });
  const plan = {
    searches: [{
      keywords: ['¥', 'font-size: 12px', '#999'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'weak visual evidence',
    }],
  };
  const cache = new Map();
  const candidates = executeSearchPlan(project, plan, cache);
  const inspection = inspectCandidates(project, candidates, plan, cache);
  const evidence = analyzeEvidenceSufficiency(plan, inspection);
  assert.equal(evidence.insufficient, true);
  assert.equal(evidence.candidateCount, 2);
  assert.match(evidence.reason, /2 个候选文件/);
});

test('evidence analysis asks for more DOM when local search has no candidates', () => {
  const evidence = analyzeEvidenceSufficiency(
    { searches: [{ keywords: ['n-base-selection-label'], mode: 'all', range: 'same-file' }] },
    { candidates: [] },
    []
  );
  assert.equal(evidence.insufficient, true);
  assert.equal(evidence.candidateCount, 0);
  assert.match(evidence.reason, /未命中候选文件/);
});

test('evidence analysis ignores fallback noise when a planned group has one unique match', () => {
  const plan = { searches: [] };
  const inspection = {
    candidates: [
      {
        file: 'src/Page.vue',
        matchedGroups: [{ source: 'planned-group', keywords: ['placeholder', 'icon'] }],
      },
      {
        file: 'src/IconOnly.vue',
        matchedGroups: [{ source: 'keyword-fallback', keywords: ['icon'] }],
      },
    ],
  };
  const evidence = analyzeEvidenceSufficiency(plan, inspection);
  assert.equal(evidence.insufficient, false);
  assert.equal(evidence.plannedGroupCandidateCount, 1);
});

test('evidence analysis still asks for more DOM when related candidates are ambiguous', () => {
  const plan = { searches: [] };
  const inspection = {
    candidates: [
      {
        file: 'src/components/Child.vue',
        matchedGroups: [{ source: 'keyword-fallback', keywords: ['child-class'] }],
      },
      {
        file: 'src/views/Page.vue',
        matchedGroups: [{ source: 'keyword-fallback', keywords: ['page-text'] }],
      },
    ],
  };
  const ownership = [{
    file: 'src/views/Page.vue',
    chain: ['src/components/Child.vue', 'src/views/Page.vue'],
  }];
  const evidence = analyzeEvidenceSufficiency(plan, inspection, ownership);
  assert.equal(evidence.insufficient, true);
  assert.equal(evidence.ownershipCount, 1);
  assert.match(evidence.reason, /2 个候选文件/);
});

test('evidence analysis expands when a single placeholder matches page and modal files', () => {
  const project = fixtureProject({
    'src/views/Page.vue': [
      "render: () => h(NInput, { placeholder: '请输入供应来源' })",
      "h('path', { d: 'M10 6H6a2 2 0 00-2 2v10a2' })",
    ].join('\n'),
    'src/views/QuickEditModal.vue': [
      '<template>',
      '  <n-modal><n-input placeholder="请输入供应来源" /></n-modal>',
      '</template>',
    ].join('\n'),
  });
  const plan = {
    searches: [{
      keywords: ['请输入供应来源'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'single placeholder anchor',
    }],
  };
  const cache = new Map();
  const candidates = executeSearchPlan(project, plan, cache);
  const inspection = inspectCandidates(project, candidates, plan, cache);
  const evidence = analyzeEvidenceSufficiency(plan, inspection, [{
    file: 'src/views/Page.vue',
    chain: ['src/views/QuickEditModal.vue', 'src/views/Page.vue'],
  }]);
  assert.equal(evidence.insufficient, true);
  assert.equal(evidence.candidateCount, 2);
  assert.equal(evidence.plannedGroupCandidateCount, 0);
});

test('agent search asks for more DOM when local search has multiple candidates', async () => {
  const project = fixtureProject({
    'src/CostA.vue': '<template><div style="font-size: 12px; color: #999">¥2.8</div></template>',
    'src/CostB.vue': '<template><div style="font-size: 12px; color: #999">¥1.2</div></template>',
  });
  const logs = [];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: {
        rawOuterHtml: '<div style="font-size:12px;color:#999">¥2.8</div>',
      },
      sourceLocate: {
        componentChain: [],
      },
    }],
  }, {
    onLog: log => logs.push(log),
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: JSON.stringify({
        searches: [{
          keywords: ['¥', 'font-size: 12px', '#999'],
          mode: 'all',
          range: 'same-file',
          priority: 1,
          reason: 'weak visual evidence',
        }],
        needMoreDom: false,
      }),
      logs: [],
    }),
  });
  assert.equal(result.hits.length, 0);
  assert.equal(result.needMoreDom, true);
  assert.equal(result.agent.needMoreDom, true);
  assert.ok(logs.some(log => log.includes('DOM Agent 证据不足')));
});

test('agent search returns needMoreDom when planner asks for more DOM without searches', async () => {
  const project = fixtureProject({
    'src/Page.vue': '<template><div /></template>',
  });
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: {
        rawOuterHtml: '<div>¥2.8</div>',
      },
      sourceLocate: {
        componentChain: [],
      },
    }],
  }, {
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: JSON.stringify({
        searches: [],
        needMoreDom: true,
      }),
      logs: [],
    }),
  });
  assert.equal(result.hits.length, 0);
  assert.equal(result.needMoreDom, true);
  assert.equal(result.agent.evidence.insufficient, true);
});

test('agent search filters user-only planner terms before local search', async () => {
  const project = fixtureProject({
    'src/Page.vue': [
      "const columns = [{",
      "  title: '供应来源',",
      "  key: 'source',",
      "  width: 150,",
      "  render: () => h(NInput, { placeholder: '请输入供应来源' }),",
      "  icon: h('path', { d: 'M10 6H6a2 2 0 00-2 2v10a2' })",
      "}]",
    ].join('\n'),
    'src/Other.vue': [
      "const label = '供应来源'",
      "const width = '150px'",
    ].join('\n'),
  });
  const logs = [];
  const outputs = [
    JSON.stringify({
      searches: [
        {
          keywords: ['请输入供应来源', 'getV2List'],
          mode: 'all',
          range: 'same-file',
          priority: 1,
          reason: 'bad planner used user request term',
        },
      ],
      needMoreDom: false,
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/Page.vue',
        role: 'render',
        confidence: 95,
        reason: '补充 DOM 锚点后唯一命中',
      }],
      followUpSearches: [],
    }),
  ];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    userPrompt: '@选区1 选择器宽度改为300px，下拉选项数据源改为 getV2List',
    selections: [{
      element: {
        rawOuterHtml: [
          '<td data-col-key="source" style="width: 150px">',
          '<input placeholder="请输入供应来源">',
          '<svg><path d="M10 6H6a2 2 0 00-2 2v10a2"></path></svg>',
          '</td>',
        ].join(''),
      },
      sourceLocate: {
        componentChain: [],
      },
    }],
  }, {
    onLog: log => logs.push(log),
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.equal(result.hits[0].file, 'src/Page.vue');
  assert.ok(logs.some(log => log.includes('丢弃未在 DOM/路由证据中出现的词 getV2List')));
  assert.ok(!logs.some(log => log.includes('DOM Agent Planner 计划补充')));
});

test('agent search can use expanded ancestor DOM anchors for local search', async () => {
  const project = fixtureProject({
    'src/views/Page.vue': [
      'const columns = [{',
      "  title: '所属运营',",
      "  key: 'operator',",
      '  render: row => h(NSelect, { value: row.operatorId })',
      '}]',
    ].join('\n'),
  });
  const outputs = [
    JSON.stringify({
      status: 'ready',
      understanding: {
        userTarget: '定位所属运营选择器',
        selectedDomAnchors: ['data-col-key=operator'],
      },
      evidenceAssessment: { sufficient: true },
      nextPlan: [{
        capability: 'locate-structure',
        searches: [{
          keywords: ['operator'],
          mode: 'all',
          range: 'same-structure',
          reason: '用扩区后的表格列 key 定位渲染结构',
        }],
        relation: 'same-rendering-context',
        scopeHint: 'route-entry-first',
        purpose: '用扩区后的表格列 key 定位渲染结构',
      }],
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/views/Page.vue',
        role: 'render',
        confidence: 92,
        reason: '扩区 data-col-key 与源码列 key 对应',
      }],
      followUpSearches: [],
    }),
  ];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: {
        rawOuterHtml: '<div class="n-base-selection-label" title="张小庆">张小庆</div>',
        ancestors: [{
          rawOuterHtml: '<td data-col-key="operator"><div class="n-select"><div class="n-base-selection-label">张小庆</div></div></td>',
        }],
      },
      sourceLocate: {
        componentChain: [],
      },
    }],
  }, {
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.equal(result.hits[0].file, 'src/views/Page.vue');
});

test('expanded DOM agent search relates previous child candidates through parent imports', async () => {
  const project = fixtureProject({
    'src/Parent.vue': [
      'const columns = [{',
      "  key: 'cost',",
      "  title: '商品成本/快递成本',",
      "  render: () => h(Child)",
      '}]',
      "import Child from './Child.vue'",
    ].join('\n'),
    'src/Child.vue': [
      '<template><button>查看</button></template>',
    ].join('\n'),
    'src/OtherChild.vue': [
      '<template><button>查看</button></template>',
    ].join('\n'),
  });
  const logs = [];
  const outputs = [
    JSON.stringify({
      status: 'ready',
      understanding: {
        userTarget: '定位扩区后的成本列',
        selectedDomAnchors: ['cost'],
      },
      evidenceAssessment: { sufficient: true },
      nextPlan: [{
        capability: 'locate-structure',
        searches: [{
          keywords: ['cost'],
          mode: 'all',
          range: 'same-file',
          reason: '扩区后列 key',
        }],
        relation: 'same-rendering-context',
        scopeHint: 'route-entry-first',
        purpose: '验证扩区列 key',
      }],
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/Child.vue',
        role: 'render',
        confidence: 95,
        reason: '父文件命中 cost 且引用上一轮查看按钮候选',
      }],
      followUpSearches: [],
    }),
  ];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    agentState: {
      expansionRetry: true,
      previousPlan: {
        searches: [{
          keywords: ['查看'],
          mode: 'all',
          range: 'same-file',
          priority: 1,
          reason: '第一轮按钮文案',
        }],
      },
      previousCandidates: [{
        file: 'src/Child.vue',
        score: 300,
        matchedGroups: [{ keywords: ['查看'], source: 'planned-group', range: 'same-file' }],
      }, {
        file: 'src/OtherChild.vue',
        score: 260,
        matchedGroups: [{ keywords: ['查看'], source: 'planned-group', range: 'same-file' }],
      }],
    },
    selections: [{
      element: {
        rawOuterHtml: '<td data-col-key="cost"><button>查看</button></td>',
      },
      sourceLocate: {
        componentChain: [],
      },
    }],
  }, {
    onLog: log => logs.push(log),
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.equal(result.hits[0].file, 'src/Child.vue');
  assert.ok(logs.some(log => log.includes('DOM Agent 扩区保留上一轮检索锚点用于引用链验证：查看')));
  assert.ok(logs.some(log => log.includes('DOM Agent 扩区引用链命中')));
  assert.ok(logs.some(log => log.includes('"chain"') && log.includes('src/Parent.vue') && log.includes('src/Child.vue')));
});

test('expanded DOM agent search prefers child when it directly matches inherited and expanded anchors', async () => {
  const project = fixtureProject({
    'src/Parent.vue': [
      "import Child from './Child.vue'",
      "const columns = [{ key: 'other', render: () => h(Child) }]",
    ].join('\n'),
    'src/Child.vue': [
      '<template>',
      '  <section data-col-key="cost">',
      '    <button>查看</button>',
      '  </section>',
      '</template>',
    ].join('\n'),
    'src/Other.vue': [
      '<template><button>查看</button></template>',
    ].join('\n'),
  });
  const outputs = [
    JSON.stringify({
      status: 'ready',
      understanding: {
        userTarget: '定位成本区域查看按钮',
        selectedDomAnchors: ['cost'],
      },
      evidenceAssessment: { sufficient: true },
      nextPlan: [{
        capability: 'locate-structure',
        searches: [{
          keywords: ['cost'],
          mode: 'all',
          range: 'same-file',
          reason: '扩区后列 key',
        }],
        relation: 'same-rendering-context',
        scopeHint: 'route-entry-first',
        purpose: '验证扩区列 key',
      }],
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/Child.vue',
        role: 'render',
        confidence: 96,
        reason: 'child 自身同时命中 cost 和 查看',
      }],
      followUpSearches: [],
    }),
  ];
  const logs = [];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    agentState: {
      expansionRetry: true,
      previousPlan: {
        searches: [{
          keywords: ['查看'],
          mode: 'all',
          range: 'same-file',
          priority: 1,
          reason: '第一轮按钮文案',
        }],
      },
      previousCandidates: [{
        file: 'src/Child.vue',
        score: 300,
        matchedGroups: [{ keywords: ['查看'], source: 'planned-group', range: 'same-file' }],
      }, {
        file: 'src/Other.vue',
        score: 260,
        matchedGroups: [{ keywords: ['查看'], source: 'planned-group', range: 'same-file' }],
      }],
    },
    selections: [{
      element: {
        rawOuterHtml: '<td data-col-key="cost"><button>查看</button></td>',
      },
      sourceLocate: {
        componentChain: [],
      },
    }],
  }, {
    onLog: log => logs.push(log),
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.equal(result.hits[0].file, 'src/Child.vue');
  assert.ok(logs.some(log => log.includes('executeSearchPlan') && log.includes('查看') && log.includes('cost')));
  assert.ok(!logs.some(log => log.includes('DOM Agent 扩区引用链命中')));
});

test('agent search streams model input, local calls and a verified final file', async () => {
  const project = fixtureProject({
    'src/MaterialView.vue': [
      '<template>',
      '  <div class="operation-workbench-cell-main">',
      '    <div class="materials-list">',
      '      <div v-for="item in items" class="material-item">',
      '        <i class="play-icon" />',
      '        <img class="material-cover" />',
      '      </div>',
      '    </div>',
      '  </div>',
      '</template>',
    ].join('\n'),
  });
  const outputs = [
    JSON.stringify({
      searches: [{
        keywords: ['operation-workbench-cell-main', 'materials-list', 'material-item'],
        mode: 'all',
        range: 'same-structure',
        priority: 1,
        reason: '共同结构',
      }],
      needMoreDom: false,
    }),
    JSON.stringify({
      status: 'unique',
      files: [{
        file: 'src/MaterialView.vue',
        role: 'render',
        confidence: 98,
        reason: '完整结构共同出现',
      }],
      followUpSearches: [],
    }),
  ];
  const logs = [];
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/fixture',
    selections: [{
      element: {
        rawOuterHtml: '<div class="operation-workbench-cell-main"><div class="materials-list"><div class="material-item"></div></div></div>',
      },
      sourceLocate: {
        componentChain: [],
      },
    }],
  }, {
    onLog: log => logs.push(log),
    runModelTask: async () => ({
      adapter: { id: 'test', name: 'test', type: 'api' },
      rawText: outputs.shift(),
      logs: [],
    }),
  });
  assert.equal(result.agent.enabled, true);
  assert.equal(result.hits[0].file, 'src/MaterialView.vue');
  assert.equal(result.hits[0].sourceRole, 'render');
  assert.ok(logs.some(log => log.startsWith('DOM Agent Planner 输入')));
  assert.ok(logs.some(log => log.startsWith('DOM Agent Planner 输出')));
  assert.ok(logs.some(log => log.startsWith('本地调用：inspectCandidates')));
  assert.ok(logs.some(log => log.startsWith('DOM Agent Judge 输入')));
});

test('judge follow-up searches cannot use words absent from DOM and candidate facts', () => {
  const body = {
    userPrompt: '增加所属店铺列',
    selections: [{
      element: {
        rawOuterHtml: '<div class="campaign-name">计划名称</div>',
      },
    }],
  };
  const inspection = {
    candidates: [{
      file: 'src/View.vue',
      excerpt: 'const field = "campaignName"; const columns = []',
      keywordFacts: [{ keyword: 'campaignName' }],
      matchedGroups: [{ keywords: ['campaignName'] }],
    }],
  };
  const result = filterFollowUpSearchesByEvidence([{
    keywords: ['所属店铺', 'campaignName', 'columns'],
    mode: 'all',
    range: 'same-file',
    priority: 1,
    reason: 'model output',
  }], body, inspection, []);
  assert.deepEqual(result.searches[0].keywords, ['campaignName', 'columns']);
  assert.deepEqual(result.removed, ['所属店铺']);
});

test('exact route import relation resolves a duplicated DOM candidate locally', () => {
  const project = fixtureProject({
    'src/pages/home/index.js': "import Home from './home.vue'; export default Home;",
    'src/pages/home/home.vue': [
      '<template><main><HelpCenter /></main></template>',
      "<script>import HelpCenter from './help-center'; export default { components: { HelpCenter } };</script>",
    ].join('\n'),
    'src/pages/home/help-center/index.vue': '<template><span class="hc-card__title__txt">{{ item.title }}</span></template>',
    'src/admin/help-center/index.vue': '<template><span class="hc-card__title__txt">{{ item.title }}</span></template>',
  });
  const candidates = [
    {
      file: 'src/pages/home/help-center/index.vue',
      referenceOnly: false,
      keywordFacts: [{ keyword: 'hc-card__title__txt', codeCount: 1, structureMismatch: null }],
      structureMismatches: [],
    },
    {
      file: 'src/admin/help-center/index.vue',
      referenceOnly: false,
      keywordFacts: [{ keyword: 'hc-card__title__txt', codeCount: 1, structureMismatch: null }],
      structureMismatches: [],
    },
  ];
  const routeTrace = {
    matched: true,
    bestPageFile: 'src/pages/home/index.js',
    hits: [{
      file: 'src/pages/home/index.js',
      routePath: '/PersonalProfile',
      reasons: ['路径精确匹配', '叶子路由', '存在页面组件文件'],
    }],
  };
  const relations = traceRouteCandidateRelations(project, routeTrace, candidates, new Map());
  assert.deepEqual(relations, [{
    candidateFile: 'src/pages/home/help-center/index.vue',
    routeFile: 'src/pages/home/index.js',
    depth: 2,
    chain: [
      'src/pages/home/index.js',
      'src/pages/home/home.vue',
      'src/pages/home/help-center/index.vue',
    ],
  }]);
  const decision = resolveByRouteRelation({
    pagePath: '/PersonalProfile',
  }, {
    candidates,
  }, routeTrace, relations);
  assert.equal(decision?.status, 'unique');
  assert.equal(decision?.files[0]?.file, 'src/pages/home/help-center/index.vue');
});

test('route validation rejects a judge unique result outside an equally matching route closure', () => {
  const inspection = {
    candidates: [
      {
        file: 'src/pages/home/help-center/index.vue',
        referenceOnly: false,
        keywordFacts: [{ keyword: 'hc-card__title__txt', codeCount: 1, structureMismatch: null }],
        structureMismatches: [],
      },
      {
        file: 'src/admin/help-center/index.vue',
        referenceOnly: false,
        keywordFacts: [{ keyword: 'hc-card__title__txt', codeCount: 1, structureMismatch: null }],
        structureMismatches: [],
      },
    ],
  };
  const result = validateJudgeRouteDecision({
    status: 'unique',
    files: [{
      file: 'src/admin/help-center/index.vue',
      role: 'render',
      confidence: 95,
      reason: 'DOM 相似',
    }],
    followUpSearches: [],
  }, inspection, [{
    candidateFile: 'src/pages/home/help-center/index.vue',
    routeFile: 'src/pages/home/index.js',
    depth: 2,
    chain: [
      'src/pages/home/index.js',
      'src/pages/home/home.vue',
      'src/pages/home/help-center/index.vue',
    ],
  }]);
  assert.equal(result.rejected, true);
  assert.equal(result.judge.status, 'ambiguous');
  assert.deepEqual(result.judge.files.map(item => item.file), [
    'src/admin/help-center/index.vue',
    'src/pages/home/help-center/index.vue',
  ]);
});

test('candidate quota preserves structural class hits when descendant text is high frequency', () => {
  const files = {
    'src/Main.vue': '<template><span class="nav-name">{{ item.title }}</span></template>',
    'src/MenuNode.vue': '<template><div class="org-menu-node"><slot /></div></template>',
  };
  for (let index = 0; index < 16; index += 1) {
    files[`src/pages/Page${index}.vue`] = `<template><div>主页 ${index}</div></template>`;
  }
  const project = fixtureProject(files);
  const hits = executeSearchPlan(project, {
    searches: [{
      keywords: ['org-menu-node', 'nav-name'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: '结构类',
      keywordTypes: {
        'org-menu-node': 'class-token',
        'nav-name': 'class-token',
      },
      evidenceKinds: {
        'org-menu-node': 'class',
        'nav-name': 'class',
      },
    }, {
      keywords: ['主页'],
      mode: 'any',
      range: 'same-file',
      priority: 2,
      reason: '后代文案',
      evidenceKinds: { '主页': 'text' },
    }],
  }, new Map());
  assert.ok(hits.some(hit => hit.file === 'src/Main.vue'));
  assert.ok(hits.some(hit => hit.file === 'src/MenuNode.vue'));
});

test('text evidence does not match a longer source phrase', () => {
  const project = fixtureProject({
    'src/Exact.ts': "export const title = '主页'",
    'src/Longer.ts': "export const title = '主页地址'",
    'src/Prefixed.ts': "export const title = '项目主页'",
  });
  const hits = executeSearchPlan(project, {
    searches: [{
      keywords: ['主页'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM 直接文案',
      evidenceKinds: { '主页': 'text' },
    }],
  }, new Map());
  assert.deepEqual(hits.map(hit => hit.file), ['src/Exact.ts']);
});

test('route relations stop before infrastructure cycles reach unrelated pages', () => {
  const project = fixtureProject({
    'src/router/home.js': "import Main from '../view/Main.vue'",
    'src/view/Main.vue': "<script>import store from '../store/index.js'</script>",
    'src/store/index.js': "import routes from '../router/all.js'",
    'src/router/all.js': "import Other from '../pages/Other.vue'",
    'src/pages/Other.vue': '<template><div class="nav-name">Other</div></template>',
  });
  const candidates = [{
    file: 'src/pages/Other.vue',
    referenceOnly: false,
  }];
  const relations = traceRouteCandidateRelations(project, {
    matched: true,
    bestPageFile: 'src/pages/Home.vue',
    bestRoute: { sourceFile: 'src/router/home.js' },
    hits: [],
  }, candidates, new Map());
  assert.deepEqual(relations, []);
});
