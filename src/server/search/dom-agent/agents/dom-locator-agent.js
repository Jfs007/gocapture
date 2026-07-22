'use strict';

const fs = require('fs');
const path = require('path');
const { runAgentTask } = require('../../../agent-host/llm-adapter');
const { filterToolsByConfigAction } = require('../../../agent-host/capabilities');
const { loadLangChainRuntime } = require('../../../agent-host/langchain/runtime');
const {
  executeAgentTool,
  listAgentTools,
} = require('../../../agent-host/tools/registry');
const { parseJsonResult } = require('../anchor/dom-utils');

const DOM_LOCATOR_TOOLS = [
  // 定向工具：返回框架/anchor/搜索范围/Experience 线索。未实现前不在 registry 中，
  // 白名单会自动忽略，属于惰性注册。
  'consult_project_knowledge',
  'search_source_evidence',
  'search_text',
  'find_files',
  'find_symbol',
  'inspect_symbol_occurrences',
  'read_file',
  'read_closed_blocks',
  'find_imports',
  'find_importers',
  'trace_file_evidence_flow',
];

const MAX_STRUCTURE_CHARS = 24000;
const MAX_FALLBACK_PATHS = 500;

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
}

function readProjectStructure(project) {
  const structurePath = path.join(project.path, '.magnus', 'Structure.md');
  try {
    const text = fs.readFileSync(structurePath, 'utf8').trim();
    if (text) return text.slice(0, MAX_STRUCTURE_CHARS);
  } catch (error) {
  }
  return (project.files || [])
    .slice(0, MAX_FALLBACK_PATHS)
    .map(file => file.path)
    .join('\n');
}

