import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useComposerStore } from '../../stores/composer.store';
import { useProjectStore } from '../../stores/project.store';
import { useRequestStore } from '../../stores/request.store';
import { useRouteStore } from '../../stores/route.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';
import { candidateLogLines } from './candidate-presenter';

export function createSearchLogLines({
  combinedSelectionText,
  normalizeInstructionText
}) {
  const composerStore = useComposerStore();
  const projectStore = useProjectStore();
  const requestStore = useRequestStore();
  const routeStore = useRouteStore();
  const searchStore = useSearchStore();
  const selectionStore = useSelectionStore();
  const { content: promptIntent } = storeToRefs(composerStore);
  const { current: project } = storeToRefs(projectStore);
  const { recent: recentRequests } = storeToRefs(requestStore);
  const { pagePath: pageUrlPath, resolverTrace: routeResolverTrace } = storeToRefs(routeStore);
  const {
    candidates: candidateHits,
    includeApiEvidence,
    apiTrace,
    i18nTrace,
    definitionTrace
  } = storeToRefs(searchStore);
  const selectedItems = computed(() => selectionStore.items.map(item => ({
    info: item.element || {}
  })));
  const searchApiRequests = computed(() => includeApiEvidence.value ? recentRequests.value.slice(0, 5) : []);

  return function searchLogLines() {
    const routeLines = routeResolverLogLines({ routeResolverTrace, pageUrlPath, project });
    const lines = [
      `1. 收集页面证据: pagePath=${pageUrlPath.value}；选区数=${selectedItems.value.length}；className=${selectedItems.value.map(item => item.info.className).filter(Boolean).join(' ') || '-'}`,
      `   源码项目: ${project.value?.path || project.value?.name || '-'}`,
      ...routeLines,
      `3. 组合检索词: ${combinedSelectionText() || '-'}`,
      `4. 用户指令: ${normalizeInstructionText(promptIntent.value) || '-'}`,
      '5. 源码检索: 再按文案/className/url path/用户指令搜索开发源码文件，跳过 node_modules/dist/build 等非源码目录',
      '6. 链路推断: 对页面线索或用户指令命中的文件继续沿 import 链路向下追踪，并对组件候选做引用反查'
    ];
    if (includeApiEvidence.value) {
      const endpoints = searchApiRequests.value
        .map(item => item.pathname || item.url)
        .filter(Boolean)
        .slice(0, 5);
      lines.push(`7. 接口线索: ${endpoints.length ? endpoints.join('；') : '未捕获到接口端点'}`);
      lines.push(...apiTraceLogLines(apiTrace));
    }
    lines.push(...i18nTraceLogLines(i18nTrace));
    lines.push(...definitionTraceLogLines(definitionTrace));
    for (const [index, hit] of candidateHits.value.slice(0, 8).entries()) {
      lines.push(...candidateLogLines(hit, index));
    }
    return lines;
  };
}

function i18nTraceLogLines(i18nTrace) {
  const trace = i18nTrace?.value;
  if (!trace || !trace.active) return [];
  const lines = [];
  const hints = [
    ...(trace.environment?.packageHints || []),
    ...(trace.environment?.codeHints || []).slice(0, 3)
  ].filter(Boolean);
  lines.push(`9. 国际化识别: 已启用；线索=${hints.length ? hints.join('，') : '语言文件/目录命中'}`);
  for (const item of (trace.definitions || []).slice(0, 4)) {
    lines.push(`   国际化文案: ${item.file}；key=${item.keyPath}；text=${item.phrase}`);
  }
  for (const item of (trace.usages || []).slice(0, 4)) {
    lines.push(`   国际化使用: ${item.file}；key=${item.i18nKey || item.keyPath || '-'}；来源=${item.i18nDefinitionFile || item.from || '-'}`);
  }
  return lines;
}

function definitionTraceLogLines(definitionTrace) {
  const trace = definitionTrace?.value;
  if (!trace || !trace.active) return [];
  const lines = ['10. 字面量定义链: 已启用'];
  for (const item of (trace.definitions || []).slice(0, 4)) {
    lines.push(`   定义文案: ${item.file}；symbol=${item.symbol || '-'}；key=${item.keyPath || '-'}；text=${item.phrase}`);
  }
  for (const item of (trace.usages || []).slice(0, 4)) {
    lines.push(`   定义使用: ${item.file}；symbol=${item.definitionSymbol || '-'}；key=${item.definitionKeyPath || '-'}；来源=${item.definitionFile || item.from || '-'}`);
  }
  return lines;
}

function apiTraceLogLines(apiTrace) {
  const trace = apiTrace?.value;
  if (!trace || !Array.isArray(trace.endpoints) || !trace.endpoints.length) return [];
  const lines = [];
  for (const endpoint of trace.endpoints.slice(0, 4)) {
    const endpointLabel = [endpoint.method, endpoint.path].filter(Boolean).join(' ') || endpoint.path || endpoint.url || '-';
    const names = (endpoint.symbols || []).slice(0, 6).join(', ') || '-';
    lines.push(`8. 接口识别: ${endpointLabel}；接口名=${names}`);
    for (const file of endpoint.files || []) {
      lines.push(`   接口文件: ${file.file}${file.symbols?.length ? `；符号=${file.symbols.join(', ')}` : ''}`);
    }
    for (const chain of endpoint.chains || []) {
      lines.push(`   接口引用链: ${chain.chain.join(' -> ')}${chain.symbol ? `；引用=${chain.symbol}` : ''}`);
    }
  }
  return lines;
}

function routeResolverLogLines({ routeResolverTrace, pageUrlPath, project }) {
  const trace = routeResolverTrace?.value;
  const tracePath = String(trace?.pagePath || '').trim();
  const isStaleTrace = !!tracePath && tracePath !== pageUrlPath.value;
  if (!trace || isStaleTrace) {
    return [
      `2. 页面路由适配: ${isStaleTrace ? `旧结果已忽略(${tracePath})` : '未执行或本地服务未返回结果'}；projectKind=${project.value?.kind || 'unknown'}；pagePath=${pageUrlPath.value}`
    ];
  }

  const adapters = trace.adapters && trace.adapters.length ? trace.adapters.join(', ') : '-';
  const status = trace.matched ? `命中 ${trace.hits.length} 个文件` : '未命中';
  const lines = [
    `2. 页面路由适配: ${status}；projectKind=${trace.projectKind || project.value?.kind || 'unknown'}；pagePath=${trace.pagePath || pageUrlPath.value}；adapters=${adapters}`
  ];

  if (trace.matched) {
    for (const [index, hit] of (trace.hits || []).slice(0, 5).entries()) {
      lines.push(`   路由命中 ${index + 1}: ${hit.file}；adapter=${hit.adapter || '-'}；routePath=${hit.routePath || '-'}；score=${hit.score}`);
      const reason = (hit.reasons || []).find(item => item && !item.startsWith('路由适配器'));
      if (reason) lines.push(`   路由依据 ${index + 1}: ${reason}`);
    }
  } else {
    lines.push('   路由结果: 当前页面 path 没有通过路由表或文件系统路由定位到页面文件，继续走文案/className/API 检索。');
  }

  if (trace.errors && trace.errors.length) {
    lines.push(`   路由适配异常: ${trace.errors.slice(0, 3).join('；')}`);
  }
  return lines;
}
