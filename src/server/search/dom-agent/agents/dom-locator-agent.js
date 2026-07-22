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
  const rule1 = hasKnowledgeTool
    ? '1. 第一步必须先调用 consult_project_knowledge 获取定向线索（UI 框架、class 跳过策略、DOM 签名→源码写法、anchor 规划、搜索范围、Experience 线索）；随后再结合用户需求、DOM 结构、页面事实与项目结构选择后续工具调用。'
    : '1. 先理解用户需求、DOM 结构、页面事实和项目结构，再选择当前最可能有效的工具调用。';
  const rule2 = hasKnowledgeTool
    ? '2. 工具结果只是事实，不是结论。命中次数、路径邻近、文件后缀或单个文案都不能直接证明渲染归属；consult_project_knowledge 返回的框架/anchor/Experience 线索同样只是先验，必须用检索或读取工具实测确认后方可写入结论。'
    : '2. 工具结果只是事实，不是结论。命中次数、路径邻近、文件后缀或单个文案都不能直接证明渲染归属。';
  return [
    '定位当前 DOM 选区对应的真实源码，并解释多个文件如何共同生成该 DOM。',
    '',
    '调查方式：',
    rule1,
    rule2,
    '3. 每轮根据新证据修正假设。可以更换检索词、读取候选局部、追踪符号或文件引用。',
    '4. 一个 DOM 区域可能由外框、动态子组件、公共组件、配置或数据源共同生成。保留能够解释不同 DOM 子区域的互补文件。',
    '5. 如果候选只解释部分 DOM，继续寻找剩余部分及文件之间的真实关系，不要强行挑一个最高分文件。',
    '6. 如果遇到动态组件、配置映射、状态中转或其他间接关系，使用工具读取实际源码证据；不要凭框架惯例补全。',
    '7. 只有重要 DOM 区域均被解释、必要文件关系已由源码证据闭合时，才提交 resolved。',
    '8. 如果现有 DOM 无法提出有价值的下一步验证，提交 need-more-context 并申请扩区。只要仍有可验证假设，就继续调用工具。',
    '9. 不编造文件、符号、代码、关系或行号。',
    '10. 不得重复完全相同的工具调用。读取截断文件时，使用 read_file.around 指定符号、文案或行区间继续下钻。',
    '11. 已解释用户关注的 DOM 区域和必要文件关系后立即结束；不要追查与定位目标无关的数据或业务逻辑。',
    '12. 调查结束必须调用 finish_dom_location；不要用普通文本结束。',
    '',
    `用户需求:\n${input.userPrompt || ''}`,
    '',
    hasSeed
      ? [
        '锚点交集候选（确定性预计算：用选区静态文字锚点在源码里按稀有度加权求交集，排在越前越可能是该 DOM 的真实渲染源）：',
        '直接 read_file 从最前的候选开始核验；一旦某候选被证实直接渲染该 DOM 区域（命中其关键 label/结构），即视为找到渲染源并尽快提交 resolved。上游挂载/装配链只在解释 DOM 归属确有必需时才追。仍是线索、非结论，需实测确认。',
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
    `真实项目结构:\n${input.projectStructure || ''}`,
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
      description: 'Finish DOM source investigation. Use resolved only after source evidence explains the DOM and required cross-file relations; otherwise request more DOM context.',
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

const SEED_MAX_ANCHORS = 8;
const SEED_MAX_CANDIDATES = 6;

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
    projectStructure: readProjectStructure(project),
  });
  options.onLog?.(`DOM Locator Agent 输入（${objective.length} 字符）:\n${objective}`);
  let modelRound = 0;
  const maxTurns = options.maxTurns || 12;
  // 逼交卷提前 3 轮开始，给硬拦留 runway；forceFinish 由中间件置位、toolGuard 读取。
  const budget = { modelCalls: 0, forceFinishAt: Math.max(2, maxTurns - 3), forceFinish: false };
  const finalizationMiddleware = createFinalizationMiddleware(budget);
  const toolGuard = toolName => {
    if (budget.forceFinish && toolName !== 'finish_dom_location') {
      return {
        operation: toolName,
        blocked: true,
        note: '调查预算已用尽：只能调用 finish_dom_location 交卷。请立刻基于已有证据与锚点交集候选提交结论，不要再检索或读取。',
      };
    }
    return null;
  };
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
    middleware: finalizationMiddleware ? [finalizationMiddleware] : [],
    configAction: ['builtin'],
    readOnlyOnly: true,
    maxTurns,
    signal: options.signal,
    onEvent: event => {
      if (event.type === 'llm.log') options.onLog?.(event.log);
      if (event.type === 'llm.input') {
        modelRound += 1;
        options.onLog?.(`DOM Locator Agent 第 ${modelRound} 轮模型输入：messages=${(event.messages || []).length}；tools=${event.toolCount || 0}`);
      }
      if (event.type === 'llm.output') {
        options.onLog?.(`DOM Locator Agent 第 ${modelRound} 轮模型输出：tool_calls=${(event.toolCalls || []).length}；text=${String(event.rawText || '').length} 字符`);
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
    executeTool: executeAgentTool,
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
  createFinishTool,
  normalizeLocatorDecision,
  readProjectStructure,
  runDomLocatorAgent,
};
