'use strict';

// 锚点种子（0 轮 LLM 的确定性预检索）：用选区静态文字锚点在源码里按稀有度加权求交集，
// 得到「排在越前越可能是真实渲染源」的候选。框架无关，不依赖经验/context7。
const { executeAgentTool } = require('../../agent-host/tools/registry');

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

module.exports = {
  extractSeedAnchors,
  computeAnchorSeed,
};
