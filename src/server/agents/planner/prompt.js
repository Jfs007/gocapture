'use strict';

// Planner 的系统提示词 + 目标构建 + 输入整备：把 DOM Locator 的定位结果整理成规划输入
// （需求、页面、选区、已定位源码及其预读正文）。
const { readProjectText } = require('../../core/fs-utils');

const MAX_SOURCE_CHARS_PER_FILE = 30000;
const MAX_SOURCE_CHARS_TOTAL = 60000;

function numberedSource(text) {
  return String(text || '').split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n');
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
  let remaining = MAX_SOURCE_CHARS_TOTAL;
  const completeFiles = new Set();
  for (const source of input.locatedSources) {
    const file = files.get(source.file);
    if (!file || remaining <= 0) continue;
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const limit = Math.min(MAX_SOURCE_CHARS_PER_FILE, remaining);
    const excerpt = text.slice(0, limit);
    const complete = excerpt.length === text.length;
    source.sourceContent = {
      complete,
      characters: excerpt.length,
      content: numberedSource(excerpt),
      ...(complete ? {} : { note: '文件超过首轮证据预算，需要更多内容时再调用 read_file 精确读取。' }),
    };
    if (complete) completeFiles.add(source.file);
    remaining -= excerpt.length;
  }
  return { input, completeFiles };
}

function planningSystemPrompt() {
  return [
    '你是 Magnus Planning Agent。DOM Locator 已完成源码定位，你在已定位证据上完成实施规划。',
    '证据足够时不要调用任何工具，直接提交结构化计划。',
    'locatedSources.sourceContent 是预读源码；complete=true 表示完整文件已给出，不要再 read_file 分页读它。',
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
