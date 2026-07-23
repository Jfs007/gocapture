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

module.exports = {
  changePlanToText,
  normalizePlanningResult,
  planningResultSchema,
  toLegacyChangePlan,
};
