const VALID_STATUSES = new Set(['ready', 'need-more-context', 'resolved', 'insufficient']);
const VALID_CAPABILITIES = new Set([
  'expand-dom',
  'resolve-route',
  'locate-structure',
  'trace-rendering',
  'trace-style',
  'trace-event',
  'trace-data',
  'inspect-candidates',
  'trace-imports',
  'validate-relation',
]);
const VALID_RELATIONS = new Set([
  'same-scope',
  'same-rendering-context',
  'same-style-context',
  'same-event-context',
  'same-data-context',
  'same-object',
  'same-template-block',
  'import-relation',
  'parent-child-context',
]);
const VALID_SCOPE_HINTS = new Set([
  'current-selection',
  'runtime-chain-first',
  'route-entry-first',
  'candidate-files-first',
  'direct-dependencies-first',
  'shared-components-first',
]);

function buildLocatorSystemPrompt() {
  return [
    '你是 Magnus 的 DOM 检索线索分析器。',
    '',
    '输入包含：用户需求、动态技术栈、页面上下文、当前 DOM、已有真实源码证据。',
    '',
    '你的任务：',
    '',
    '理解用户关注的 DOM 目标。',
    '从 DOM 中选择可能能在源码中检索到的稳定线索。',
    '排除不适合作为源码检索词的内容。',
    '当前没有可用检索线索时，申请扩区。',
    '',
    '规则：',
    '',
    '- DOM 是运行时结果，不等于源码。',
    '- 不把推测当作事实。',
    '- 不编造文件、组件、变量、字段、关键词或路径。',
    '- 检索词只能来自当前 DOM、页面上下文或已有真实源码证据。',
    '- 结合动态技术栈判断哪些内容可能是框架或 UI 组件运行时产物。',
    '- 框架 class、组件库 class、运行时 style、CSS 变量、动态 hash class、SVG path 不得加入检索计划。',
    '- 对 DOM 文案必须判断：',
    '  - source-copy：固定界面文案，可能存在于源码，可参与检索。',
    '  - runtime-data：用户名、金额、日期、商品名、列表数据、当前选中值、用户输入、接口状态等，通常来自运行时数据，不得作为检索词。',
    '  - unknown：无法判断来源，不得作为首轮独立检索词。',
    '- data-*、id、name、href、稳定属性值、固定界面文案、业务 class、页面路径可以作为检索线索。',
    '- 只要存在一个合理检索线索，就返回 ready；无法最终确认源码不等于必须扩区。',
    '- 只有没有任何合理检索线索，或本地检索后无法继续时，才返回 need-more-context。',
    '- 最多输出 2 个检索计划。',
    '',
    '额外限制：',
    '',
    '- runtime-data、框架 class、组件库 class、style、CSS 变量、SVG path 不得出现在 searches.keywords。',
    '- need-more-context 时只能输出 expand-dom。',
    '- ready 时至少有一个非空 searches.keywords。',
    '- resolved 时 nextPlan 必须为空。',
    '',
    '严格输出 JSON，不输出 Markdown，不输出解释文字。',
    '',
    '输出结构：',
    JSON.stringify({
      status: 'ready | need-more-context | resolved | insufficient',
      understanding: {
        userTarget: '',
        selectedDomAnchors: [],
        ignoredDomAnchors: [],
      },
      evidenceAssessment: {
        sufficient: false,
        missingEvidence: [],
      },
      hypotheses: [{
        id: '',
        description: '',
        confidence: 0,
        basedOn: [],
      }],
      nextPlan: [{
        id: '',
        capability: 'expand-dom | resolve-route | locate-structure | trace-rendering | trace-style | trace-event | trace-data | inspect-candidates | trace-imports | validate-relation',
        searches: [{
          keywords: [],
          mode: 'all | any',
          range: 'same-file | same-structure',
          reason: '',
        }],
        relation: 'same-scope | same-rendering-context | same-style-context | same-event-context | same-data-context | same-object | same-template-block | import-relation | parent-child-context',
        scopeHint: 'current-selection | runtime-chain-first | route-entry-first | candidate-files-first | direct-dependencies-first | shared-components-first',
        purpose: '',
      }],
      stopReason: '',
    }),
  ].join('\n');
}

function buildLocatorUserInput({ project, body, routeTrace, domSelections = [], executionHistory = [], evidence = { plans: [], results: [], rejectedPlans: [] } }) {
  const techStackMarkdown = project?.context?.technicalStackMarkdown || [
    '## 技术栈',
    ...((project?.stack || []).map(item => `- ${item}`)),
  ].filter(Boolean).join('\n');
  return {
    roundType: 'initial-dom-planning',
    requirement: body?.userPrompt || '',
    techStack: {
      markdown: techStackMarkdown,
    },
    pageContext: {
      url: body?.url || '',
      pathname: body?.pagePath || '',
      title: body?.title || '',
      componentChain: collectComponentChain(body),
      route: {
        matched: !!routeTrace?.matched,
        bestPageFile: routeTrace?.bestPageFile || '',
        hits: (routeTrace?.hits || []).slice(0, 4).map(hit => ({
          file: hit.file,
          routePath: hit.routePath,
          reasons: hit.reasons,
        })),
      },
    },
    domSelections,
    localState: {
      stage: 'planning',
      round: 1,
      maxRounds: 5,
      expansionRoundsUsed: Number(body?.agentState?.expansionRoundsUsed || 0),
      maxExpansionRounds: 2,
      expansionRetry: body?.agentState?.expansionRetry === true,
    },
    executionHistory,
    evidence: {
      ...evidence,
      previousPlan: body?.agentState?.previousPlan || null,
      previousCandidates: Array.isArray(body?.agentState?.previousCandidates)
        ? body.agentState.previousCandidates.slice(0, 8)
        : [],
      previousReason: body?.agentState?.previousReason || '',
    },
    expansionCandidates: [],
  };
}

