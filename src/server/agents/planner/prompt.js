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

  const hydrate = source => {
    const file = files.get(source.file);
    if (!file || budget.remaining <= 0) return '';
    const text = readProjectText(project, file, textCache);
    if (!text) return '';
    const limit = Math.min(MAX_SOURCE_CHARS_PER_FILE, budget.remaining);
    const excerpt = text.slice(0, limit);
    const complete = excerpt.length === text.length;
    source.sourceContent = {
      complete,
      characters: excerpt.length,
      content: numberedSource(excerpt),
      ...(complete ? {} : { note: '文件超过首轮证据预算，需要更多内容时再调用 read_file 精确读取。' }),
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
    '你是 Magnus Planning Agent。DOM Locator 已完成源码定位，你在已定位证据上完成实施规划。',
    '证据足够时不要调用任何工具，直接提交结构化计划。',
    'locatedSources.sourceContent 是预读源码；complete=true 表示完整文件已给出，不要再 read_file 分页读它。',
    'referenceExamples 是与改动目标同级的现有实现（预读），供你参考复用其结构/风格；它们是参考、不是改动目标，同样 complete=true 时不要再 read_file 翻页。',
    '优先形成最小可执行改动。只在"缺失事实会改变改动文件/代码范围/实现方式"时才调用工具；不要为补背景、找更优方案、找相似示例或解释完整调用链而调查。',
    '所有工具按其 name / description / input schema 理解，不假设固定调用顺序。',
    '不影响核心计划的未知，写进 risks / verification / questions，不要无休止调查。',
    '需由用户决定产品行为时 status=needs_confirmation 并列 questions；否则 ready。按给定结构化格式提交。',
    '不执行代码修改，不编造文件、接口、组件、字段或项目约定。',
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
