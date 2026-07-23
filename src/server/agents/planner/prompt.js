'use strict';

// Planner 的系统提示词 + 目标构建 + 输入整备：把 DOM Locator 的定位结果整理成规划输入
// （需求、页面、选区、已定位源码及其预读正文）。
const { readProjectText } = require('../../core/fs-utils');

const MAX_SOURCE_CHARS_PER_FILE = 30000;
const MAX_SOURCE_CHARS_TOTAL = 60000;

function numberedSource(text) {
  return String(text || '').split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n');
}

// 可编辑度：definition/data-source（"增/改一项"落点）> render（渲染器，偶尔改）> 其它基建（co-render/assembly…）。
// 预读预算优先给可能改动/参考的文件，别被通用基建占满。
function editableRank(role) {
  const r = String(role || '');
  if (/data-source|definition/.test(r)) return 0;
  if (r === 'render' || r === 'main-render') return 1;
  return 2;
}

// 从定义/数据源文件正文里抽取它引用到的项目文件（兄弟实现/模板）：匹配带斜杠的字符串字面量，
// 剥掉 @ ~ ./ ../ 等别名前缀，按「路径后缀」在项目文件里解析（别名无关，不写死任何路径）。
function extractReferencedProjectFiles(text, files) {
  const resolved = new Set();
  const regex = /['"]([^'"\s]*\/[^'"\s]+)['"]/g;
  let match;
  while ((match = regex.exec(String(text || '')))) {
    const suffix = match[1].replace(/^[@~]?\.*\/+/, '').replace(/\?.*$/, '');
    if (!suffix || suffix.length < 3) continue;
    const candidates = [suffix, `${suffix}.vue`, `${suffix}.ts`, `${suffix}/index.vue`, `${suffix}/index.ts`];
    for (const candidate of candidates) {
      const hit = files.find(file => file.path === candidate || file.path.endsWith(`/${candidate}`));
      if (hit) { resolved.add(hit.path); break; }
    }
  }
  return [...resolved];
}

function buildPlanningInput(body, modelItems) {
  const payload = body.searchPayload || {};
  const investigations = Array.from(new Map((modelItems || [])
    .map(item => item.sourceInvestigation)
    .filter(Boolean)
    .map(item => [JSON.stringify(item), item])).values());
  return {
    requirement: payload.userPrompt || '',
    page: {
      url: payload.url || body.url || '',
      path: body.pagePath || body.routeResolver?.pagePath || '',
    },
    selections: (Array.isArray(body.originSelections) ? body.originSelections : []).slice(0, 8),
    locatedSources: (modelItems || []).map(item => ({
      file: item.file,
      role: item.sourceRole || 'related',
      locateLevel: item.locateLevel || '',
      codeSnippet: item.codeSnippet || item.rawCodeSnippet || '',
      confidence: Number(item.confidence || 0),
      // 带上 DOM Locator 定位到的精确锚点/行号，兜底计划据此指到真正的目标，而非文件首行。
      anchor: item.anchor || item.locateAnchor || '',
      line: Number(item.line || item.locateLine || 0),
    })),
    investigations,
  };
}

