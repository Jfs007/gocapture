const VALID_STATUSES = new Set(['ready', 'need-more-context', 'resolved', 'insufficient']);

function buildLocatorSystemPrompt(technicalStackMarkdown = '') {
  return [
    '你是 Magnus 的 DOM 检索规划 Agent。',
    '你的任务不是直接猜测源码文件，而是从页面 DOM 和上下文中提取适合本地源码检索的证据，并生成简洁的检索计划。',
    String(technicalStackMarkdown || '').trim(),
    '你只能参考：',
    '- 用户需求',
    '- 当前页面路径或 URL',
    '- 当前选区 DOM',
    '- 选区附近少量 DOM 上下文',
    '- 已捕获的接口、路由、组件链等线索',
    '- 当前技术栈信息',
    '目标：',
    '- 理解用户想修改或查看的页面区域。',
    '- 从 DOM 中识别真正可能存在于源码里的业务证据。',
    '- 排除 UI 框架 class、运行时 class、样式 class、哈希 class、scoped 属性、纯布局 class、动态业务数据等低价值信息。',
    '- 将有效证据拆成可执行的本地检索词。',
    '- 给检索词排序，并说明它可能出现在哪类源码中。',
    '优先保留的证据：',
    '- 业务文案',
    '- i18n key 或可能的国际化文案',
    '- 业务 class、id',
    '- data-testid、data-track、data-cy 等稳定属性',
    '- 组件名',
    '- 路由片段',
    '- 接口路径、接口名',
    '- runtime componentChain 中的文件名或组件名',
    '- 明显的事件、状态、表单字段、业务枚举',
    '通常排除：',
    '- UI 框架 class，例如 el-button、n-button、ant-btn',
    '- CSS Modules、CSS-in-JS、构建哈希 class',
    '- data-v-*、React 内部属性',
    '- flex、mt-4、w-full、grid 等纯布局 class',
    '- style 中的运行时变量',
    '- 订单号、用户名、商品名等明显来自接口或数据库的动态数据',
    '- svg path、图标节点、重复表格行',
    '输出要求：',
    '- 不要输出完整 DOM。',
    '- 不要输出无意义的泛词，例如 button、table、form、save。',
    '- 检索词数量控制在 3 到 8 个。',
    '- 优先输出可以精确命中的词。',
    '- 用户需求、URL、接口、组件链优先级高于普通 DOM 文案。',
    '- 业务文案只有在可能存在于源码、i18n、枚举、配置中时才保留。',
    '- 路由文件和 componentChain 只用于限定检索范围或辅助理解，不得因为它们存在就自动把路由名、组件名加入检索词。',
    '- <magnus-repeat> 是本地压缩重复兄弟节点后的摘要；其中 texts 和 attrs 都来自真实 DOM。若这些稳定证据属于同一重复结构，应优先保留其完整组合关系，不要任意抽取少数几个词。',
    '- 如果线索不足，明确说明“当前证据不足”，不要编造文件名或函数名。',
    '严格输出 JSON，不输出 Markdown，不输出解释文字。',
    JSON.stringify({
      status: 'ready | need-more-context',
      searches: [{
        keywords: [],
        mode: 'all | any',
        range: 'same-file | same-structure',
        reason: '',
      }],
      reason: '',
    }),
  ].join('\n');
}

function buildLocatorUserInput({ project, body, routeTrace, domSelections = [] }) {
  return {
    roundType: 'initial-dom-planning',
    requirement: body?.userPrompt || '',
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
    previousRound: body?.agentState?.expansionRetry === true
      ? {
          plan: body?.agentState?.previousPlan || null,
          candidates: Array.isArray(body?.agentState?.previousCandidates)
            ? body.agentState.previousCandidates.slice(0, 8)
            : [],
          reason: body?.agentState?.previousReason || '',
        }
      : null,
  };
}

function locatorTechnicalStackMarkdown(project) {
  return project?.context?.technicalStackMarkdown || [
    '## 技术栈',
    ...((project?.stack || []).map(item => `- ${item}`)),
  ].filter(Boolean).join('\n');
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
  return {
    status,
    searches: normalizeSearches(parsed?.searches),
    reason: String(parsed?.reason || ''),
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
  if (decision.status === 'ready' && !decision.searches.length) errors.push('ready 必须包含至少一个 searches.keywords');
  if (decision.status === 'need-more-context' && decision.searches.length) errors.push('need-more-context 不能包含 searches');
  return {
    valid: errors.length === 0,
    errors,
  };
}

function locatorDecisionToSearchPlan(decision) {
  return {
    searches: decision.searches || [],
    needMoreDom: decision.status === 'need-more-context',
  };
}

module.exports = {
  buildLocatorSystemPrompt,
  buildLocatorUserInput,
  locatorTechnicalStackMarkdown,
  normalizeLocatorDecision,
  validateLocatorDecision,
  locatorDecisionToSearchPlan,
};