function buildDomLocatorObjective(input = {}) {
  const hasKnowledgeTool = Boolean(input.hasKnowledgeTool);
  const hasSeed = Boolean(input.anchorSeed && input.anchorSeed.candidates.length);
  const rule1 = hasKnowledgeTool && !hasSeed
    ? '1. 当前没有可用锚点候选，先调用 consult_project_knowledge 获取定向线索，再结合用户需求、DOM 结构、页面事实与项目结构选择后续工具调用。'
    : hasKnowledgeTool
      ? '1. 当前已有带真实命中片段的锚点候选，直接从候选验证开始。consult_project_knowledge 是可选工具，只有现有证据无法提出有效验证方向且确实缺少项目知识时才调用，不得把它当固定第一步。'
    : '1. 先理解用户需求、DOM 结构、页面事实和项目结构，再选择当前最可能有效的工具调用。';
  const rule2 = hasKnowledgeTool
    ? '2. 工具结果只是事实，不是结论。命中次数、路径邻近、文件后缀或单个文案都不能直接证明渲染归属；consult_project_knowledge 返回的框架/anchor/Experience 线索同样只是先验，必须用检索或读取工具实测确认后方可写入结论。'
    : '2. 工具结果只是事实，不是结论。命中次数、路径邻近、文件后缀或单个文案都不能直接证明渲染归属。';
  const existingCandidateRule = hasSeed
    ? '9. 选择下一步工具前，先检查锚点交集候选中是否已有文件命中 missingFacts。若存在，必须优先读取这些已有候选；不得跳过它们重新发起全局搜索。只有已有候选和其局部关系都不能验证缺失事实时，才扩大搜索范围。'
    : '9. 选择下一步工具前，先检查当前工具观察中是否已有文件命中 missingFacts。若存在，必须优先读取这些已有候选；不得跳过它们重新发起全局搜索。只有已有候选和其局部关系都不能验证缺失事实时，才扩大搜索范围。';
  return [
    '根据用户需求定位当前 DOM 选区对应的真实源码。调查范围和结束位置必须由用户需求决定。',
    '',
    '调查方式：',
    rule1,
    rule2,
    '3. 调用调查工具前，先把用户需求转化为明确、可验证的完成判据；完成判据只能来自用户需求，不得擅自扩大任务范围。',
    '4. 每轮根据新证据修正假设，并重新判断：当前证据是否已满足完成判据；尚未确认的信息是否会影响当前任务结论；继续调查是否可能改变目标文件、目标代码范围或最终判断。',
    '5. 如果完成判据已经满足，且剩余未知信息不会影响当前任务，必须立即提交 resolved。',
    '6. 只调查满足完成判据所必需的事实。不得默认追求完整的 DOM 来源、文件关系、内部实现、数据流或调用链；只有当前完成判据依赖这些信息时才继续调查。',
    '7. 每次读取候选后，必须先在推理中形成候选审查：coverage=complete|partial|mismatch|unknown；candidateRole=target|container|inner|peer|source|unknown；并列出 explainedFacts、missingFacts 和 nextDirection。角色与覆盖关系只能由你根据真实证据判断，本地分数不负责该判断。',
    '8. partial 不等于候选错误。若候选只解释内部事实，下一步验证承载缺失外层事实的候选或关系；若只解释外层事实，下一步验证承载缺失内部事实的候选或关系；若只是相似结构但关键事实不一致，才按 peer 处理；若只提供内容或配置，验证其消费者。',
    existingCandidateRule,
    '10. 每次继续调用工具前，必须明确唯一的 missingFact，并判断预期结果是否可能改变目标文件、目标代码范围、关系结论或最终状态；如果不能改变，不得继续调查。',
    '11. 工具结果不能满足完成判据时，根据 missingFacts 选择范围最小的读取、检索或关系验证；不要为了增加结论细节而继续调用工具。',
    '12. 已从源码片段发现待验证标识符、且缺失的是标识符之间的关系时，必须调用 inspect_symbol_occurrences；输入携带 file、symbols、missingFact 和 decisionImpact。不得继续用 read_file 行区间翻页寻找定义。它会一次返回这些标识符的全部出现位置，关系含义仍由你判断。',
    '13. 如果遇到间接关系且完成判据依赖该关系，使用工具读取实际源码证据；不要凭框架惯例补全。',
    '14. 如果现有 DOM 无法提出有价值的下一步验证，提交 need-more-context 并申请扩区。',
    '15. 不编造文件、符号、代码、关系或行号。',
    '16. 不得重复完全相同的工具调用。同一文件最多进行一次 read_file 行区间补读；后续应围绕已发现标识符调用 inspect_symbol_occurrences，或使用明确 terms/read_closed_blocks 读取所需事实。',
    '17. 调查结束必须调用 finish_dom_location；不要用普通文本结束。',
    '',
    `用户需求:\n${input.userPrompt || ''}`,
    '',
    hasSeed
      ? [
        '锚点交集候选（确定性预计算：用选区静态文字锚点在源码里按稀有度加权求交集，排在越前越可能是该 DOM 的真实渲染源）：',
        '直接 read_file 从最前的候选开始核验。候选经真实源码证据验证并满足当前完成判据后，立即提交 resolved；只有完成判据尚未满足时才继续调查。候选仍是线索、非结论，需实测确认。',
        JSON.stringify(input.anchorSeed, null, 2),
        '',
      ].join('\n')
      : '',
    // DOM 选区通常不在路由文件内：有锚点候选时路由仅作一行背景，不作为调查对象；无候选时才作为起点。
    hasSeed
      ? `页面路由（仅背景）: ${input.routeFacts?.pagePath || input.routeFacts?.bestPageFile || '-'}`
      : `页面与路由事实（无锚点候选时的起点）:\n${JSON.stringify(input.routeFacts || {}, null, 2)}`,
    '',
    `当前 DOM 选区:\n${JSON.stringify(input.domSelections || [], null, 2)}`,
    '',
    hasSeed ? '' : `真实项目结构:\n${input.projectStructure || ''}`,
  ].join('\n');
}

function createFinishTool() {
  const runtime = loadLangChainRuntime();
  if (!runtime.available) throw new Error(`LangChain runtime missing: ${runtime.missing.join(', ')}`);
  const z = runtime.z;
  return runtime.tool(
    async input => JSON.stringify(input),
    {
      name: 'finish_dom_location',
      description: 'Finish DOM source investigation. Use resolved when verified source evidence satisfies the completion criteria derived from the user request; do not require unrelated provenance or cross-file details.',
      returnDirect: true,
      schema: z.object({
        status: z.enum(['resolved', 'need-more-context', 'unresolved']),
        files: z.array(z.object({
          file: z.string(),
          role: z.enum(['render', 'main-render', 'co-render', 'child', 'assembly', 'definition', 'data-source', 'related']),
          confidence: z.number().min(0).max(100),
          line: z.number().optional(),
          anchor: z.string().optional(),
          reason: z.string(),
          snippet: z.string().optional(),
        })).max(12),
        relations: z.array(z.object({
          from: z.string(),
          to: z.string(),
          type: z.string(),
          evidence: z.string(),
        })).max(16),
        coveredDom: z.array(z.string()).max(16),
        missingEvidence: z.array(z.string()).max(12),
        needMoreDom: z.boolean(),
        reason: z.string(),
      }),
    }
  );
}