function hydratePlanningSources(project, input, textCache = new Map()) {
  const files = new Map((project?.files || []).map(file => [file.path, file]));
  const allFiles = project?.files || [];
  const budget = { remaining: MAX_SOURCE_CHARS_TOTAL };
  const completeFiles = new Set();

  // 有明确 definition 落点时，通用渲染器/装配等"非改动目标"只是识别证据，给小预览即可——
  // 别把 8KB 渲染器全量挂进上下文（每轮都背着它，是"慢/内容多"的主因）。
  const hasDefinition = input.locatedSources.some(source => /data-source|definition/.test(String(source.role || '')));
  const EVIDENCE_PREVIEW_CHARS = 1200;
  const isEvidenceOnly = source =>
    hasDefinition && !/data-source|definition|reference-example/.test(String(source.role || ''));

  const hydrate = source => {
    const file = files.get(source.file);
    if (!file || budget.remaining <= 0) return '';
    const text = readProjectText(project, file, textCache);
    if (!text) return '';
    const cap = isEvidenceOnly(source) ? EVIDENCE_PREVIEW_CHARS : MAX_SOURCE_CHARS_PER_FILE;
    const limit = Math.min(cap, budget.remaining);
    const excerpt = text.slice(0, limit);
    const complete = excerpt.length === text.length;
    source.sourceContent = {
      complete,
      characters: excerpt.length,
      content: numberedSource(excerpt),
      ...(complete ? {} : {
        note: isEvidenceOnly(source)
          ? '该文件是渲染/装配证据、非改动目标，仅给前段用于识别；确需其完整实现再定向读取。'
          : '文件超过首轮证据预算，需要更多内容时再调用 read_file 精确读取。',
      }),
    };
    if (complete) completeFiles.add(source.file);
    budget.remaining -= excerpt.length;
    return text;
  };

  // 先按可编辑度排序，预算优先给可能改动/参考的文件；基建（co-render/assembly）排后。
  input.locatedSources.sort((a, b) => editableRank(a.role) - editableRank(b.role));
  const definitionTexts = [];
  for (const source of input.locatedSources) {
    const text = hydrate(source);
    if (text && /data-source|definition/.test(String(source.role || ''))) definitionTexts.push(text);
  }

  // 定义驱动场景：把 definition 文件引用到的兄弟实现补进来当参考模板——"加一项"最需要的就是同级示例。
  // 越深的路径越像具体页面/组件（优先），排除已定位文件，最多 2 个，量入为出。
  const located = new Set(input.locatedSources.map(source => source.file));
  const referenced = new Set();
  for (const text of definitionTexts) {
    for (const filePath of extractReferencedProjectFiles(text, allFiles)) {
      if (!located.has(filePath)) referenced.add(filePath);
    }
  }
  input.referenceExamples = [];
  const references = [...referenced]
    .sort((a, b) => b.split('/').length - a.split('/').length)
    .slice(0, 2);
  for (const filePath of references) {
    if (budget.remaining <= 0) break;
    const source = { file: filePath, role: 'reference-example' };
    if (hydrate(source)) input.referenceExamples.push(source);
  }

  return { input, completeFiles };
}

function planningSystemPrompt() {
  return [
    '你是 Magnus Planning Agent。DOM Locator 已完成源码定位，你在已定位证据上产出实施规划，不亲自改代码。',
    '证据足够时不要调用任何工具，直接提交结构化计划。',
    'locatedSources.sourceContent / referenceExamples 是预读源码；complete=true 表示完整文件已给出，不要再 read_file 分页读它。referenceExamples 是项目里同类的现有实现，供参考复用，不是改动目标。',
    '规划方法（不预设需求形态，新增/修改/删除/重构皆适用）：',
    '  ① 理解并拆解：把需求拆成若干相对独立的子改动，逐个判断它落在哪个文件、改什么。',
    '  ② 定落点与复用：每个子改动优先落在已定位文件上；凡与项目已有实现同构的部分，优先复用现成写法（含 referenceExamples），不要从零设想或另立约定；不要为核对每个细节去逐段翻源码。',
    '  ③ 组合并自洽：把子改动合并进 targets，确保彼此的引用/命名一致，不残留悬空引用。',
    '优先形成最小可执行改动。只在"缺失事实会改变改动文件/代码范围/实现方式"时才调用工具；不要为补背景、找更优方案或解释完整调用链而调查。不影响核心计划的未知写进 risks / verification / questions。',
    '所有工具按其 name / description / input schema 理解，不假设固定调用顺序。',
    '需由用户决定产品行为时 status=needs_confirmation 并列 questions；否则 ready。按给定结构化格式提交，不编造文件、接口、组件、字段或项目约定。',
  ].join('\n');
}

function planningObjective(input) {
  return [
    '根据以下已定位证据完成修改计划。需要更多真实依据时自行调用可用工具；证据足够后立即结束。',
    JSON.stringify(input, null, 2),
  ].join('\n\n');
}

module.exports = {
  buildPlanningInput,
  hydratePlanningSources,
  planningSystemPrompt,
  planningObjective,
};
