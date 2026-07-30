'use strict';

// Locator 的确定性前置阶段。这里只整理项目、可用运行上下文、DOM 和已捕获事实，
// 不判断渲染归属，也不生成候选结论。
const fs = require('fs');
const path = require('path');
const { resolvePageRouteTrace } = require('../route-resolvers/registry');
const { plannerDomInput } = require('../dom');

const MAX_STRUCTURE_CHARS = 24000;
const MAX_FALLBACK_PATHS = 500;

// 项目结构：优先读 .gocapture/Structure.md，缺失时回退为文件路径清单。
function readProjectStructure(project) {
  const structurePath = path.join(project.path, '.gocapture', 'Structure.md');
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

function routeFactsFromResult(body, routeResult) {
  return {
    pagePath: body?.pagePath || body?.url || '',
    matched: !!routeResult.trace?.matched,
    bestPageFile: routeResult.trace?.bestPageFile || '',
    hits: (routeResult.hits || []).slice(0, 8).map(hit => ({
      file: hit.file,
      routePath: hit.routePath,
      reasons: hit.reasons || [],
    })),
  };
}

function selectionFacts(domSelections, rawSelections = []) {
  return domSelections.map((item, index) => ({
    selectionId: String(rawSelections[index]?.uid || rawSelections[index]?.element?.uid || ''),
    index: item.index,
    tag: item.tag,
    selector: item.selector,
    className: item.className,
    directText: item.directText || item.text || '',
    text: item.text || '',
    markup: item.markup,
    rawMarkupLength: item.rawMarkupLength,
    compressedMarkupLength: item.compressedMarkupLength,
  }));
}

function capturedPageFacts(body) {
  const selections = Array.isArray(body?.selections) ? body.selections : [];
  return {
    componentHints: selections
      .map(item => item?.sourceLocate || item?.element?.sourceLocate || null)
      .filter(Boolean),
    apiRequests: (Array.isArray(body?.apiRequests) ? body.apiRequests : []).slice(0, 30),
    manualEvidence: String(body?.manualEvidence || '').trim(),
  };
}

function scopedSelectionBody(body) {
  const selections = Array.isArray(body?.selections) ? body.selections : [];
  const activeIds = new Set((Array.isArray(body?.activeSelectionIds) ? body.activeSelectionIds : [])
    .map(String)
    .map(value => value.trim())
    .filter(Boolean));
  if (!activeIds.size) return body;
  return {
    ...body,
    selections: selections.filter(item => activeIds.has(String(
      item?.uid || item?.selectionId || item?.element?.uid || '',
    ).trim())),
  };
}

function buildLocatorEvidencePackage(project, body, options = {}) {
  if (!project) throw new Error('No project selected.');
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  const textCache = options.textCache || new Map();
  const scopedBody = scopedSelectionBody(body);

  onLog('本地证据准备：解析可用运行上下文');
  const routeResult = resolvePageRouteTrace(project, scopedBody, textCache);
  const routeFacts = routeFactsFromResult(scopedBody, routeResult);
  onLog(`本地证据：上下文入口${routeFacts.matched ? '已命中' : '未命中'}${routeFacts.bestPageFile ? `；入口候选=${routeFacts.bestPageFile}` : ''}`);

  onLog('本地证据准备：压缩当前 DOM 选区');
  const domSelections = plannerDomInput(scopedBody);
  const selections = selectionFacts(
    domSelections,
    Array.isArray(scopedBody?.selections) ? scopedBody.selections : [],
  );
  onLog(`本地证据：选区=${selections.length}；原始字符=${domSelections.reduce((sum, item) => sum + item.rawMarkupLength, 0)}；压缩字符=${domSelections.reduce((sum, item) => sum + item.compressedMarkupLength, 0)}`);

  const projectStructure = options.includeProjectStructure === false
    ? ''
    : readProjectStructure(project);
  const evidence = {
    version: 1,
    project: {
      name: project.name || '',
      root: project.path,
      kind: project.kind || 'unknown',
    },
    request: {
      userInstruction: String(scopedBody?.userPrompt || scopedBody?.prompt || scopedBody?.message || '').trim(),
      pageUrl: String(scopedBody?.pageUrl || scopedBody?.url || '').trim(),
      pagePath: String(scopedBody?.pagePath || '').trim(),
    },
    route: routeFacts,
    selections,
    captured: capturedPageFacts(scopedBody),
    ...(projectStructure ? { projectStructure } : {}),
  };

  onLog(`本地证据包已完成：路由事实=${routeFacts.hits.length}；DOM 选区=${selections.length}${projectStructure ? `；项目结构=${projectStructure.length} 字符` : ''}`);
  return {
    evidence,
    routeResult,
    domSelections,
    textCache,
  };
}

module.exports = {
  buildLocatorEvidencePackage,
  routeFactsFromResult,
  scopedSelectionBody,
  selectionFacts,
};
