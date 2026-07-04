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
  inspectCandidates,
  resolveByRouteRelation,
  runAgentSearch,
  traceCandidateOwners,
  traceRouteCandidateRelations,
  validateJudgeRouteDecision,
  dominantRenderCandidate,
  buildComposite,
  computeFineLocation,
  offsetToLineColumn,
  validateOriginRelation,
  normalizeConfidence,
} = require('./agent-search');
const {
  buildLocatorSystemPrompt,
  buildLocatorUserInput,
  normalizeLocatorDecision,
  validateLocatorDecision,
  locatorDecisionToSearchPlan,
  locatorTechnicalStackMarkdown,
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

test('locator protocol parses layered anchors and converts to a tagged search plan', () => {
  const decision = normalizeLocatorDecision({
    status: 'ready',
    renderAnchors: [{ value: '执行人', kind: 'text' }, { value: '反馈附件', kind: 'text' }],
    scopeAnchors: [{ value: '执行信息', kind: 'text' }, { value: 'dc-fieldset', kind: 'class' }],
    childComponentAnchors: [{ value: 'file-upload-component', kind: 'class' }],
  });
  const validation = validateLocatorDecision(decision);
  assert.equal(validation.valid, true);

  const plan = locatorDecisionToSearchPlan(decision);
  const render = plan.searches.find(search => search.layer === 'render');
  assert.deepEqual(render.keywords, ['执行人', '反馈附件']);
  assert.equal(render.range, 'same-structure');
  assert.equal(render.mode, 'all');
  const scope = plan.searches.find(search => search.layer === 'scope');
  assert.equal(scope.scopeOnly, true);
  assert.deepEqual(scope.keywords, ['执行信息', 'dc-fieldset']);
  const child = plan.searches.find(search => search.layer === 'child');
  assert.equal(child.childAnchor, true);
  assert.deepEqual(child.keywords, ['file-upload-component']);

  const invalid = validateLocatorDecision(normalizeLocatorDecision({ status: 'ready' }));
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join('\n'), /renderAnchors/);
});

test('locator protocol still accepts legacy flat searches for backward compatibility', () => {
  const decision = normalizeLocatorDecision({
    status: 'ready',
    searches: [{ keywords: ['source', '请输入供应来源'], mode: 'all', range: 'same-structure' }],
  });
  assert.equal(validateLocatorDecision(decision).valid, true);
  const plan = locatorDecisionToSearchPlan(decision);
  assert.deepEqual(plan.searches[0].keywords, ['source', '请输入供应来源']);
  assert.equal(plan.searches[0].range, 'same-structure');
});

test('locator protocol accepts the minimal planner response', () => {
  const decision = normalizeLocatorDecision({
    status: 'ready',
    searches: [{
      keywords: ['product-upload-section', 'section-title'],
      mode: 'all',
      range: 'same-structure',
      reason: 'DOM structure anchors',
    }],
    reason: '当前 DOM 已有可检索结构',
  });
  const validation = validateLocatorDecision(decision);
  const plan = locatorDecisionToSearchPlan(decision);
  assert.equal(validation.valid, true);
  assert.deepEqual(plan.searches[0].keywords, ['product-upload-section', 'section-title']);
  assert.equal(plan.needMoreDom, false);
});