// budget: { modelCalls, forceFinishAt, forceFinish } —— 与 toolGuard 共享，让"逼交卷"从广告层落到执行层。
function createFinalizationMiddleware(budget) {
  const runtime = loadLangChainRuntime();
  if (!runtime.available || typeof runtime.createMiddleware !== 'function') return null;
  return runtime.createMiddleware({
    name: 'DomLocatorFinalizationBudget',
    wrapModelCall: async (request, handler) => {
      budget.modelCalls += 1;
      if (budget.modelCalls < budget.forceFinishAt) return handler(request);
      budget.forceFinish = true; // toolGuard 据此硬拦非 finish 工具
      return handler({
        ...request,
        tools: (request.tools || []).filter(tool => tool?.name === 'finish_dom_location'),
        systemPrompt: [
          request.systemPrompt || '',
          '本轮已到调查预算上限。只能调用 finish_dom_location：证据充分则 resolved；DOM 证据不足则 need-more-context；仍缺源码关系则 unresolved。不要继续检索，不要用普通文本结束。',
        ].filter(Boolean).join('\n'),
      });
    },
  });
}

function createDomLocatorContextMiddleware() {
  const runtime = loadLangChainRuntime();
  if (typeof runtime.contextEditingMiddleware !== 'function' || typeof runtime.ClearToolUsesEdit !== 'function') {
    return null;
  }
  return runtime.contextEditingMiddleware({
    edits: [new runtime.ClearToolUsesEdit({
      trigger: { tokens: 28000 },
      keep: { messages: 6 },
      clearToolInputs: false,
      placeholder: '[较早工具正文已由 DOM Locator 上下文策略清理；初始候选事实和最近工具结果仍保留。如结论依赖被清理证据，请围绕已知文件与符号精确重读。]',
    })],
  });
}

function isExplicitLineRange(value) {
  return /^\d+\s*[-~:]\s*\d+$/.test(String(value || '').trim());
}

function createDomLocatorToolGuard(budget) {
  const rangedReads = new Map();
  return (toolName, input = {}) => {
    if (budget.forceFinish && toolName !== 'finish_dom_location') {
      return {
        operation: toolName,
        blocked: true,
        note: '调查预算已用尽：只能调用 finish_dom_location 交卷。请立刻基于已有证据与锚点交集候选提交结论，不要再检索或读取。',
      };
    }
    if (toolName !== 'read_file' || !isExplicitLineRange(input.around)) return null;
    const files = (Array.isArray(input.files) ? input.files : []).map(normalizePath).filter(Boolean);
    const repeatedFiles = files.filter(file => rangedReads.has(file));
    if (repeatedFiles.length) {
      return {
        operation: toolName,
        blocked: true,
        files: repeatedFiles,
        requestedRange: String(input.around),
        previousRanges: repeatedFiles.map(file => ({ file, range: rangedReads.get(file) })),
        note: '同一文件已进行过行区间补读，继续翻页会重复扩大上下文。请从已有源码中选择待验证标识符，调用 inspect_symbol_occurrences 一次收集全部出现位置；若缺失事实不是标识符关系，请改用明确 terms 或 read_closed_blocks。',
      };
    }
    for (const file of files) rangedReads.set(file, String(input.around));
    return null;
  };
}

function normalizeLocatorDecision(rawText, project) {
  const parsed = parseJsonResult(rawText) || {};
  const knownFiles = new Set((project.files || []).map(file => file.path));
  const files = (Array.isArray(parsed.files) ? parsed.files : [])
    .map(item => ({
      file: normalizePath(item?.file || item?.path),
      role: String(item?.role || 'related'),
      confidence: Number(item?.confidence || 0),
      line: Number(item?.line || 0),
      anchor: String(item?.anchor || ''),
      reason: String(item?.reason || ''),
      snippet: String(item?.snippet || ''),
    }))
    .filter(item => item.file && knownFiles.has(item.file));
  const relations = (Array.isArray(parsed.relations) ? parsed.relations : [])
    .map(item => ({
      from: normalizePath(item?.from),
      to: normalizePath(item?.to),
      type: String(item?.type || 'related'),
      evidence: String(item?.evidence || ''),
    }))
    .filter(item => item.from && item.to && knownFiles.has(item.from) && knownFiles.has(item.to));
  let status = String(parsed.status || 'unresolved');
  const hasRender = files.some(item => /render/.test(item.role));
  if (status === 'resolved' && (!files.length || !hasRender)) status = 'unresolved';
  const needMoreDom = Boolean(parsed.needMoreDom || status === 'need-more-context');
  return {
    status,
    files,
    relations,
    coveredDom: Array.isArray(parsed.coveredDom) ? parsed.coveredDom.map(String) : [],
    missingEvidence: Array.isArray(parsed.missingEvidence) ? parsed.missingEvidence.map(String) : [],
    needMoreDom,
    reason: String(parsed.reason || ''),
  };
}

