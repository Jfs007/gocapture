'use strict';

const { z } = require('zod');

const changeTargetSchema = z.object({
  file: z.string(),
  anchor: z.string(),
  line: z.number(),
  whatToChange: z.string(),
  why: z.string(),
});

const confirmationSchema = z.object({
  id: z.string(),
  question: z.string(),
  reason: z.string(),
  options: z.array(z.string()),
});

const planningResultSchema = z.object({
  status: z.enum(['ready', 'needs_confirmation']),
  understanding: z.string(),
  summary: z.string(),
  targets: z.array(changeTargetSchema),
  affected: z.array(z.object({ file: z.string(), reason: z.string() })),
  reusePatterns: z.array(z.string()),
  risks: z.array(z.string()),
  verification: z.array(z.string()),
  questions: z.array(confirmationSchema),
  confirmedFacts: z.array(z.string()),
  assumptions: z.array(z.string()),
  usedCapabilities: z.array(z.string()),
}).meta({ title: 'magnus_change_plan', description: 'Submit the final Magnus change plan.' });

function normalizeText(value) {
  return value == null ? '' : String(value).trim();
}

function normalizePlanningResult(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const targets = (Array.isArray(raw.targets) ? raw.targets : []).map(item => ({
    file: normalizeText(item?.file),
    anchor: normalizeText(item?.anchor),
    line: Math.max(0, Number(item?.line || 0)),
    whatToChange: normalizeText(item?.whatToChange),
    why: normalizeText(item?.why),
  })).filter(item => item.file && item.whatToChange);
  const questions = (Array.isArray(raw.questions) ? raw.questions : []).map((item, index) => ({
    id: normalizeText(item?.id) || `question_${index + 1}`,
    question: normalizeText(item?.question),
    reason: normalizeText(item?.reason),
    options: (Array.isArray(item?.options) ? item.options : []).map(normalizeText).filter(Boolean),
  })).filter(item => item.question);
  const textList = items => (Array.isArray(items) ? items : []).map(normalizeText).filter(Boolean);
  return {
    status: raw.status === 'needs_confirmation' || questions.length ? 'needs_confirmation' : 'ready',
    understanding: normalizeText(raw.understanding),
    summary: normalizeText(raw.summary),
    targets,
    affected: (Array.isArray(raw.affected) ? raw.affected : []).map(item => ({
      file: normalizeText(item?.file),
      reason: normalizeText(item?.reason),
    })).filter(item => item.file),
    reusePatterns: textList(raw.reusePatterns),
    risks: textList(raw.risks),
    verification: textList(raw.verification),
    questions,
    confirmedFacts: textList(raw.confirmedFacts),
    assumptions: textList(raw.assumptions),
    usedCapabilities: textList(raw.usedCapabilities),
  };
}

function toLegacyChangePlan(result) {
  return {
    selectionUnderstanding: result.understanding,
    summary: result.summary,
    targets: result.targets,
    affected: result.affected,
    reusePatterns: result.reusePatterns,
    risks: result.risks,
    verification: result.verification,
    openQuestions: result.questions.map(item => ({
      id: item.id,
      question: item.question,
      reason: item.reason,
      options: item.options,
    })),
  };
}

function changePlanToText(result, requirement = '') {
  const lines = [`# 修改计划：${result.summary || requirement}`];
  if (result.understanding) lines.push('', '## 需求理解', `- ${result.understanding}`);
  if (result.targets.length) {
    lines.push('', '## 改动点');
    for (const target of result.targets) {
      const location = target.line ? `${target.file}:${target.line}` : target.file;
      lines.push(`- ${location}${target.anchor ? `（${target.anchor}）` : ''}`);
      lines.push(`  改什么：${target.whatToChange}`);
      if (target.why) lines.push(`  原因：${target.why}`);
    }
  }
  const section = (title, values) => {
    if (!values.length) return;
    lines.push('', `## ${title}`);
    for (const value of values) lines.push(`- ${value}`);
  };
  section('复用方式', result.reusePatterns);
  section('风险', result.risks);
  section('验证', result.verification);
  if (result.questions.length) {
    lines.push('', '## 待确认');
    for (const item of result.questions) {
      lines.push(`- ${item.question}${item.reason ? `（${item.reason}）` : ''}`);
    }
  }
  return lines.join('\n').trim();
}

