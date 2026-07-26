'use strict';

// Locator 的确定性前置阶段。这里只整理项目、可用运行上下文、DOM 和已捕获事实，
// 不判断渲染归属，也不生成候选结论。
const { resolvePageRouteTrace } = require('../route-resolvers/registry');
const { plannerDomInput } = require('../dom');
const { readProjectStructure } = require('../agents/locator/prompt');

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

function buildLocatorEvidencePackage(project, body, options = {}) {
  if (!project) throw new Error('No project selected.');
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  const textCache = options.textCache || new Map();

  onLog('本地证据准备：解析可用运行上下文');
  const routeResult = resolvePageRouteTrace(project, body, textCache);
  const routeFacts = routeFactsFromResult(body, routeResult);
  onLog(`本地证据：上下文入口${routeFacts.matched ? '已命中' : '未命中'}${routeFacts.bestPageFile ? `；入口候选=${routeFacts.bestPageFile}` : ''}`);

  onLog('本地证据准备：压缩当前 DOM 选区');
  const domSelections = plannerDomInput(body);
  const selections = selectionFacts(
    domSelections,
    Array.isArray(body?.selections) ? body.selections : [],
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
      userInstruction: String(body?.userPrompt || body?.prompt || body?.message || '').trim(),
      pageUrl: String(body?.pageUrl || body?.url || '').trim(),
      pagePath: String(body?.pagePath || '').trim(),
    },
    route: routeFacts,
    selections,
    captured: capturedPageFacts(body),
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
  selectionFacts,
};
