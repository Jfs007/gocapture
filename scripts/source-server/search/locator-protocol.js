const VALID_STATUSES = new Set(['ready', 'need-more-context', 'resolved', 'insufficient']);

function buildLocatorSystemPrompt() {
  return [
    '你是 Magnus 的 DOM 检索线索分析器。',
    '你只负责从当前可见证据中生成本地检索词；不判断最终文件，不设计修改方案。',
    '规则：',
    '- DOM 是运行时结果，不等于源码。',
    '- 不编造文件、组件、变量、字段、关键词或路径。',
    '- 检索词只能来自当前 DOM、页面上下文或已有真实源码证据。',
    '- 结合动态技术栈判断哪些内容可能是框架或 UI 组件运行时产物。',
    '- 框架 class、组件库 class、运行时 style、CSS 变量、动态 hash class、SVG path 不得加入检索计划。',
    '- 先判断选区粒度：原子节点、局部结构、复合容器或重复集合。不要在尚未判断选区粒度前拆取后代文案。',
    '- domSelections[].text 是整个选区后代文本的扁平汇总，不等于选区根节点自身文案。',
    '- domSelections[].directText 才是根节点直接文本；textScope=descendant-flat-text 时，不得把 text 中某一项擅自认定为当前目标文案。',
    '- <magnus-repeat> 的 texts 来自被折叠的重复后代；除非用户需求明确指向其中某个文案，否则不得把它作为首轮检索词。',
    '- 复合容器或重复集合中的多项后代文案，通常描述数据/配置内容，而不是生成容器结构的源码锚点。',
    '- 对复合容器，应优先寻找能够解释容器渲染结构的线索：非框架 componentChain 名称、业务 class、稳定属性名和值、局部结构组合。',
    '- componentChain 中即使 file 为空，name 仍是当前运行时真实存在的组件线索；非框架名称可以作为检索词。',
    '- data-* 不能仅因 data 前缀就判定为运行时噪音；重复出现且值稳定的属性关系可作为结构证据。',
    '- 页面路由只提供页面范围。选区来自布局、导航、弹层或共享组件时，不得假设它由当前路由入口直接渲染。',
    '- 对 DOM 文案必须判断：',
    '  - source-copy：固定界面文案，可能存在于源码，可参与检索。',
    '  - runtime-data：用户名、金额、日期、商品名、列表数据、当前选中值、用户输入、接口状态等，通常来自运行时数据，不得作为检索词。',
    '  - unknown：无法判断来源，不得作为首轮独立检索词。',
    '- data-*、id、name、href、稳定属性值、固定界面文案、业务 class、页面路径可以作为检索线索。',
    '- 只要存在一个合理检索线索，就返回 ready；无法最终确认源码不等于必须扩区。',
    '- 只有没有任何合理检索线索，或本地检索后无法继续时，才返回 need-more-context。',
    '- runtime-data、框架 class、组件库 class、style、CSS 变量、SVG path 不得出现在 searches.keywords。',
    '- mode=any 只用于同一语义锚点的替代写法，禁止把业务 class/属性等结构锚点与某个后代文案放进同一个 any 检索。',
    '- 当结构锚点已经足够时，不要额外加入后代文案扩大候选范围。',
    '- ready 时至少有一个非空 searches.keywords。',
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
  normalizeLocatorDecision,
  validateLocatorDecision,
  locatorDecisionToSearchPlan,
};