function collectComponentChain(body) {
  const result = [];
  for (const selection of Array.isArray(body?.selections) ? body.selections : []) {
    const sourceLocate = selection?.sourceLocate
      || selection?.sourceEvidence
      || selection?.element?.sourceLocate
      || null;
    for (const component of sourceLocate?.componentChain || []) {
      result.push({
        name: component?.name || '',
        file: component?.file || '',
        depth: component?.depth,
        domDepth: component?.domDepth,
      });
    }
  }
  return result.slice(0, 12);
}

function normalizeLocatorDecision(parsed) {
  const status = VALID_STATUSES.has(parsed?.status) ? parsed.status : '';
  const nextPlan = (Array.isArray(parsed?.nextPlan) ? parsed.nextPlan : [])
    .slice(0, 2)
    .map((plan, index) => ({
      id: String(plan?.id || `p${index + 1}`),
      capability: VALID_CAPABILITIES.has(plan?.capability) ? plan.capability : '',
      searches: normalizeSearches(plan?.searches),
      relation: VALID_RELATIONS.has(plan?.relation) ? plan.relation : 'same-scope',
      scopeHint: VALID_SCOPE_HINTS.has(plan?.scopeHint) ? plan.scopeHint : 'current-selection',
      purpose: String(plan?.purpose || ''),
    }));
  return {
    status,
    understanding: {
      userTarget: String(parsed?.understanding?.userTarget || ''),
      selectedDomAnchors: toStringArray(parsed?.understanding?.selectedDomAnchors),
      ignoredDomAnchors: toStringArray(parsed?.understanding?.ignoredDomAnchors),
    },
    evidenceAssessment: {
      sufficient: parsed?.evidenceAssessment?.sufficient === true,
      missingEvidence: toStringArray(parsed?.evidenceAssessment?.missingEvidence),
    },
    hypotheses: (Array.isArray(parsed?.hypotheses) ? parsed.hypotheses : []).slice(0, 4),
    nextPlan,
    stopReason: String(parsed?.stopReason || ''),
  };
}

function normalizeSearches(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, 8)
    .map((search, index) => ({
      keywords: toStringArray(search?.keywords).slice(0, 8),
      mode: search?.mode === 'any' ? 'any' : 'all',
      range: search?.range === 'same-structure' ? 'same-structure' : 'same-file',
      priority: Math.max(1, Number(search?.priority || index + 1)),
      reason: String(search?.reason || '').trim(),
    }))
    .filter(search => search.keywords.length);
}

function toStringArray(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

function validateLocatorDecision(decision) {
  const errors = [];
  if (!VALID_STATUSES.has(decision.status)) errors.push('status 非法或缺失');
  if (decision.status === 'resolved' && decision.nextPlan.length) errors.push('resolved 不能继续输出 nextPlan');
  if (decision.status === 'need-more-context' && decision.nextPlan.some(plan => plan.capability !== 'expand-dom')) {
    errors.push('need-more-context 只能请求 expand-dom');
  }
  if (decision.status === 'ready') {
    const hasSearch = decision.nextPlan.some(plan => (plan.searches || []).some(search => (search.keywords || []).length));
    if (!hasSearch) errors.push('ready 必须包含至少一个 searches.keywords');
  }
  for (const plan of decision.nextPlan) {
    if (!VALID_CAPABILITIES.has(plan.capability)) errors.push(`capability 非法：${plan.capability || '-'}`);
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function locatorDecisionToSearchPlan(decision) {
  const searches = [];
  let needMoreDom = decision.status === 'need-more-context';
  let routeOnlyPlan = false;
  for (const plan of decision.nextPlan || []) {
    if (plan.capability === 'expand-dom') {
      needMoreDom = true;
      continue;
    }
    if (plan.capability === 'resolve-route') {
      routeOnlyPlan = true;
      continue;
    }
    if (![
      'locate-structure',
      'trace-rendering',
      'trace-style',
      'trace-event',
      'trace-data',
      'inspect-candidates',
      'trace-imports',
      'validate-relation',
    ].includes(plan.capability)) continue;
    for (const search of plan.searches || []) {
      searches.push({
        keywords: search.keywords,
        mode: search.mode,
        range: search.range || relationToRange(plan.relation),
        priority: searches.length + 1,
        reason: search.reason || `${plan.capability}：${plan.purpose || plan.relation}`,
      });
    }
  }
  if (!searches.length && routeOnlyPlan) {
    needMoreDom = true;
  }
  return {
    searches,
    needMoreDom,
  };
}

function relationToRange(relation) {
  return ['same-rendering-context', 'same-template-block', 'same-scope'].includes(relation)
    ? 'same-structure'
    : 'same-file';
}

module.exports = {
  buildLocatorSystemPrompt,
  buildLocatorUserInput,
  normalizeLocatorDecision,
  validateLocatorDecision,
  locatorDecisionToSearchPlan,
};
