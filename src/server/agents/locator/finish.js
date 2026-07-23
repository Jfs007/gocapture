'use strict';

// finish_dom_location 工具（结构化交卷）+ 裁决归一 + 兜底裁决：
// - normalizeLocatorDecision：把模型 JSON 归一为决策，只保留项目里真实存在的文件/关系。
// - buildFallbackDecision：撞递归上限或空结论时，用锚点交集/检索证据合成 best-effort 结论。
const { loadLangChainRuntime } = require('../../agent-host/langchain/runtime');
const { parseJsonResult } = require('../../utils/parse-json');
const { normalizePath } = require('./paths');

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

module.exports = {
  createFinishTool,
  normalizeLocatorDecision,
  buildFallbackDecision,
};
