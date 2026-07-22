'use strict';

const { createToolProvider } = require('./provider');
const { buildTool } = require('./tool');
const { readProjectKnowledge } = require('../../experience/project-knowledge');

// consult_project_knowledge：返回“定向线索”，不含写死的 UI 库表。
// UI 库的 class 前缀/签名映射来自 .magnus/project-knowledge.json 里烘焙的 frameworkProfiles
// （扫描时经 context7 派生，对任意库、对版本）；自定义前缀/业务目录同样来自该结构化文件。
// 读不到文件/为空时安全退化（框架 unknown，但 anchor 规划仍可用）。
// anchor 规划纯从输入 DOM 信号计算；Experience 线索留可插拔接缝。
// 所有返回项都是“线索/先验”，不是结论，必须由检索/读取工具实测确认。

const GENERIC_SKIP_CLASSES = new Set([
  'clearfix', 'fl', 'fr', 'row', 'col', 'container', 'wrapper', 'active', 'disabled', 'hidden', 'show',
]);
const GENERIC_SKIP_PREFIXES = [
  { prefix: 'text-', action: 'skip', reason: '通用文本对齐/样式工具类' },
  { prefix: 'col-', action: 'skip', reason: '通用栅格类' },
  { prefix: 'row-', action: 'skip', reason: '通用栅格类' },
];
const BUSINESS_ROOT_CANDIDATES = ['src/b-components', 'src/components', 'src/view', 'src/views', 'src/pages', 'src'];
const AVOID_ROOTS = ['node_modules', 'dist', 'build', '.git', 'coverage'];

const VERIFICATION_TEXT =
  '以上均为线索/先验，不是结论。任何候选文件或 anchor 必须先用 search_source_evidence 或 read_file 实测确认，' +
  '方可写入 finish_dom_location。Experience 线索可能与当前代码不符，务必现场校验。';

// 汇总当前项目知识（全部来自 project-knowledge.json，无静态回退表）。
function resolveKnowledge(project) {
  const file = readProjectKnowledge(project);
  const frameworkProfiles = file && Array.isArray(file.frameworkProfiles) ? file.frameworkProfiles : [];
  return {
    frameworkProfiles,
    frameworks: file && Array.isArray(file.frameworks) ? file.frameworks.map(String) : (Array.isArray(project.stack) ? project.stack.map(String) : []),
    customClassPrefixes: file && Array.isArray(file.customClassPrefixes) ? file.customClassPrefixes : [],
    businessDirs: file && Array.isArray(file.businessDirs) ? file.businessDirs : [],
    knowledgeFilePresent: Boolean(file),
    profilesPresent: frameworkProfiles.length > 0,
  };
}

function frameworkPrefixSet(frameworkProfiles) {
  const set = new Set();
  for (const profile of frameworkProfiles) {
    for (const entry of Array.isArray(profile.classPrefixes) ? profile.classPrefixes : []) {
      if (entry && entry.prefix) set.add(String(entry.prefix));
    }
  }
  return set;
}

function classPrefixOf(cls) {
  const idx = String(cls).indexOf('-');
  return idx > 0 ? String(cls).slice(0, idx + 1) : '';
}

// 疑似“数据绑定”文字：整句式、含占位标记或句读标点、过长 —— grep 大概率 0 命中，勿作锚点。
function looksDataBound(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/[xX]{2}/.test(t)) return true;
  if (/[，。、；：（）()/…]/.test(t)) return true;
  if (/\d[、.．]/.test(t)) return true;
  if (t.length >= 10) return true;
  return false;
}

function isLabelLike(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 2 || t.length > 8) return false;
  return /[一-龥A-Za-z]/.test(t);
}

function planAnchors(input, knowledge) {
  const domClasses = Array.isArray(input.domClasses) ? [...new Set(input.domClasses.map(String))] : [];
  const domTexts = Array.isArray(input.domTexts) ? [...new Set(input.domTexts.map(String))] : [];
  const frameworkPrefixes = frameworkPrefixSet(knowledge.frameworkProfiles);
  const customPrefixes = new Set(knowledge.customClassPrefixes.map(entry => entry.prefix));
  const hasKnowledge = knowledge.knowledgeFilePresent;

  const skip = [];
  for (const cls of domClasses) {
    const prefix = classPrefixOf(cls);
    if (frameworkPrefixes.has(prefix)) {
      skip.push({ text: cls, why: `框架 class（前缀 ${prefix}）` });
    } else if (customPrefixes.has(prefix)) {
      skip.push({ text: cls, why: `项目自定义组件前缀 ${prefix}（本地扫描验证），降权` });
    } else if (GENERIC_SKIP_CLASSES.has(cls) || GENERIC_SKIP_PREFIXES.some(p => cls.startsWith(p.prefix))) {
      skip.push({ text: cls, why: '通用布局/工具类' });
    } else if (!hasKnowledge && prefix && /^[a-z]{1,4}-$/.test(prefix)) {
      // 无结构化知识时的回退：短前缀启发式降权（可能误报，故仅在无 project-knowledge 时启用）。
      skip.push({ text: cls, why: `疑似项目自定义组件前缀 ${prefix}，降权（启发式，未经本地验证）` });
    }
  }

  const dataBoundSuspects = [];
  const recommended = [];
  for (const text of domTexts) {
    if (looksDataBound(text)) {
      dataBoundSuspects.push({ text, why: '整句式/含占位或句读标点/过长，疑似 :placeholder 等数据绑定，grep 大概率 0 命中，勿作锚点' });
    } else if (isLabelLike(text)) {
      recommended.push({ text, why: '短静态文案，适合作 label 锚点' });
    }
  }

  return {
    recommended,
    skip,
    dataBoundSuspects,
    intersectionHint: '单个 label 常命中多文件；从 recommended 里取 ≥2 个求交集收敛，勿凭单词下结论',
  };
}