function compactEventValue(value, maxChars = 12000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...（已裁剪 ${text.length - maxChars} 字符）`;
}

function modelInputMessageSummary(messages, previewChars = 320) {
  return (Array.isArray(messages) ? messages : []).map((message, index) => {
    const content = String(message?.content || '');
    const toolCalls = (Array.isArray(message?.tool_calls) ? message.tool_calls : []).map(call => ({
      id: String(call?.id || ''),
      tool: String(call?.function?.name || ''),
      input: String(call?.function?.arguments || ''),
    }));
    return {
      index,
      role: String(message?.role || 'unknown'),
      chars: content.length,
      content: content.length <= previewChars ? content : `${content.slice(0, previewChars)}\n...（本条省略 ${content.length - previewChars} 字符；完整事实见此前对应的输入或工具结果节点）`,
      ...(message?.tool_call_id ? { toolCallId: String(message.tool_call_id) } : {}),
      ...(toolCalls.length ? { toolCalls } : {}),
    };
  });
}

const SEED_MAX_ANCHORS = 8;
const SEED_MAX_CANDIDATES = 6;
const SEED_MAX_MATCHES_PER_CANDIDATE = 4;
const SEED_MATCH_SNIPPET_CHARS = 320;

// 静态文字锚点判定：短、含 CJK/字母、非数据绑定 —— 框架无关，任意 UI 库都适用。
function looksDataBoundText(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  if (/[xX]{2}/.test(s)) return true;
  if (/[，。、；：（）()/…]/.test(s)) return true;
  if (/\d[、.．]/.test(s)) return true;
  if (s.length >= 10) return true;
  return false;
}

function isStaticLabel(text) {
  const s = String(text || '').trim();
  if (s.length < 2 || s.length > 8) return false;
  return /[一-龥A-Za-z]/.test(s) && !looksDataBoundText(s);
}

function extractSeedAnchors(domSelections) {
  const seen = new Set();
  const anchors = [];
  for (const selection of Array.isArray(domSelections) ? domSelections : []) {
    const text = String(selection?.directText || selection?.text || '');
    for (const token of text.split(/\s+/)) {
      const value = token.trim();
      if (!value || seen.has(value) || !isStaticLabel(value)) continue;
      seen.add(value);
      anchors.push(value);
      if (anchors.length >= SEED_MAX_ANCHORS) return anchors;
    }
  }
  return anchors;
}

function compactSeedMatch(match = {}) {
  const snippet = String(match.snippet || '').trim();
  return {
    text: String(match.text || ''),
    kind: String(match.kind || 'literal'),
    line: Number(match.line || 0),
    occurrenceCount: Number(match.occurrenceCount || 0),
    snippet: snippet.length > SEED_MATCH_SNIPPET_CHARS
      ? `${snippet.slice(0, SEED_MATCH_SNIPPET_CHARS)}\n...（片段已裁剪）`
      : snippet,
  };
}

// 确定性预计算：用选区静态文字锚点求交集，得到按共现数排序的候选文件（0 轮 LLM）。
// 框架无关、不依赖经验/context7 —— 这是“少轮数”的主杠杆。
async function computeAnchorSeed(project, domSelections, textCache, onLog) {
  const anchors = extractSeedAnchors(domSelections);
  if (!anchors.length) return null;
  try {
    const output = await executeAgentTool(project, {
      tool: 'search_source_evidence',
      input: { anchors: anchors.map(text => ({ text })), mode: 'any', maxResults: SEED_MAX_CANDIDATES },
    }, { textCache });
    const candidates = (output?.result?.candidates || [])
      .map(candidate => ({
        file: candidate.file,
        matchedAnchorCount: candidate.matchedAnchorCount,
        informationScore: Number(candidate.informationScore) || 0,
        matchedAnchors: (candidate.matches || [])
          .slice(0, SEED_MAX_MATCHES_PER_CANDIDATE)
          .map(compactSeedMatch),
      }))
      .filter(candidate => candidate.file)
      // 按稀有度加权（informationScore）重排，再按命中数：让命中"稀有/DOM 独有 label"的真答案冒到最前，
      // 而不是让命中"通用 label"的同族变体因命中数平票而占先（工具返回的 candidates 是逐锚点插入序，非稀有度序）。
      .sort((a, b) => b.informationScore - a.informationScore || b.matchedAnchorCount - a.matchedAnchorCount);
    return { anchors, candidates };
  } catch (error) {
    onLog?.(`DOM Locator Agent 锚点种子失败：${error.message}`);
    return null;
  }
}

// 撞递归上限或 agent 未收敛时，用已收集的交集证据 + 锚点种子合成 best-effort 结论（不再空手/崩溃）。
function buildFallbackDecision({ anchorSeed, evidenceCandidates, project, recursionLimitHit }) {
  const knownFiles = new Set((project.files || []).map(file => file.path));
  const scored = new Map();
  const add = (file, count) => {
    const normalized = normalizePath(file);
    if (!normalized || !knownFiles.has(normalized)) return;
    scored.set(normalized, Math.max(scored.get(normalized) || 0, Number(count) || 0));
  };
  for (const [file, count] of evidenceCandidates || []) add(file, count);
  for (const candidate of anchorSeed?.candidates || []) add(candidate.file, candidate.matchedAnchorCount);
  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!ranked.length) return null;
  return {
    status: 'need-more-context',
    files: ranked.map(([file, count], index) => ({
      file,
      role: index === 0 ? 'render' : 'related',
      confidence: Math.min(80, count * 25),
      line: 0,
      anchor: '',
      reason: `${recursionLimitHit ? '递归上限触发' : 'agent 未显式收敛'}；锚点交集/检索证据共现候选（matchedAnchorCount=${count}），best-effort、未经 agent 确认，需人工核验。`,
      snippet: '',
    })),
    relations: [],
    coveredDom: [],
    missingEvidence: ['agent 未显式提交结论（预算/递归上限）'],
    needMoreDom: false,
    reason: recursionLimitHit
      ? '调查触发递归上限，返回锚点交集/检索证据中共现最高的候选作为 best-effort 结果。'
      : 'agent 未产出有效结论，回退到锚点交集候选。',
  };
}

async function runDomLocatorAgent(project, input = {}, options = {}) {
  const tools = filterToolsByConfigAction(listAgentTools(), {
    configAction: ['builtin'],
    allowedTools: DOM_LOCATOR_TOOLS,
    readOnlyOnly: true,
  });
  const hasKnowledgeTool = tools.some(tool => tool?.name === 'consult_project_knowledge');
  const textCache = options.textCache || new Map();
  const anchorSeed = await computeAnchorSeed(project, input.domSelections, textCache, options.onLog);
  if (anchorSeed) {
    options.onLog?.(`DOM Locator Agent 锚点种子：anchors=${anchorSeed.anchors.join('、')}；候选(命中数/稀有度)=${anchorSeed.candidates.map(c => `${c.file}(${c.matchedAnchorCount}/${c.informationScore})`).join(', ') || '无'}`);
  }
  const objective = buildDomLocatorObjective({
    ...input,
    hasKnowledgeTool,
    anchorSeed,
    projectStructure: anchorSeed ? '' : readProjectStructure(project),
  });
  options.onLog?.(`DOM Locator Agent 输入（${objective.length} 字符）:\n${objective}`);
  let modelRound = 0;
  const maxTurns = options.maxTurns || 12;
  // 逼交卷提前 3 轮开始，给硬拦留 runway；forceFinish 由中间件置位、toolGuard 读取。
  const budget = { modelCalls: 0, forceFinishAt: Math.max(2, maxTurns - 3), forceFinish: false };
  const finalizationMiddleware = createFinalizationMiddleware(budget);
  const contextMiddleware = createDomLocatorContextMiddleware();
  if (contextMiddleware) options.onLog?.('DOM Locator Agent 上下文策略：约 28000 tokens 后清理较早工具正文，保留最近 6 条工具结果。');
  const toolGuard = createDomLocatorToolGuard(budget);
  const evidenceCandidates = new Map(); // file -> max matchedAnchorCount，跨轮累计，用于兜底
  const result = await runAgentTask(project, {
    adapter: options.adapter,
    langchainModel: options.langchainModel,
    objective,
    stage: 'dom-locator',
    systemPrompt: [
      '你是 Magnus DOM Source Locator。',
      '你负责理解和推理；本地工具只负责返回真实项目事实。',
      '根据每轮工具观察决定下一步，不使用固定流水线，不按本地分数直接选文件。',
      '必须通过 finish_dom_location 结束调查。',
    ].join('\n'),
    middleware: [contextMiddleware, finalizationMiddleware].filter(Boolean),
    configAction: ['builtin'],
    readOnlyOnly: true,
    maxTurns,
    signal: options.signal,
    onEvent: event => {
      if (event.type === 'llm.log') options.onLog?.(event.log);
      if (event.type === 'llm.input') {
        modelRound += 1;
        const toolNames = (event.toolNames || []).join('、') || '-';
        options.onLog?.(`DOM Locator Agent 第 ${modelRound} 轮模型输入：messages=${(event.messages || []).length}；tools=${event.toolCount || 0}；toolNames=${toolNames}`);
        options.onLog?.(`DOM Locator Agent 第 ${modelRound} 轮模型输入上下文：\n${compactEventValue(modelInputMessageSummary(event.messages), 16000)}`);
      }
      if (event.type === 'llm.output') {
        const rawText = String(event.rawText || '').trim();
        options.onLog?.(`DOM Locator Agent 第 ${modelRound} 轮模型输出：tool_calls=${(event.toolCalls || []).length}；text=${rawText.length} 字符`);
        if (rawText) {
          options.onLog?.(`DOM Locator Agent 第 ${modelRound} 轮模型输出正文：\n${compactEventValue(rawText, 3000)}`);
        }
      }
      if (event.type === 'tool.start') {
        options.onLog?.(`DOM Locator Agent 工具调用：${event.toolCall?.tool} ${compactEventValue(event.toolCall?.input || {})}`);
      }
      if (event.type === 'tool.result') {
        // 累计交集证据（跨轮），撞限/未收敛时用于兜底裁决。
        if (event.observation?.tool === 'search_source_evidence') {
          for (const candidate of event.observation?.result?.candidates || []) {
            if (!candidate?.file) continue;
            evidenceCandidates.set(candidate.file, Math.max(evidenceCandidates.get(candidate.file) || 0, Number(candidate.matchedAnchorCount) || 0));
          }
        }
        options.onLog?.(`DOM Locator Agent 工具结果：${event.observation?.tool}\n${compactEventValue(event.observation?.result)}`);
      }
      if (event.type === 'tool.error') {
        options.onLog?.(`DOM Locator Agent 工具失败：${event.observation?.tool}；${event.observation?.error || '-'}`);
      }
    },
  }, {
    tools,
    executeTool: (targetProject, toolCall, context = {}) => executeAgentTool(targetProject, toolCall, {
      ...context,
      searchResultPolicy: 'summary-on-truncation',
    }),
    textCache,
    langchainTools: [createFinishTool()],
    toolGuard,
  });
  let decision = normalizeLocatorDecision(result.rawText, project);
  // 撞递归上限、或 agent 没给出有效文件时，回退到锚点交集/检索证据的 best-effort 结论。
  if (result.recursionLimitHit || !decision.files.length) {
    const fallback = buildFallbackDecision({ anchorSeed, evidenceCandidates, project, recursionLimitHit: result.recursionLimitHit });
    if (fallback) {
      options.onLog?.(`DOM Locator Agent 兜底裁决（${result.recursionLimitHit ? '递归上限' : '空结论'}）：${JSON.stringify(fallback, null, 2)}`);
      decision = fallback;
    }
  }
  options.onLog?.(`DOM Locator Agent 最终裁决：${JSON.stringify(decision, null, 2)}`);
  return {
    ...decision,
    rawText: result.rawText || '',
    recursionLimitHit: Boolean(result.recursionLimitHit),
    modelRounds: modelRound,
  };
}

module.exports = {
  DOM_LOCATOR_TOOLS,
  buildDomLocatorObjective,
  extractSeedAnchors,
  computeAnchorSeed,
  buildFallbackDecision,
  createFinalizationMiddleware,
  createDomLocatorContextMiddleware,
  createDomLocatorToolGuard,
  createFinishTool,
  normalizeLocatorDecision,
  readProjectStructure,
  runDomLocatorAgent,
};
