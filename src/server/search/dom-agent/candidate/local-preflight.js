const path = require('path');
const { uniq } = require('../../../utils');
const { searchProjectWithMeta } = require('../../keyword/index');
const {
  DEFAULT_DOM_AGENT_THRESHOLD,
  STYLE_EXTENSIONS,
  selectionList,
  selectionMarkup,
} = require('../anchor/dom-utils');

function isRouteOnlyLocalHit(hit) {
  const reasons = (hit?.reasons || []).map(String);
  return reasons.some(reason => reason.includes('只有路由命中，缺少本文件局部证据'))
    || (reasons.some(reason => reason.includes('强证据命中(route)：route-hit'))
      && !reasons.some(reason => /强证据命中\((?:text|class|attr|dom|component)\)/.test(reason)));
}

function hasDirectLocalUiEvidence(hit) {
  if (!hit || STYLE_EXTENSIONS.has(path.posix.extname(hit.file || ''))) return false;
  if (isRouteOnlyLocalHit(hit)) return false;
  const reasons = (hit.reasons || []).map(String);
  return reasons.some(reason => /强证据命中\((?:text|class|attr|dom|component)\)/.test(reason))
    || reasons.some(reason => reason.includes('DOM 分组链路确认'))
    || reasons.some(reason => reason.includes('同窗口共现'))
    || reasons.some(reason => reason.includes('L0 当前页面模块闭包：仅用当前选区文案/class 初始命中'));
}

function hasCurrentPageRelation(hit) {
  const reasons = (hit?.reasons || []).map(String);
  return reasons.some(reason => reason.includes('检索层级：L0 当前页面模块闭包'))
    || reasons.some(reason => reason.includes('页面引用链'))
    || reasons.some(reason => reason.includes('当前页面源码闭包'))
    || reasons.some(reason => reason.includes('路径精确匹配'));
}

function selectionMarkupTotalLength(body) {
  return selectionList(body).reduce((total, selection) => total + selectionMarkup(selection).length, 0);
}

function localPreflightConvergence(project, body, onLog) {
  if (body?.agentState?.expansionRetry) {
    onLog('DOM Agent 前置本地检索跳过：自动扩区轮次必须继续进入 Planner/Judge 校验');
    return null;
  }
  if (selectionMarkupTotalLength(body) > DEFAULT_DOM_AGENT_THRESHOLD) {
    return null;
  }
  onLog('DOM Agent 前置本地检索：searchProjectWithMeta(body)');
  const localResult = searchProjectWithMeta(project, body);
  const hits = localResult.hits || [];
  onLog(`DOM Agent 前置本地输出：${JSON.stringify({
    candidateCount: hits.length,
    route: localResult.routeResolver?.bestPageFile || '',
    files: hits.slice(0, 8).map(hit => ({
      file: hit.file,
      score: hit.score,
      routeOnly: isRouteOnlyLocalHit(hit),
      directEvidence: hasDirectLocalUiEvidence(hit),
      currentPageRelation: hasCurrentPageRelation(hit),
    })),
  }, null, 2)}`);
  if (!localResult.routeResolver?.matched) return null;
  const directHits = hits.filter(hit => hasDirectLocalUiEvidence(hit) && hasCurrentPageRelation(hit));
  if (!directHits.length || directHits.length > 2 || hits.length > 6) return null;
  const rankedHits = [
    ...directHits.map((hit, index) => ({
      ...hit,
      score: 1600 - index * 50 + Math.min(80, Math.round((hit.score || 0) / 10)),
      stage: 'local-preflight',
      sourceRole: 'render',
      preciseEvidence: true,
      reasons: uniq([
        'DOM Agent 前置本地收敛：当前页面闭包内存在直接 UI 证据，跳过模型 Planner',
        ...(hit.reasons || []),
      ]).slice(0, 12),
    })),
    ...hits
      .filter(hit => !directHits.some(direct => direct.file === hit.file))
      .map(hit => ({
        ...hit,
        score: Math.min(hit.score || 0, isRouteOnlyLocalHit(hit) ? 240 : 900),
        stage: hit.stage || 'local-preflight-context',
        sourceRole: isRouteOnlyLocalHit(hit) ? 'assembly' : (hit.sourceRole || ''),
        reasons: uniq([
          isRouteOnlyLocalHit(hit)
            ? 'DOM Agent 前置本地收敛：路由入口仅作为装配上下文'
            : 'DOM Agent 前置本地收敛：相关上下文候选',
          ...(hit.reasons || []),
        ]).slice(0, 12),
      })),
  ].sort((a, b) => b.score - a.score);
  return {
    ...localResult,
    hits: rankedHits,
    agent: {
      enabled: true,
      localPreflight: true,
      reason: '当前路由闭包内少量候选已由本地直接 UI 证据收敛',
      directFiles: directHits.map(hit => hit.file),
    },
  };
}

module.exports = {
  isRouteOnlyLocalHit,
  hasDirectLocalUiEvidence,
  hasCurrentPageRelation,
  selectionMarkupTotalLength,
  localPreflightConvergence,
};