test('locator prompt requests layered anchor fields used by local execution', () => {
  const prompt = buildLocatorSystemPrompt();
  assert.match(prompt, /renderAnchors/);
  assert.match(prompt, /scopeAnchors/);
  assert.match(prompt, /childComponentAnchors/);
  assert.doesNotMatch(prompt, /\"hypotheses\"/);
  assert.doesNotMatch(prompt, /\"searches\"/);
});

test('locator prompt keeps the extractor focused on stable, layered source-search evidence', () => {
  const prompt = buildLocatorSystemPrompt();
  assert.match(prompt, /DOM 锚点抽取 Agent/);
  assert.match(prompt, /renderAnchors（主渲染锚点/);
  assert.match(prompt, /UI 框架 class/);
  assert.match(prompt, /订单号、用户名、商品名/);
  assert.match(prompt, /need-more-context/);
});

test('locator resolve-route plan asks for more DOM instead of searching runtime evidence', () => {
  const decision = normalizeLocatorDecision({
    status: 'need-more-context',
    searches: [],
    reason: '当前选区只有运行时选中值，需要扩区',
  });
  const validation = validateLocatorDecision(decision);
  assert.equal(validation.valid, true);
  const plan = locatorDecisionToSearchPlan(decision);
  assert.deepEqual(plan.searches, []);
  assert.equal(plan.needMoreDom, true);
});

test('locator system prompt carries Project.md tech stack context', () => {
  const project = {
    context: {
      technicalStackMarkdown: '## 技术栈\n- Vue\n- Naive UI',
    },
  };
  const input = buildLocatorUserInput({
    project,
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
  const prompt = buildLocatorSystemPrompt(locatorTechnicalStackMarkdown(project));
  assert.match(prompt, /## 技术栈\n- Vue\n- Naive UI/);
  assert.equal(Object.prototype.hasOwnProperty.call(input, 'techStack'), false);
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
  assert.deepEqual(inspection.candidates.map(candidate => candidate.file), ['src/Exact.vue']);
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

test('same-structure all plans do not split into single keyword fallbacks', () => {
  const project = fixtureProject({
    'src/Subtask.vue': [
      '<template>',
      '  <Form-item label="执行人"><Input class="input-w" /></Form-item>',
      '  <Form-item label="反馈附件"><Upload /></Form-item>',
      '  <Form-item label="备注"><Input /></Form-item>',
      '</template>',
    ].join('\n'),
    'src/Other.vue': [
      '<template>',
      '  <Form-item label="执行人"><Input /></Form-item>',
      '  <Form-item label="备注"><Input /></Form-item>',
      '</template>',
    ].join('\n'),
  });
  const plan = {
    searches: [{
      keywords: ['执行人', '反馈附件', '备注'],
      mode: 'all',
      range: 'same-structure',
      priority: 1,
      reason: 'compound field context',
      evidenceKinds: {
        '执行人': 'text',
        '反馈附件': 'text',
        '备注': 'text',
      },
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  assert.deepEqual(candidates.map(candidate => candidate.file), ['src/Subtask.vue']);
  assert.deepEqual(candidates[0].matchedGroups.map(group => group.source), ['planned-group']);
});

test('field sibling group outranks shell-only matches in split render structures', () => {
  const project = fixtureProject({
    'src/Parent.vue': [
      '<template>',
      '  <fieldset class="dc-fieldset">',
      '    <legend class="dc-legend">执行信息</legend>',
      '    <Subtask />',
      '  </fieldset>',
      '</template>',
    ].join('\n'),
    'src/Subtask.vue': [
      '<template>',
      '  <Form-item label="执行人"><Input class="input-w" /></Form-item>',
      '  <Form-item label="反馈附件"><Upload /></Form-item>',
      '  <Form-item label="备注"><Input /></Form-item>',
      '</template>',
    ].join('\n'),
    'src/WrongFull.vue': [
      '<template>',
      '  <fieldset class="dc-fieldset">',
      '    <legend class="dc-legend">执行信息</legend>',
      '    <Form-item label="执行人"><Input class="input-w" /></Form-item>',
      '  </fieldset>',
      '</template>',
    ].join('\n'),
  });
  const body = {
    userPrompt: '@选区1 执行人输入框右边增加一个 更多按钮',
    selections: [{
      element: {
        className: 'dc-fieldset',
        rawOuterHtml: [
          '<fieldset class="dc-fieldset">',
          '<legend class="dc-legend">执行信息</legend>',
          '<label class="ivu-form-item-label">执行人</label>',
          '<div class="input-w"></div>',
          '<label class="ivu-form-item-label">反馈附件</label>',
          '<span class="il">暂无反馈附件</span>',
          '<label class="ivu-form-item-label">备注</label>',
          '</fieldset>',
        ].join(''),
      },
    }],
  };
  const plan = {
    searches: [{
      keywords: ['执行人', '反馈附件', '备注'],
      mode: 'all',
      range: 'same-structure',
      priority: 1,
      reason: 'field group',
      evidenceKinds: {
        '执行人': 'text',
        '反馈附件': 'text',
        '备注': 'text',
      },
      domTextStructures: {
        '执行人': [{ text: '执行人', tag: 'label', classes: ['ivu-form-item-label'] }],
        '反馈附件': [{ text: '反馈附件', tag: 'label', classes: ['ivu-form-item-label'] }],
        '备注': [{ text: '备注', tag: 'label', classes: ['ivu-form-item-label'] }],
      },
    }, {
      keywords: ['dc-fieldset', '执行信息'],
      mode: 'all',
      range: 'same-file',
      priority: 2,
      reason: 'shell group',
      keywordTypes: { 'dc-fieldset': 'class-token' },
      evidenceKinds: {
        'dc-fieldset': 'class',
        '执行信息': 'text',
      },
      domTextStructures: {
        '执行信息': [{ text: '执行信息', tag: 'legend', classes: ['dc-legend'] }],
      },
    }],
  };
  const cache = new Map();
  const candidates = executeSearchPlan(project, plan, cache);
  const inspection = inspectCandidates(project, candidates, plan, cache, body);
  assert.equal(inspection.candidates[0].file, 'src/Subtask.vue');
  assert.equal(inspection.status, 'unique');
});

test('complete coverage in one search group removes only its subset candidates', () => {
  const project = fixtureProject({
    'src/Exact.vue': '<template><div>原商品信息 上架配置 商品标题</div></template>',
    'src/Subset.vue': '<template><div>商品标题 状态</div></template>',
    'src/Independent.vue': '<template><div>originalProduct</div></template>',
  });
  const plan = {
    searches: [{
      keywords: ['原商品信息', '上架配置', '商品标题'],
      mode: 'any',
      range: 'same-file',
      priority: 1,
      reason: 'table headers',
    }, {
      keywords: ['originalProduct', 'uploadConfig'],
      mode: 'any',
      range: 'same-file',
      priority: 2,
      reason: 'column keys',
    }],
  };
  const cache = new Map();
  const candidates = executeSearchPlan(project, plan, cache);
  const inspection = inspectCandidates(project, candidates, plan, cache);
  assert.deepEqual(inspection.candidates.map(candidate => candidate.file), [
    'src/Exact.vue',
    'src/Independent.vue',
  ]);
  assert.match(inspection.candidates[0].roleReasons.join(' '), /唯一完整覆盖检索组/);
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

test('multiple render candidates expand first while style and definition files stay references', () => {
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
  assert.equal(evidence.insufficient, true);
  assert.equal(evidence.primaryCandidateCount, 2);
  assert.equal(evidence.referenceCandidateCount, 2);
  assert.match(evidence.reason, /2 个候选文件/);

  const expandedEvidence = analyzeEvidenceSufficiency(plan, inspection, [], {
    expansionRetry: true,
  });
  assert.equal(expandedEvidence.insufficient, false);
  assert.match(expandedEvidence.reason, /进入 Judge/);
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
      searches: [{
        keywords: ['metric-card'],
        mode: 'all',
        range: 'same-file',
        reason: 'DOM class',
      }],
      reason: '定位指标卡片',
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
      searches: [{
        keywords: ['operator'],
        mode: 'all',
        range: 'same-structure',
        reason: '用扩区后的表格列 key 定位渲染结构',
      }],
      reason: '定位所属运营选择器',
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
      searches: [{
        keywords: ['cost'],
        mode: 'all',
        range: 'same-file',
        reason: '扩区后列 key',
      }],
      reason: '定位扩区后的成本列',
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
      searches: [{
        keywords: ['cost'],
        mode: 'all',
        range: 'same-file',
        reason: '扩区后列 key',
      }],
      reason: '定位成本区域查看按钮',
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
  // 新流程：单文件完整结构命中即为占优渲染候选，本地直接收敛并跳过 Judge。
  assert.ok(logs.some(log => log.startsWith('DOM Agent 本地收敛（跳过 Judge）')));
  assert.ok(!logs.some(log => log.startsWith('DOM Agent Judge 输入')));
  assert.equal(result.agent.localConverged, true);
  assert.equal(result.composite.render.file, 'src/MaterialView.vue');
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

test('full recall keeps every candidate before DOM inspection', () => {
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
  assert.equal(hits.length, 18);
  assert.ok(hits.some(hit => hit.file === 'src/Main.vue'));
  assert.ok(hits.some(hit => hit.file === 'src/MenuNode.vue'));

  const inspection = inspectCandidates(project, hits, {
    searches: [{
      keywords: ['主页'],
      mode: 'any',
      range: 'same-file',
      priority: 1,
      reason: '后代文案',
      evidenceKinds: { '主页': 'text' },
    }],
  }, new Map());
  assert.equal(inspection.inspectedCount, 18);
});

test('original DOM class coverage removes render candidates that only match a strict subset', () => {
  const project = fixtureProject({
    'src/Main.vue': [
      '<template>',
      '  <aside class="side-menu-wrapper">',
      '    <span class="nav-name">{{ item.title }}</span>',
      '    <div class="menu-collapsed" />',
      '  </aside>',
      '</template>',
    ].join('\n'),
    'src/Other.vue': '<template><span class="nav-name">{{ title }}</span></template>',
  });
  const plan = {
    searches: [{
      keywords: ['nav-name'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: 'DOM class',
      keywordTypes: { 'nav-name': 'class-token' },
      evidenceKinds: { 'nav-name': 'class' },
    }],
  };
  const cache = new Map();
  const hits = executeSearchPlan(project, plan, cache);
  const inspection = inspectCandidates(project, hits, plan, cache, {
    selections: [{
      element: {
        rawOuterHtml: '<aside class="side-menu-wrapper"><span class="nav-name">主页</span><div class="menu-collapsed"></div></aside>',
      },
    }],
  });
  assert.deepEqual(inspection.candidates.map(item => item.file), ['src/Main.vue']);
  assert.deepEqual(
    inspection.candidates[0].domCoverage.matchedClasses.sort(),
    ['menu-collapsed', 'nav-name', 'side-menu-wrapper']
  );
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

test('route relation does not select a single repeated label when local DOM text context disagrees', () => {
  const project = fixtureProject({
    'src/route.vue': '<script>import Parent from "./parent.vue"</script>',
    'src/parent.vue': '<template><task-module /></template><script>import TaskModule from "./task-module.vue"</script>',
    'src/task-module.vue': [
      '<template>',
      '  <fieldset class="dc-fieldset">',
      '    <legend class="dc-legend">执行信息</legend>',
      '    <component :is="component"></component>',
      '  </fieldset>',
      '</template>',
      '<script>import SubtaskFactory from "./subtask.js"; export default { computed: { component(){ return SubtaskFactory } } }</script>',
    ].join('\n'),
    'src/subtask.js': 'import Subtask from "./subtask.vue"; export default Subtask;',
    'src/subtask.vue': [
      '<template>',
      '  <span>',
      '    <Form-item label="执行人"><Input class="input-w" /></Form-item>',
      '    <Form-item label="反馈附件"><FileUpload /></Form-item>',
      '    <Form-item label="备注"><Input type="textarea" /></Form-item>',
      '  </span>',
      '</template>',
    ].join('\n'),
    'src/add.batch.vue': [
      '<template>',
      '  <fieldset class="dc-fieldset">',
      '    <legend class="dc-legend">任务类型</legend>',
      '    <Form-item label="执行部门"><Input class="input-w" /></Form-item>',
      '    <Form-item label="执行人"><Input class="input-w" /></Form-item>',
      '  </fieldset>',
      '</template>',
    ].join('\n'),
  });
  const body = {
    pagePath: '/Mission/TaskManage/TaskManageList',
    selections: [{
      element: {
        rawOuterHtml: [
          '<fieldset class="dc-fieldset">',
          '<legend class="dc-legend">执行信息</legend>',
          '<label class="ivu-form-item-label">执行人</label>',
          '<div class="input-w"></div>',
          '<label class="ivu-form-item-label">反馈附件</label>',
          '<span>暂无反馈附件</span>',
          '<label class="ivu-form-item-label">备注</label>',
          '</fieldset>',
        ].join(''),
      },
    }],
  };
  const plan = {
    searches: [{
      keywords: ['执行人'],
      mode: 'all',
      range: 'same-file',
      priority: 1,
      reason: '单点后代文案',
      evidenceKinds: { '执行人': 'text' },
      domTextStructures: {
        '执行人': [{ text: '执行人', tag: 'label', classes: ['ivu-form-item-label'] }],
      },
    }],
  };
  const cache = new Map();
  const hits = executeSearchPlan(project, plan, cache);
  const inspection = inspectCandidates(project, hits, plan, cache, body);
  assert.equal(inspection.candidates[0].file, 'src/subtask.vue');
  assert.ok(inspection.candidates[0].domTextCoverage.matchedTexts.includes('反馈附件'));
  assert.ok(inspection.candidates[0].domTextCoverage.matchedTexts.includes('备注'));

  const routeTrace = {
    matched: true,
    bestPageFile: 'src/route.vue',
    hits: [{
      file: 'src/route.vue',
      routePath: '/Mission/TaskManage/TaskManageList',
      reasons: ['路径精确匹配'],
    }],
  };
  const relations = traceRouteCandidateRelations(project, routeTrace, inspection.candidates, cache);
  const decision = resolveByRouteRelation(body, inspection, routeTrace, relations);
  assert.equal(decision.status, 'unique');
  assert.equal(decision.files[0].file, 'src/subtask.vue');
});

// ——— DOM Agent 改造：稀有度 / 两阶段准入 / 组合结果 ———

function wrapperNoiseProject() {
  const files = {};
  // 45 个文件都含通用外壳词 dc-fieldset + 区块标题「执行信息」——超过 DF_SCOPE_LIMIT(40)，
  // 因此它们是真正的「通用词」，不应生成候选；只有 subtask 含完整字段组合。
  for (let i = 0; i < 45; i += 1) {
    files[`src/forms/form-${i}.vue`] = [
      '<template>',
      '  <fieldset class="dc-fieldset"><legend>执行信息</legend>',
      `    <Form-item label="字段${i}" />`,
      '  </fieldset>',
      '</template>',
    ].join('\n');
  }
  files['src/forms/subtask.vue'] = [
    '<template>',
    '  <fieldset class="dc-fieldset"><legend>执行信息</legend>',
    '    <Form-item label="执行人" />',
    '    <Form-item label="反馈附件" />',
    '    <Form-item label="完成时间" />',
    '    <Form-item label="备注" />',
    '  </fieldset>',
    '</template>',
  ].join('\n');
  return fixtureProject(files);
}

test('rarity: generic wrapper anchors never create standalone candidates', () => {
  const project = wrapperNoiseProject();
  const plan = {
    searches: [
      {
        keywords: ['执行人', '反馈附件', '完成时间', '备注'],
        mode: 'all',
        range: 'same-structure',
        priority: 1,
        layer: 'render',
        reason: 'render',
      },
      {
        keywords: ['执行信息', 'dc-fieldset'],
        mode: 'any',
        range: 'same-file',
        priority: 5,
        layer: 'scope',
        scopeOnly: true,
        reason: 'scope',
      },
    ],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  // 通用外壳词 dc-fieldset / 执行信息 命中 13 个文件，绝不能各自生成候选。
  assert.deepEqual(candidates.map(candidate => candidate.file), ['src/forms/subtask.vue']);
  assert.ok(candidates[0].matchedGroups.some(group => group.source === 'planned-group'));
});

test('two-phase admission: an extra absent render anchor still converges to the max-subset file', () => {
  const project = wrapperNoiseProject();
  const plan = {
    searches: [{
      // 模型多放了一个 subtask 里并不存在的锚点「执行信息」（它在 legend 里但不是字段标签）——
      // subtask 仍应凭 4 个字段的最大共现子集被保留。这里让 subtask 缺失一个词来模拟。
      keywords: ['执行人', '反馈附件', '完成时间', '备注', '不存在于任何文件的词XYZ'],
      mode: 'all',
      range: 'same-structure',
      priority: 1,
      layer: 'render',
      reason: 'render',
    }],
  };
  const candidates = executeSearchPlan(project, plan, new Map());
  assert.deepEqual(candidates.map(candidate => candidate.file), ['src/forms/subtask.vue']);
  const dominant = dominantRenderCandidate(
    inspectCandidates(project, candidates, plan, new Map())
  );
  assert.ok(dominant);
  assert.equal(dominant.file, 'src/forms/subtask.vue');
});

test('buildComposite assembles render + assembly(owner) + child components', () => {
  const project = fixtureProject({
    'src/parent.vue': "<script>import Subtask from './subtask.vue'</script>",
    'src/subtask.vue': '<template><div class="feedback-field">反馈附件</div></template>',
    'src/file-upload.vue': '<template><div class="file-upload-component" /></template>',
  });
  const inspection = {
    status: 'unique',
    selectedFile: 'src/subtask.vue',
    candidates: [
      {
        file: 'src/subtask.vue',
        score: 500,
        referenceOnly: false,
        childComponentCandidate: false,
        matchedGroups: [{ source: 'planned-group', keywords: ['反馈附件'] }],
      },
      {
        file: 'src/file-upload.vue',
        score: 120,
        referenceOnly: false,
        childComponentCandidate: true,
        matchedGroups: [{ source: 'planned-group', keywords: ['file-upload-component'] }],
      },
    ],
  };
  const ownership = traceCandidateOwners(project, ['src/subtask.vue'], new Map());
  const composite = buildComposite(inspection, ownership, 'src/subtask.vue');
  assert.equal(composite.render.file, 'src/subtask.vue');
  assert.equal(composite.assembly.file, 'src/parent.vue');
  assert.deepEqual(composite.children.map(child => child.file), ['src/file-upload.vue']);
});

test('normalizeConfidence maps 0-1 fractions and 0-100 alike into 0-100', () => {
  assert.equal(normalizeConfidence(0.95), 95);
  assert.equal(normalizeConfidence(1), 100);
  assert.equal(normalizeConfidence(95), 95);
  assert.equal(normalizeConfidence(0), 0);
  assert.equal(normalizeConfidence('bad'), 0);
  assert.equal(normalizeConfidence(250), 100);
});

test('child component candidates do not count as competing render candidates', () => {
  const evidence = analyzeEvidenceSufficiency(
    { searches: [], needMoreDom: false },
    {
      candidates: [
        { file: 'src/subtask.vue', score: 500, referenceOnly: false, childComponentCandidate: false, matchedGroups: [{ source: 'planned-group', keywords: ['执行人', '反馈附件'] }] },
        { file: 'src/file-upload.vue', score: 120, referenceOnly: false, childComponentCandidate: true, matchedGroups: [{ source: 'planned-group', keywords: ['file-upload-component'] }] },
      ],
    },
    []
  );
  assert.equal(evidence.insufficient, false);
  assert.equal(evidence.primaryCandidateCount, 1);
});

test('Stage0: runtime component chain __file converges deterministically without any model call', async () => {
  const project = fixtureProject({
    'src/layout/SideMenu.vue': '<template><div class="menu">工作台</div></template>',
    'src/router/index.js': "import SideMenu from '../layout/SideMenu.vue'",
  });
  const bigDom = '<div class="menu">' + '工作台'.repeat(4000) + '</div>'; // 超过触发阈值，进入 agent
  let modelCalls = 0;
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' },
    pagePath: '/workbench',
    selections: [{
      element: { rawOuterHtml: bigDom },
      sourceLocate: {
        componentChain: [
          { name: 'SideMenu', file: 'src/layout/SideMenu.vue' },
          { name: 'RouterRoot', file: 'src/router/index.js' },
        ],
      },
    }],
  }, {
    runModelTask: async () => {
      modelCalls += 1;
      return { adapter: { id: 't', name: 't', type: 'api' }, rawText: '{}', logs: [] };
    },
  });
  assert.equal(modelCalls, 0);
  assert.equal(result.agent.stage0, true);
  assert.equal(result.hits[0].file, 'src/layout/SideMenu.vue');
  assert.equal(result.composite.render.file, 'src/layout/SideMenu.vue');
  assert.equal(result.composite.assembly.file, 'src/router/index.js');
});

test('class-token matching covers static, bound object/array/ternary and clsx, but excludes bracket access', () => {
  const project = fixtureProject({
    'src/static.vue': '<template><div class="dom-list"></div></template>',
    'src/objUnquoted.vue': '<template><div :class="{ dom-list: true }"></div></template>',
    'src/objQuoted.vue': "<template><div :class=\"{ 'dom-list': true }\"></div></template>",
    'src/array.vue': "<template><div :class=\"['dom-list', on]\"></div></template>",
    'src/ternary.jsx': "export const A = () => <div className={ok ? 'dom-list' : 'x'} />",
    'src/clsx.jsx': "export const B = () => <div className={clsx('wrap', 'dom-list')} />",
    'src/bracket.js': "const a = styles['dom-list']; const b = map['dom-list'];",
  });
  const plan = { searches: [{ keywords: ['dom-list'], mode: 'any', range: 'same-file', priority: 1, keywordTypes: { 'dom-list': 'class-token' } }] };
  const files = executeSearchPlan(project, plan, new Map()).map(candidate => candidate.file).sort();
  assert.deepEqual(files, [
    'src/array.vue',
    'src/clsx.jsx',
    'src/objQuoted.vue',
    'src/objUnquoted.vue',
    'src/static.vue',
    'src/ternary.jsx',
  ]);
  // 纯 JS 括号取值 styles['dom-list'] 不是 class 用法，作为 class 锚点时必须被排除。
  assert.ok(!files.includes('src/bracket.js'));
});

test('buildComposite surfaces sibling co-renders when two peer components each render part of the DOM', () => {
  const inspection = {
    status: 'ambiguous',
    selectedFile: 'src/LeftPane.vue',
    candidates: [
      { file: 'src/LeftPane.vue', score: 500, referenceOnly: false, childComponentCandidate: false,
        matchedGroups: [{ source: 'planned-group', keywords: ['筛选条件', '关键词'] }] },
      { file: 'src/RightPane.vue', score: 460, referenceOnly: false, childComponentCandidate: false,
        matchedGroups: [{ source: 'planned-group', keywords: ['结果列表', '导出'] }] },
      { file: 'src/styles.css', score: 80, referenceOnly: true, childComponentCandidate: false,
        matchedGroups: [{ source: 'keyword-fallback', keywords: ['筛选条件'] }] },
    ],
  };
  const composite = buildComposite(inspection, [], 'src/LeftPane.vue');
  assert.equal(composite.render.file, 'src/LeftPane.vue');
  assert.ok(Array.isArray(composite.coRenders));
  assert.deepEqual(composite.coRenders.map(item => item.file), ['src/RightPane.vue']);
  // 参考文件(样式)不算并列渲染
  assert.ok(!composite.coRenders.some(item => item.file === 'src/styles.css'));
});

test('framework-generated data attributes reduce to their value, author attributes are preserved', () => {
  // data-col-key 是 Naive UI 表格运行时生成的属性，源码里不存在——只能用它的值 cost。
  const runtimeAttr = normalizeLocatorDecision({
    status: 'ready',
    renderAnchors: [{ value: 'data-col-key="cost"', kind: 'attr' }, { value: '查看', kind: 'text' }],
  });
  assert.deepEqual(locatorDecisionToSearchPlan(runtimeAttr).searches[0].keywords, ['cost', '查看']);

  // data-testid 是作者书写的稳定属性，保留 name="value" 交给下游做属性对匹配。
  const authorAttr = normalizeLocatorDecision({
    status: 'ready',
    renderAnchors: [{ value: 'data-testid="cost-cell"', kind: 'attr' }, { value: '查看', kind: 'text' }],
  });
  assert.deepEqual(locatorDecisionToSearchPlan(authorAttr).searches[0].keywords, ['data-testid="cost-cell"', '查看']);
});

test('a Naive UI render-function cell locates its columns source via the reduced attribute value', () => {
  const project = fixtureProject({
    'src/order/columns.tsx': [
      "import { h } from 'vue'",
      "export const cols = [{ key: 'cost', title: '成本', render: (row) =>",
      "  h('div', { style: 'display:flex;flex-direction:column' }, [",
      "    h('div', '¥' + row.total), h(NButton, {}, { default: () => '查看' })]) }]",
    ].join('\n'),
    'src/other/columns.tsx': "export const cols = [{ key: 'name', title: '名称' }]",
  });
  // 归约后的关键词 cost + 查看，same-structure 共现于 columns.tsx。
  const plan = { searches: [{ keywords: ['cost', '查看'], mode: 'all', range: 'same-structure', priority: 1, layer: 'render' }] };
  const candidates = executeSearchPlan(project, plan, new Map());
  assert.deepEqual(candidates.map(candidate => candidate.file), ['src/order/columns.tsx']);
});

test('a .vue SFC is a render source even when its script has definition-like signals; a router config .ts stays a reference', () => {
  // 数据驱动菜单：路由配置里含菜单文案/路径(铺品 /ai-product)，会被检索命中，
  // 但它不渲染 DOM，必须保持 referenceOnly；而 .vue 组件即使脚本里有 export default {}，也应是渲染源码。
  const project = fixtureProject({
    'src/layout/side-menu.vue': [
      '<template><div class="x-menu main-layout-left-menu">铺品</div></template>',
      "<script>export default { name: 'SideMenu' }</script>",
    ].join('\n'),
    'src/router/modules/workbench.ts': [
      'export default [',
      "  { path: '/ai-product', name: 'AiProduct', meta: { title: '铺品' },",
      "    children: [{ path: 'product-card', meta: { title: 'AI铺品' } }] }",
      ']',
    ].join('\n'),
  });
  const plan = { searches: [{ keywords: ['铺品', '铺品'], mode: 'any', range: 'same-file', priority: 1 }] };
  const candidates = [
    { file: 'src/layout/side-menu.vue', score: 200, matchedGroups: [{ source: 'planned-group', keywords: ['铺品'] }], keywords: ['铺品'], positions: [0] },
    { file: 'src/router/modules/workbench.ts', score: 300, matchedGroups: [{ source: 'planned-group', keywords: ['铺品'] }], keywords: ['铺品'], positions: [0] },
  ];
  const inspection = inspectCandidates(project, candidates, plan, new Map());
  const byFile = new Map(inspection.candidates.map(candidate => [candidate.file, candidate]));
  assert.equal(byFile.get('src/layout/side-menu.vue')?.referenceOnly, false);
  assert.equal(byFile.get('src/router/modules/workbench.ts')?.referenceOnly, true);
});

test('a definition-like config file is never returned as a render candidate', () => {
  // 即便路由配置命中了 planned-group，也不能算主渲染候选（否则会把 .ts 路由当成 DOM 源码返回）。
  const evidence = analyzeEvidenceSufficiency(
    { searches: [], needMoreDom: false },
    {
      candidates: [{
        file: 'src/router/modules/workbench.ts',
        score: 400,
        referenceOnly: true,
        childComponentCandidate: false,
        matchedGroups: [{ source: 'planned-group', keywords: ['铺品', '/ai-product'] }],
      }],
    },
    []
  );
  assert.equal(evidence.insufficient, true);
  assert.equal(evidence.primaryCandidateCount, 0);
});

test('data-driven menu: locates the menu component by its business class, not the router config that holds the labels', async () => {
  const project = fixtureProject({
    'src/layout/side-menu.vue': [
      '<template><div class="x-menu main-layout-left-menu n-menu"><n-menu :options="opts" /></div></template>',
      "<script setup>const opts = buildFromRoutes()</script>",
    ].join('\n'),
    'src/router/modules/workbench.ts': [
      'export default [',
      "  { path: '/ai-product', meta: { title: '铺品' }, children: [",
      "    { path: 'product-card', meta: { title: 'AI铺品' } }] }",
      ']',
    ].join('\n'),
  });
  const dom = '<div class="x-menu main-layout-left-menu n-menu"><a href="/ai-product">铺品</a><a href="/ai-product/product-card">AI铺品</a></div>';
  const outputs = [
    JSON.stringify({ status: 'ready', renderAnchors: [
      { value: 'main-layout-left-menu', kind: 'class' }, { value: 'x-menu', kind: 'class' },
      { value: '铺品', kind: 'text' }, { value: '/ai-product', kind: 'attr' }] }),
    JSON.stringify({ status: 'unique', files: [{ file: 'src/layout/side-menu.vue', role: 'render', confidence: 0.95, reason: '菜单组件' }] }),
  ];
  let calls = 0;
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' }, userPrompt: '定位左侧菜单',
    selections: [{ element: { className: 'x-menu main-layout-left-menu n-menu', selector: 'div.x-menu.main-layout-left-menu.n-menu', rawOuterHtml: dom } }],
  }, { runModelTask: async () => ({ adapter: { id: 't', name: 't', type: 'api' }, rawText: outputs[calls++] || '{}', logs: [] }) });
  const files = (result.hits || []).map(hit => hit.file);
  // 关键断言：不渲染 DOM 的路由配置绝不能作为渲染结果；真正的菜单组件应被 business class 命中。
  assert.ok(!files.includes('src/router/modules/workbench.ts'));
  assert.equal(result.composite?.render.file, 'src/layout/side-menu.vue');
});

test('a rare business class in the scope layer still surfaces the render component (x-menu), and the router is never returned', async () => {
  // 复现真实日志：Planner 把菜单文案/路径放进 render 组(只命中路由配置)，把 business class x-menu 放进 scope。
  // 旧实现里 scope 锚点从不生成候选 → 含 x-menu 的菜单组件被丢弃，只剩路由配置。
  const project = fixtureProject({
    'src/layout/side-menu.vue': [
      '<template><div class="x-menu main-layout-left-menu n-menu"><n-menu :options="opts" /></div></template>',
      '<script setup>const opts = buildFromRoutes()</script>',
    ].join('\n'),
    'src/router/modules/workbench.ts': [
      "import Layout from '@/layout/index.vue'",
      'export default [{ path: \'/ai-product\', component: Layout, meta: { title: \'铺品\' },',
      "  children: [{ path: 'product-card', meta: { title: 'AI铺品' } }, { path: 'goods-manage', meta: { title: '店搬店' } }] }]",
    ].join('\n'),
  });
  const dom = '<div class="x-menu main-layout-left-menu n-menu"><a href="/ai-product">铺品</a><a href="/ai-product/product-card">AI铺品</a><a href="/ai-product/goods-manage">店搬店</a></div>';
  const outputs = [
    JSON.stringify({ status: 'ready',
      renderAnchors: [{ value: 'AI铺品', kind: 'text' }, { value: '店搬店', kind: 'text' }, { value: '/ai-product/product-card', kind: 'attr' }],
      scopeAnchors: [{ value: '铺品', kind: 'text' }, { value: 'x-menu', kind: 'class' }] }),
  ];
  let calls = 0;
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' }, userPrompt: '定位左侧菜单',
    selections: [{ element: { className: 'x-menu main-layout-left-menu n-menu', selector: 'div.x-menu.main-layout-left-menu.n-menu', rawOuterHtml: dom } }],
  }, { runModelTask: async () => ({ adapter: { id: 't', name: 't', type: 'api' }, rawText: outputs[calls++] || '{}', logs: [] }) });
  const files = (result.hits || []).map(hit => hit.file);
  assert.ok(!files.includes('src/router/modules/workbench.ts'));
  assert.equal(files[0], 'src/layout/side-menu.vue');
  assert.equal(result.composite?.render.file, 'src/layout/side-menu.vue');
});

test('offsetToLineColumn computes 1-based line:column', () => {
  const text = 'a\nbc\nxyz';
  assert.deepEqual(offsetToLineColumn(text, 0), { line: 1, column: 1 });   // 'a'
  assert.deepEqual(offsetToLineColumn(text, 2), { line: 2, column: 1 });   // 'b'
  assert.deepEqual(offsetToLineColumn(text, 6), { line: 3, column: 2 });   // 'y'
});

test('coarse-to-fine: after expansion finds the file, the hit pins back to the original selection anchor line', async () => {
  const files = {};
  for (let i = 0; i < 41; i += 1) files[`src/pages/list-${i}.vue`] = '<template><button>查看</button></template>';
  files['src/pages/order-detail.vue'] = [
    '<template>',
    '  <div class="order-detail-panel">',
    '    <span>订单</span>',
    '    <button class="op-btn" @click="view">查看</button>',
    '  </div>',
    '</template>',
  ].join('\n');
  const project = fixtureProject(files);
  const dom = '<div class="order-detail-panel"><span>订单</span><button class="op-btn">查看</button></div>';
  const outputs = [
    JSON.stringify({ status: 'ready', renderAnchors: [{ value: 'order-detail-panel', kind: 'class' }, { value: '查看', kind: 'text' }] }),
    JSON.stringify({ status: 'unique', files: [{ file: 'src/pages/order-detail.vue', role: 'render', confidence: 0.9, reason: 'x' }] }),
  ];
  let calls = 0;
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' }, userPrompt: '定位查看',
    agentState: { expansionRetry: true, previousPlan: { searches: [{ keywords: ['查看'], mode: 'any', range: 'same-file' }] } },
    selections: [{ element: { className: 'order-detail-panel', rawOuterHtml: dom } }],
  }, { runModelTask: async () => ({ adapter: { id: 't', name: 't', type: 'api' }, rawText: outputs[calls++] || '{}', logs: [] }) });
  const hit = (result.hits || [])[0];
  assert.equal(hit.file, 'src/pages/order-detail.vue');
  assert.equal(hit.line, 4);              // 「查看」所在行，而不是扩区锚点 order-detail-panel(第2行)
  assert.equal(hit.locatedAnchor, '查看');
  assert.equal(result.composite.render.line, 4);
});

test('fine-location honors sticky focusAnchors: after expanding to a whole table row, it returns to the originally selected column', () => {
  const project = fixtureProject({
    'src/views/product/columns.tsx': [
      "import { h } from 'vue'",
      'export const cols = [',
      "  { key: 'productInfo', render: (row) => h('div', row.title) },",
      "  { key: 'cost', render: (row) => h('div', [h('div', '¥' + row.x), h(NButton, {}, { default: () => '点击设置' })]) },",
      "  { key: 'action', render: () => h(NFlex, [h(NButton, {}, { default: () => '复制' }), h(NButton, {}, { default: () => '删除' })]) },",
      ']',
    ].join('\n'),
  });
  // 扩区到整行：render 组包含所有列的锚点。
  const plan = { searches: [{ layer: 'render', mode: 'all', range: 'same-structure', keywords: ['点击设置', '复制', '删除'], evidenceKinds: { '点击设置': 'text', '复制': 'text', '删除': 'text' } }] };
  // 用户最初选的是 cost 单元格 → focusAnchors=[点击设置] → 定位到 cost 那行(第4行)。
  const costLoc = computeFineLocation(project, 'src/views/product/columns.tsx', plan,
    { expansionRetry: true, previousPlan: { searches: [] }, focusAnchors: ['点击设置'] }, new Map());
  assert.equal(costLoc.anchor, '点击设置');
  assert.equal(costLoc.line, 4);
  // 若最初选的是 action 单元格 → focusAnchors=[复制] → 定位到 action 那行(第5行)，证明是真回到用户选的列。
  const actionLoc = computeFineLocation(project, 'src/views/product/columns.tsx', plan,
    { expansionRetry: true, previousPlan: { searches: [] }, focusAnchors: ['复制'] }, new Map());
  assert.equal(actionLoc.anchor, '复制');
  assert.equal(actionLoc.line, 5);
});

test('validateOriginRelation: valid on direct-contain or import-reference, invalid when unrelated', () => {
  const project = fixtureProject({
    'src/A.vue': '<template><button>查看</button></template>',
    'src/B.vue': "<script>import A from './A.vue'</script><template><A /></template>",
    'src/C.vue': '<template><div>无关</div></template>',
  });
  const cache = new Map();
  assert.equal(validateOriginRelation(project, 'src/A.vue', ['查看'], cache).valid, true);   // 直接包含
  assert.equal(validateOriginRelation(project, 'src/B.vue', ['查看'], cache).valid, true);   // 引用了含锚点的文件
  assert.equal(validateOriginRelation(project, 'src/C.vue', ['查看'], cache).valid, false);  // 毫无关系
  assert.equal(validateOriginRelation(project, 'src/C.vue', [], cache).valid, true);         // 无 origin 锚点则跳过
});

test('origin mismatch: an expanded-row match that has no relation to the original cell is rejected, not returned', async () => {
  // 复现 winsup：扩到整行后命中了 quick-edit-modal（含 operator/channels），但它与原始选区(查看)毫无关系。
  const project = fixtureProject({
    'src/views/quick-edit-modal.vue': [
      '<template><n-select :options="operatorOptions" /><n-checkbox-group :value="channels" /></template>',
      '<script setup>const operatorOptions = []; const channels = []</script>',
    ].join('\n'),
    'src/views/unrelated.vue': '<template><div>别的</div></template>',
  });
  const dom = '<tr><td data-col-key="operator">薛俊峰</td><td data-col-key="channels">快手CID</td></tr>';
  const outputs = [
    JSON.stringify({ status: 'ready', renderAnchors: [{ value: 'operator', kind: 'attr' }, { value: 'channels', kind: 'attr' }] }),
  ];
  let calls = 0;
  const result = await runAgentSearch(project, {
    adapter: { type: 'api' }, userPrompt: '定位查看按钮',
    agentState: { expansionRetry: true, previousPlan: { searches: [] }, focusAnchors: ['查看'] },
    selections: [{ element: { rawOuterHtml: dom } }],
  }, { runModelTask: async () => ({ adapter: { id: 't', name: 't', type: 'api' }, rawText: outputs[calls++] || '{}', logs: [] }) });
  assert.equal((result.hits || []).length, 0);
  assert.equal(result.agent.originMismatch, true);
  assert.equal(result.needMoreDom, true);
});
