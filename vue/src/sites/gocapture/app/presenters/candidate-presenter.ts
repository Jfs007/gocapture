// @ts-nocheck
export function candidateStageLabel(hit) {
  const labels = {
    keyword: '关键词命中',
    reverse: '组件反查',
    'import-chain': 'import 链路',
    'route-import-chain': '页面链路',
    'api-endpoint': '接口定义',
    'api-usage': '接口调用',
    'api-upstream': '上层引用',
    'model-agent': '模型定位',
    'runtime-source': '框架运行时定位',
    'route-resolver': '页面路由'
  };
  return labels[hit?.stage] || '候选命中';
}

export function candidateStageExplanation(hit) {
  const reasons = hit.reasons || [];
  const uniqueLine = hit.preciseEvidence
    ? `可靠证据: 选区上下文与命中文案在同文件汇合${hit.exactMatchText ? `；命中 "${hit.exactMatchText}"` : ''}${hit.contextScore ? `；上下文分 ${hit.contextScore}` : ''}`
    : hit.uniqueSnippet && hit.uniqueMatchCount === 1
      ? `可靠证据: 文件内唯一文案命中(${hit.uniqueMatchLabel || '文案'}) "${hit.uniqueMatchText || '-'}"，但仍需结合页面上下文判断`
      : '可靠证据: 暂无强页面上下文证据，当前只作为候选参与排序';
  if (hit.stage === 'import-chain' || hit.stage === 'route-import-chain') {
    return [
      hit.stage === 'route-import-chain'
        ? `定位过程: 先用页面 path 命中当前页面入口 ${hit.anchorFile || hit.from || '-'}，再沿 import 链路访问到该候选文件`
        : `定位过程: 先用补充线索命中 ${hit.anchorFile || hit.from || '-'}，再沿 import 链路访问到该候选文件`,
      hit.importChain && hit.importChain.length ? `import 链路: ${hit.importChain.join(' -> ')}` : '',
      uniqueLine,
      ...reasons.slice(0, 6).map(reason => `依据: ${reason}`)
    ];
  }
  if (hit.stage === 'reverse') {
    return [
      `定位过程: 先命中子组件/模块 ${hit.from || '-'}，再反查哪些页面或模块引用它`,
      uniqueLine,
      ...reasons.slice(0, 6).map(reason => `依据: ${reason}`)
    ];
  }
  if (hit.stage === 'api-endpoint' || hit.stage === 'api-usage' || hit.stage === 'api-upstream') {
    return [
      '定位过程: 先用接口端点搜索接口封装，再追踪函数/符号引用到页面或模块',
      hit.from ? `来源: ${hit.from}` : '',
      uniqueLine,
      ...reasons.slice(0, 6).map(reason => `依据: ${reason}`)
    ];
  }
  if (hit.stage === 'route-resolver') {
    return [
      `定位过程: 先按当前页面 path 选择 ${hit.routeAdapter || 'unknown'} 路由适配器，再解析路由声明或文件系统路由`,
      hit.from ? `来源: ${hit.from}` : '',
      hit.routePath ? `路由 path: ${hit.routePath}` : '',
      uniqueLine,
      ...reasons.slice(0, 6).map(reason => `依据: ${reason}`)
    ];
  }
  if (hit.stage === 'model-agent') {
    const preModelSource = hit.preModelStage ? `本地来源: ${candidateStageLabel({ stage: hit.preModelStage })}` : '';
    const preModelRuntimeReasons = hit.preModelStage === 'runtime-source'
      ? (hit.preModelReasons || []).slice(0, 4).map(reason => `运行时依据: ${reason}`)
      : [];
    return [
      `定位过程: 模型阅读本地预检索结果、候选文件内容和选区证据后推荐该文件`,
      preModelSource,
      hit.modelAdapter ? `模型: ${hit.modelAdapter}` : '',
      hit.modelConfidence ? `置信度: ${hit.modelConfidence}%` : '',
      hit.modelLocateLevel ? `定位层级: ${hit.modelLocateLevel}${hit.modelDowngradedToDirection ? '；片段未逐字验证，已降级为源码方向' : ''}` : '',
      hit.modelCodeSnippet ? `${hit.modelSnippetVerified === false ? '模型源码方向片段' : '模型代码片段'}: ${hit.modelCodeSnippet}` : '',
      hit.modelDirectionGuess ? `推测方向: ${hit.modelDirectionGuess}` : '',
      hit.modelPrompt ? `模型提示词: ${hit.modelPrompt}` : '',
      uniqueLine,
      ...preModelRuntimeReasons,
      ...reasons.slice(0, 6).map(reason => `依据: ${reason}`)
    ];
  }
  if (hit.stage === 'runtime-source') {
    return [
      `定位过程: 由页面运行时组件实例/Fiber/调试字段直接提供源码线索`,
      hit.framework ? `框架: ${hit.framework}` : '',
      hit.sourceConfidence ? `置信度: ${hit.sourceConfidence}` : '',
      hit.sourceComponentName ? `组件: ${hit.sourceComponentName}` : '',
      hit.sourceLine ? `源码位置: ${hit.sourceLine}${hit.sourceColumn ? `:${hit.sourceColumn}` : ''}` : '',
      hit.sourceRuntimeFile ? `运行时路径: ${hit.sourceRuntimeFile}` : '',
      ...reasons.slice(0, 6).map(reason => `依据: ${reason}`)
    ];
  }
  return [
    '定位过程: 直接用页面文案、className、URL path、用户补充证据检索源码内容和路径',
    uniqueLine,
    ...reasons.slice(0, 6).map(reason => `依据: ${reason}`)
  ];
}

export function candidateLogLines(hit, index) {
  if (!hit) return [];
  const lines = [
    index != null ? `候选 ${index + 1}: ${hit.file}` : `文件: ${hit.file}`,
    `命中方式: ${candidateStageLabel(hit)}；分数 ${hit.score}`,
    hit.exactMatchText ? `文案命中统计: "${hit.exactMatchText}" 在该文件出现 ${hit.exactMatchCount || 0} 次` : '',
    ...candidateStageExplanation(hit)
  ].filter(Boolean);
  if (hit.preciseSnippet || (hit.uniqueSnippet && hit.uniqueMatchCount === 1)) {
    lines.push(`源码片段:\n${hit.preciseSnippet || hit.uniqueSnippet}`);
  }
  return lines;
}

export function candidateDetailTitle(hit) {
  return hit?.preciseSnippet || (hit?.uniqueSnippet && hit.uniqueMatchCount === 1) ? '查看命中片段和日志' : '查看检索日志';
}

export function candidateLogText(hit) {
  return candidateLogLines(hit).join('\n');
}