function firstMeaningfulLine(snippet) {
  for (const line of String(snippet || '').split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed.slice(0, 120);
  }
  return '';
}

// 规划预算触发 / 模型未产出结构化计划时的兜底：从已定位证据合成最小可执行「骨架」，绝不硬失败。
// 定义驱动 + 有同级模板时，产出「定义里加一项 + 照模板新建同级实现」的双线索骨架，而不是回显需求。
function buildFallbackPlan(input) {
  const sources = Array.isArray(input.locatedSources) ? input.locatedSources : [];
  const references = Array.isArray(input.referenceExamples) ? input.referenceExamples : [];
  const byRole = pattern => sources.find(source => pattern.test(String(source.role || '')));
  // 落点优先级：definition/data-source（"增/改一项"改这里，通用渲染器一般不动）→ render → 最高置信。
  const primary = byRole(/data-source|definition/)
    || byRole(/render/)
    || sources.slice().sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))[0];
  const isDefinitionDriven = primary && /data-source|definition/.test(String(primary.role || ''));
  const sibling = references[0]; // 同级复用模板（Fix：hydrate 从 definition 引用解析而来）

  const targets = primary ? [{
    file: primary.file,
    // 优先用 DOM Locator 定位到的精确锚点/行号；没有才退回代码片段首行。
    anchor: primary.anchor || firstMeaningfulLine(primary.codeSnippet) || String(primary.role || ''),
    line: Number(primary.line) || 0,
    whatToChange: isDefinitionDriven
      ? `在此定义中新增一项以满足需求：${input.requirement || ''}（参照同文件已有同级项的写法；兜底骨架，条目具体值需人工确认）`
      : `${input.requirement || '按需求在此处实施改动'}（兜底骨架，改动细节需人工确认）`,
    why: isDefinitionDriven
      ? 'DOM Locator 定位为生成该选区的定义/数据源；「增/改一项」类需求通常改这里，而非通用渲染器'
      : 'DOM Locator 已定位为该选区的直接渲染源',
  }] : [];

  // 定义驱动「加一项」通常还要照同级模板新建一个实现文件；把它作为复用线索 + 待确认项带出，而非硬编成 target。
  const reusePatterns = isDefinitionDriven && sibling
    ? [`照 ${sibling.file} 的结构/风格新建同级实现（其表格列、筛选、mock 数据的写法可复用）`]
    : [];
  const affected = isDefinitionDriven && sibling
    ? [{ file: sibling.file, reason: '新增同级项时的复用模板' }]
    : [];
  const questions = isDefinitionDriven && sibling
    ? [{
        id: 'new_sibling_impl',
        question: '新增的同级项要照哪个已有实现新建、放在哪个目录、叫什么名字？',
        reason: `在 ${primary.file} 定义里加一条后，通常还需照 ${sibling.file} 新建一个同级实现文件，其命名/路径需你确认`,
        options: [],
      }]
    : [];

  return normalizePlanningResult({
    status: 'needs_confirmation',
    understanding: `规划未产出结构化计划，基于 DOM Locator 已定位证据${sibling ? `与同级模板 ${sibling.file}` : ''}给出的兜底骨架。需求：${input.requirement || ''}`,
    summary: primary
      ? `在 ${primary.file} 新增一项${isDefinitionDriven && sibling ? `，并照 ${sibling.file} 新建同级实现` : ''}：${input.requirement || ''}`
      : (input.requirement || '需人工补充修改计划'),
    targets,
    reusePatterns,
    affected,
    questions,
    risks: ['规划未在预算内完成完整调查，本计划为基于定位证据的最小骨架，条目具体值/新建文件命名需人工确认。'],
    confirmedFacts: sources.map(source => `已定位：${source.file}（${source.role || 'related'}）`),
  });
}

module.exports = {
  changePlanToText,
  normalizePlanningResult,
  planningResultSchema,
  toLegacyChangePlan,
  buildFallbackPlan,
};