function detectSearchScopes(project, businessDirs) {
  const files = Array.isArray(project.files) ? project.files.map(f => String(f.path || '')) : [];
  const preferredRoots = businessDirs.length
    ? businessDirs
    : BUSINESS_ROOT_CANDIDATES.filter(root => files.some(p => p === root || p.startsWith(`${root}/`)));
  return {
    preferredRoots: preferredRoots.length ? preferredRoots : ['src'],
    avoidRoots: AVOID_ROOTS,
    reason: '优先业务/视图组件目录；渲染常与路由页隔着动态 include，勿把 roots 限死在路由文件所在目录',
  };
}

// 动态 Experience 线索的可插拔接缝。当前无稳定数据源 → 返回空并说明。
function loadExperienceLeads(/* project, symbols */) {
  return { leads: [], available: false };
}

function consultProjectKnowledge(project, input = {}) {
  const knowledge = resolveKnowledge(project);
  const { frameworkProfiles, frameworks, customClassPrefixes, businessDirs, knowledgeFilePresent, profilesPresent } = knowledge;

  const classPolicy = [
    ...frameworkProfiles.flatMap(p => (Array.isArray(p.classPrefixes) ? p.classPrefixes : [])),
    ...GENERIC_SKIP_PREFIXES,
    ...customClassPrefixes.map(entry => ({ prefix: entry.prefix, action: entry.action || 'downweight', reason: entry.reason || '项目自定义高频前缀' })),
  ];
  const signatureHints = frameworkProfiles
    .flatMap(p => (Array.isArray(p.signatureHints) ? p.signatureHints : []))
    .map(h => ({ ...h, mustVerify: true, source: 'context7-derived' }));

  const anchorPlan = planAnchors(input, knowledge);
  const searchScopes = detectSearchScopes(project, businessDirs);
  const experience = loadExperienceLeads(project, input.symbols);

  const provenance = [
    { field: 'frameworkProfiles', source: profilesPresent ? 'project-knowledge.json(context7-derived)' : 'unavailable' },
    { field: 'classPolicy(custom)', source: customClassPrefixes.length ? 'project-knowledge.json(measured)' : 'heuristic-fallback' },
    { field: 'searchScopes', source: businessDirs.length ? 'project-knowledge.json' : 'runtime-heuristic' },
    { field: 'experienceLeads', source: experience.available ? 'experience(dynamic)' : 'unavailable' },
  ];

  const notes = [];
  if (!knowledgeFilePresent) notes.push('未读取到 .magnus/project-knowledge.json；自定义前缀/业务目录走启发式回退（可能有误报），无 UI 签名。');
  if (knowledgeFilePresent && !profilesPresent) notes.push('project-knowledge.json 无 frameworkProfiles（context7 未派生到或不可用）；框架签名/前缀 skip 缺失，仅提供通用 anchor 规划。');
  if (!experience.available) notes.push('当前无可用的动态 Experience 数据源，experienceLeads 为空。');

  return {
    operation: 'consult_project_knowledge',
    intent: String(input.intent || ''),
    framework: {
      name: frameworkProfiles.length ? frameworkProfiles.map(p => p.name).join(' + ') : 'unknown',
      stackLabels: frameworks,
      confidence: frameworkProfiles.length ? 90 : 0,
      classPolicy,
    },
    signatureHints,
    anchorPlan,
    searchScopes,
    experienceLeads: experience.leads,
    verification: VERIFICATION_TEXT,
    provenance,
    notes,
  };
}

const KNOWLEDGE_TOOLS = [
  buildTool({
    name: 'consult_project_knowledge',
    title: 'Consult Project Knowledge',
    description:
      'Return orientation LEADS for locating DOM source: UI framework signatures (class-prefix policy + ' +
      'DOM-signature→source-construct hints, derived from context7 docs for the project\'s actual library/version), ' +
      'anchor plan (which texts to grep vs skip vs treat as data-bound), preferred search scopes, and Experience leads. ' +
      'All fields are priors/leads, NOT conclusions — every candidate file or anchor must be verified with ' +
      'search_source_evidence/read_file before it may enter finish_dom_location. ' +
      'Intended as the FIRST call, once per investigation.',
    category: 'knowledge',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string' },
        domClasses: { type: 'array', items: { type: 'string' } },
        domTexts: { type: 'array', items: { type: 'string' } },
        domTags: { type: 'array', items: { type: 'string' } },
        symbols: { type: 'array', items: { type: 'string' } },
      },
      required: ['intent'],
    },
    call: ({ project, input }) => consultProjectKnowledge(project, input),
  }),
];

const knowledgeToolProvider = createToolProvider({
  id: 'builtin.knowledge',
  title: 'Project Knowledge Tools',
  source: 'builtin',
  description: 'Orientation leads (framework signatures, anchor plan, search scopes, experience) for DOM source location.',
  tools: KNOWLEDGE_TOOLS,
});

module.exports = {
  knowledgeToolProvider,
  consultProjectKnowledge,
  resolveKnowledge,
  planAnchors,
  looksDataBound,
};
