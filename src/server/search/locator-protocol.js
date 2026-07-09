const VALID_STATUSES = new Set(['ready', 'need-more-context', 'resolved', 'insufficient']);
const VALID_ANCHOR_KINDS = new Set(['text', 'class', 'attr', 'route', 'api']);
const MAX_RENDER_ANCHORS = 8;
const MAX_SCOPE_ANCHORS = 6;
const MAX_CHILD_ANCHORS = 6;

function buildLocatorSystemPrompt(technicalStackMarkdown = '') {
  return [
    '你是 Magnus 的 DOM 锚点抽取 Agent。',
    '你的唯一任务是：从选区 DOM 中抽取「可用于本地源码检索的稳定锚点」，并按渲染层级分类。',
    '你不负责猜文件名、不负责排序打分、不负责裁决——收敛由本地程序完成。你只需把锚点分对层。',
    String(technicalStackMarkdown || '').trim(),
    '你只能参考：用户需求 / 页面路径或 URL / 选区 DOM / 选区附近少量 DOM 上下文 / 已捕获的接口、路由、组件链 / 技术栈。',
    '',
    '# 锚点必须分成三层（这是最重要的规则）',
    '一段选区 DOM 往往由多个源文件协作渲染：外层容器/标题来自父装配组件，表单字段来自主渲染组件，可复用控件来自子组件。',
    '因此绝不能把不同层级的锚点混在一起要求它们出现在同一个文件里。请分别归类：',
    '',
    '1. renderAnchors（主渲染锚点，最关键）：',
    '   - 直接描述“用户所指区域主体内容”的、彼此相邻/同层的判别性锚点。',
    '   - 例如同一个表单里紧挨着的字段标签文案（“执行人”“反馈附件”“完成时间”“备注”）、该区域独有的业务 class/id、data-testid。',
    '   - 这些锚点应当大概率共同出现在同一个源文件中。挑选 2~6 个共现性最强、最独特的。',
    '',
    '2. scopeAnchors（范围锚点）：',
    '   - 只用于缩小范围、不参与“必须共现”判断的锚点：外层 fieldset 标题、通用外壳/布局 class（如 dc-fieldset、card、panel）、区块大标题。',
    '   - 这些词往往出现在很多文件里，只作为辅助，绝不能当作主锚点。',
    '',
    '3. childComponentAnchors（子组件锚点）：',
    '   - 明显属于一个独立可复用子组件的锚点：子组件根 class（如 file-upload-component）、独立控件文案（“上传附件”“点击下载”）。',
    '   - 它们通常定义在另一个子组件文件里，不应和 renderAnchors 混为一谈。',
    '',
    '# 一律排除（不得作为任何锚点）',
    '- UI 框架 class：el-*、n-*、ivu-*、ant-*、van-* 等运行时产物。',
    '- 表格/列表框架运行时生成的属性名：data-col-key、data-row-key、data-index、data-v-*、aria-*、colspan、rowspan、tabindex 等。',
    '  这些属性名在源码里根本不存在。若其「值」是业务标识（如 data-col-key="cost" 的 cost 往往对应列配置的 key:\'cost\'），',
    '  可以把该「值」单独作为 text 锚点，但绝不要把属性名写进锚点。',
    '- data-v-*、scoped 哈希、CSS Modules/构建哈希 class、React 内部属性。',
    '- flex、mt-4、w-full、grid 等纯布局 class；style 内联样式与像素值。',
    '- 订单号、用户名、商品名、附件名等明显来自接口/数据库的动态数据。',
    '- svg path、图标节点、重复表格行的具体数据、无意义泛词（button、form、save、table）。',
    '',
    '# 其它规则',
    '- 每个锚点写成 {"value":"原文", "kind":"text|class|attr|route|api"}。kind 如实标注：class 类名标 class，可见文案标 text。',
    '- <magnus-repeat> 是本地压缩重复兄弟节点的摘要，其 texts/attrs 来自真实 DOM，可放心作为锚点。',
    '- 若选区证据实在不足以形成 renderAnchors，返回 status="need-more-context" 且三个数组都为空，不要编造。',
    '- 严格输出 JSON，不输出 Markdown，不输出解释文字。',
    JSON.stringify({
      status: 'ready | need-more-context',
      renderAnchors: [{ value: '', kind: 'text | class | attr' }],
      scopeAnchors: [{ value: '', kind: 'text | class' }],
      childComponentAnchors: [{ value: '', kind: 'class | text' }],
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
  let renderAnchors = normalizeAnchors(parsed?.renderAnchors, MAX_RENDER_ANCHORS);
  // 向后兼容：若模型仍返回旧的扁平 searches，则把其关键词并入 renderAnchors。
  if (!renderAnchors.length && Array.isArray(parsed?.searches)) {
    renderAnchors = normalizeAnchors(
      parsed.searches.flatMap(search => Array.isArray(search?.keywords) ? search.keywords : []),
      MAX_RENDER_ANCHORS
    );
  }
  return {
    status,
    renderAnchors,
    scopeAnchors: normalizeAnchors(parsed?.scopeAnchors, MAX_SCOPE_ANCHORS),
    childComponentAnchors: normalizeAnchors(parsed?.childComponentAnchors, MAX_CHILD_ANCHORS),
    reason: String(parsed?.reason || ''),
  };
}

function normalizeAnchors(value, limit) {
  const seen = new Set();
  const anchors = [];
  for (const item of Array.isArray(value) ? value : []) {
    const raw = typeof item === 'string' ? { value: item, kind: 'text' } : (item || {});
    const anchorValue = String(raw.value || '').trim();
    if (anchorValue.length < 2) continue;
    const key = anchorValue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    anchors.push({
      value: anchorValue,
      kind: VALID_ANCHOR_KINDS.has(raw.kind) ? raw.kind : 'text',
    });
    if (anchors.length >= limit) break;
  }
  return anchors;
}

function validateLocatorDecision(decision) {
  const errors = [];
  const anchorTotal = decision.renderAnchors.length
    + decision.scopeAnchors.length
    + decision.childComponentAnchors.length;
  if (!VALID_STATUSES.has(decision.status)) errors.push('status 非法或缺失');
  if (decision.status === 'ready' && !decision.renderAnchors.length && !decision.childComponentAnchors.length) {
    errors.push('ready 必须至少包含 renderAnchors 或 childComponentAnchors');
  }
  if (decision.status === 'need-more-context' && anchorTotal) {
    errors.push('need-more-context 不能包含任何锚点');
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

// 框架/运行时生成的属性名：这些属性不会出现在源码里（由表格/列表组件运行时生成），
// 因此只有它们的「值」可能是业务锚点（如 data-col-key="cost" → 源码里的 key: 'cost'）。
const RUNTIME_ATTR_NAME = /^(data-col-key|data-row-key|data-group-key|data-key|data-index|data-sort|data-level|data-n-[\w-]+|data-v-[\w-]+|aria-[\w-]+|role|tabindex|colspan|rowspan|class|style)$/i;

// 把一个锚点转换为可本地检索的关键词：
//  - attr 锚点若形如 name="value"：作者书写属性(data-testid 等)保留原样交给 annotate 拆成 name/value 对；
//    框架生成属性(data-col-key 等)只保留 value（其名字在源码里根本不存在，强行要求它会让 AND 永远落空）。
function anchorToKeywords(anchor) {
  const value = anchor.value;
  if (anchor.kind !== 'attr') return [value];
  const match = String(value).match(/^\s*([\w:-]+)\s*=\s*["']?([^"']+?)["']?\s*$/);
  if (!match) return [value];
  const [, name, attrValue] = match;
  if (RUNTIME_ATTR_NAME.test(name)) return [attrValue];
  return [value];
}

function anchorsToKeywords(anchors) {
  const seen = new Set();
  const result = [];
  for (const anchor of anchors) {
    for (const keyword of anchorToKeywords(anchor)) {
      const trimmed = String(keyword || '').trim();
      if (trimmed.length < 2 || seen.has(trimmed.toLowerCase())) continue;
      seen.add(trimmed.toLowerCase());
      result.push(trimmed);
    }
  }
  return result;
}

// 将分层锚点转换为下游 executeSearchPlan 消费的 searches[]，并打上 layer 标记：
//  - render：一个 same-structure AND 组（共现性最强），本地据此收敛。
//  - child ：每个子组件锚点各自成组，便于解析到不同子组件文件。
//  - scope ：仅缩范围、不单独造候选。
function locatorDecisionToSearchPlan(decision) {
  const searches = [];
  const renderKeywords = anchorsToKeywords(decision.renderAnchors);
  if (renderKeywords.length) {
    searches.push({
      keywords: renderKeywords,
      mode: 'all',
      range: 'same-structure',
      priority: 1,
      layer: 'render',
      reason: '同一渲染块内共现的判别性锚点',
    });
  }
  decision.childComponentAnchors.forEach((anchor, index) => {
    const keywords = anchorToKeywords(anchor);
    if (!keywords.length) return;
    searches.push({
      keywords,
      mode: 'any',
      range: 'same-file',
      priority: 4,
      layer: 'child',
      childAnchor: true,
      reason: `子组件锚点：${anchor.value}`,
      priorityHint: index,
    });
  });
  const scopeKeywords = anchorsToKeywords(decision.scopeAnchors);
  if (scopeKeywords.length) {
    searches.push({
      keywords: scopeKeywords,
      mode: 'any',
      range: 'same-file',
      priority: 5,
      layer: 'scope',
      scopeOnly: true,
      reason: '外壳/范围锚点',
    });
  }
  return {
    searches,
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
