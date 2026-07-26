import { sourceServerNdjson } from '../services/source-service';
import {
  candidateHitsFromBindings,
  sourceTargetsFromCandidates
} from '../services/selection-source-context';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import { runConnectAgentTask } from '../services/connect-agent.service';
import type { MagnusRuntimeState } from '../runtime/context';
import type { SelectionSourceBinding } from '../types/selection.types';

const MAX_AUTO_EXPAND_ATTEMPTS = 5;

export function createComposerWorkflow(state: MagnusRuntimeState) {
  const { source, route, search, selection, composer, model, prompt } = state;
  const appUiStore = useAppUiStore();
  const connectAgentStore = useConnectAgentStore();

  // 原始选区 DOM 身份的快照（扩区前抓取，全程保留）。用于把「用户到底选了什么」传给变更计划 LLM——
  // 否则扩区后 selectedItems 变成整行、¥3 这类无锚点选区身份就彻底丢了，LLM 只能在区域里瞎猜。
  let lastOriginSelections: any[] = [];
  // 从祖先链提取「稳定容器标识」，说明选区落在哪（如所在列 data-col-key=cost → 源码列配置 key:'cost'）。
  // 通用机制：任何祖先上形如业务标识符的 data-*/id/name 值都算，排除运行时/框架内部值。
  function ancestorContainerAnchors(el: any): string[] {
    const out: string[] = [];
    for (const ancestor of (Array.isArray(el?.ancestors) ? el.ancestors.slice(0, 5) : [])) {
      for (const [key, rawValue] of Object.entries(ancestor?.attrs || {})) {
        const k = String(key || '').toLowerCase();
        if ((!/^data-/.test(k) && k !== 'id' && k !== 'name') || /^data-v-/.test(k)) continue;
        const value = String(rawValue || '').trim();
        if (/^[A-Za-z][\w-]{1,39}$/.test(value) && !/^__.*__$/.test(value) && !/^\d+$/.test(value)) {
          out.push(`${key}=${value}`);
        }
      }
      for (const cls of String(ancestor?.className || '').split(/\s+/)) {
        const t = cls.trim();
        if (t && !/^(n-|el-|ivu-|ant-|van-|flex|grid|is-|has-|mt-|mb-|ml-|mr-|w-|h-|p-|m-)/.test(t)) out.push(t);
      }
    }
    return Array.from(new Set(out)).slice(0, 6);
  }
  function captureOriginSelections(): any[] {
    try {
      const assets = prompt.promptAssetItems?.() || [];
      const items = selection.selectedItems?.value || [];
      return assets.map((asset: any, index: number) => ({
        token: asset.token,
        tag: asset.tag,
        text: asset.text,
        className: asset.className,
        attrs: asset.attrs,
        ancestors: asset.ancestors,
        container: ancestorContainerAnchors(items[index]?.element),   // 选区所在容器/列的标识
        summary: asset.summary
      }));
    } catch {
      return [];
    }
  }

  async function sendComposer() {
    if (connectAgentStore.taskRunning) {
      connectAgentStore.cancelTask();
      return;
    }
    if (model.modelAssistLoading.value) {
      model.stopModelAssist();
      return;
    }
    if (!source.project.value) return;
    const instruction = composer.promptIntent.value.trim();
    if (!instruction) return;
    if (!connectAgentStore.activeProvider?.connected) {
      appUiStore.setToast('请先关联 Codex 开发 Agent');
      return;
    }
    if (await reuseSelectionSourceContext(instruction)) return;
    if (search.showCandidatePicker.value) {
      await runModelAssistForCandidates(instruction);
      return;
    }
    if (!selection.confirmSelectionContext(composer.invalidatePrompt)) return;
    if (!model.selectedModel.value) {
      await runConnectedAgentFromLocalEvidence(instruction);
      return;
    }
    await searchCandidateFiles();
  }

  async function runConnectedAgentFromLocalEvidence(instruction: string) {
    lastOriginSelections = captureOriginSelections();
    search.clearCandidateState?.();
    search.processLogs.value = [
      'Locator 专用模型未配置：跳过 Magnus Locator Agent',
      '先整理路由、压缩 DOM 和已捕获页面事实，再交给关联 Agent'
    ];
    search.searchStartedAt.value = Date.now();
    search.searchFinishedAt.value = 0;
    connectAgentStore.resetTask();
    await runConnectedAgent(instruction, [], {
      searchPayload: prompt.searchPayload()
    });
    search.searchFinishedAt.value = Date.now();
  }

  async function searchCandidateFiles() {
    search.candidateLoading.value = true;
    search.candidateError.value = '';
    search.serverNeedsMoreEvidence.value = false;
    search.modelAssistAttempted.value = false;
    model.resetModelAssist();
    selection.filesConfirmed.value = false;
    try {
      if (!route.sameRouteTracePage(route.routeResolverTrace.value)) {
        await route.resolveCurrentPageRoute();
      }

      search.searchRunning.value = true;
      search.searchStartedAt.value = Date.now();
      search.searchFinishedAt.value = 0;
      search.processLogs.value = [];
      search.agentUsed.value = false;
      connectAgentStore.resetTask();

      const timeoutMs = search.includeApiEvidence.value ? 30000 : 12000;
      const data = await runSearchWithOptionalRetry(timeoutMs);
      search.candidateHits.value = Array.isArray(data.hits) ? data.hits : [];
      search.compositeResult.value = data.composite || null;
      route.applyRouteResolverTrace(data.routeResolver || null);
      search.apiTrace.value = data.apiTrace || null;
      search.i18nTrace.value = data.i18nTrace || null;
      search.definitionTrace.value = data.definitionTrace || null;
      search.serverNeedsMoreEvidence.value = !!(data.needsMoreEvidence || data.needMoreDom || data.agent?.needMoreDom);

      if (!search.candidateHits.value.length) {
        search.selectedCandidatePaths.value = [];
        if (search.serverNeedsMoreEvidence.value) {
          search.candidateError.value = '自动扩区后仍证据不足，未能定位源码。';
        } else {
          search.candidateError.value = '未找到候选文件。可以继续补充选区，或在输入框里补充更具体的修改要求后重试。';
        }
      } else {
        search.selectedCandidatePaths.value = [search.candidateHits.value[0].file];
        search.expandedCandidatePath.value = '';
        appUiStore.setToast(`找到 ${search.candidateHits.value.length} 个候选文件`);
      }

      // DOM Agent 已经在内部用模型完成定位并收敛，就不再走老的「模型定位/model-assist」那一步
      //（那是没有 agent 之前用来从候选里挑文件、读源码发给模型的流程，现已完全冗余）。
      if (data.agent?.enabled && search.candidateHits.value.length) {
        const instruction = composer.promptIntent.value.trim();
        const resolvedComposite = data.agent?.status === 'resolved' && !!data.composite?.render;
        if (resolvedComposite) {
          // DOM Agent 已定位并收敛：不再重复定位，直接进入「变更规划」——
          // files 是一个已确认的协作组合，不是需要用户互斥选择的多个答案。
          search.selectedCandidatePaths.value = search.candidateHits.value.map((hit: any) => hit.file);
          selection.filesConfirmed.value = true;
          bindResolvedSelectionContext(instruction, data);
          await runChangePlanForResolved(instruction);
        }
        // Agent 未 resolved 时才保留候选选择器，不把协作组合降级成“多个候选待确认”。
        return search.candidateHits.value;
      }

      if (shouldAutoRunModelAssist(search.candidateHits.value)) {
        const modelHandled = await runModelAssistForCandidates(composer.promptIntent.value.trim());
        if (modelHandled) return model.modelAssistResult.value?.stopped ? [] : search.candidateHits.value;
      }
      return search.candidateHits.value;
    } catch (error: any) {
      search.selectedCandidatePaths.value = [];
      search.candidateError.value = `${error.message || error}。`;
      return [];
    } finally {
      search.candidateLoading.value = false;
    }
  }

  // 直接从「当前选区 DOM」提取原始选区的稳定锚点——不依赖 Planner 是否成计划。
  // 因为像 ¥3/查看/cost 这种，Planner 常判为 need-more-context（无计划），若从计划取就永远丢了。
  // 用途：① 扩区收敛后回到用户最初选的那处做细定位；② 校验最终文件是否真的与原始选区有渲染/引用关系。
  function originAnchorsFromSelection(): string[] {
    const items = selection.selectedItems?.value || [];
    const latest: any = items[items.length - 1];
    const el: any = latest?.element || latest?.info || {};
    const anchors: string[] = [];
    const markup = String(el.rawOuterHtml || el.outerHtml || '');
    for (const match of markup.matchAll(/\bdata-(?!v-)[\w-]+="([^"]{2,})"/g)) {
      const value = String(match[1] || '').trim();
      if (value && !/^__.*__$/.test(value) && !/^[\d.]+$/.test(value)) anchors.push(value);
    }
    for (const word of String(el.text || '').split(/\s+/)) {
      const token = word.trim();
      if (token.length >= 2 && token.length <= 12
        && !/^[¥$]?[\d.,:：/%\-]+$/.test(token) && !/^ID[:：]/i.test(token)) anchors.push(token);
    }
    for (const cls of String(el.className || '').split(/\s+/)) {
      const token = cls.trim();
      if (token && !/^(n-|el-|ivu-|ant-|van-|flex|grid|is-|has-|mt-|mb-|ml-|mr-|w-|h-|p-|m-)/.test(token)) anchors.push(token);
    }
    return Array.from(new Set(anchors)).slice(0, 6);
  }

  async function runSearchWithOptionalRetry(timeoutMs: number) {
    try {
      // 原始选区锚点 = 用户「最初选中」那个元素的锚点，只在扩区前(轮1)抓取一次，全程保持。
      // 绝不能在扩区后重抓：扩区后的选区已包含兄弟/父级节点，重抓会把兄弟(如与 ¥3 并排的「查看」)
      // 误当成原始选区锚点，导致细定位把选区钉到一个用户没选的相邻元素上。
      // 轮1为空(原始选区本就没有字面锚点，如纯运行时数值)时就保持空——这是「本地无法确定」的诚实信号，
      // 交给带原始选区 DOM 快照的变更计划去做结构对齐。
      const focusAnchors = originAnchorsFromSelection();
      lastOriginSelections = captureOriginSelections();   // 扩区前快照原始选区 DOM 身份
      let firstPass = await runSearchRequest(prompt.searchPayload(), timeoutMs, '第 1 轮：原始选区检索');
      for (let attempt = 1; attempt <= MAX_AUTO_EXPAND_ATTEMPTS && shouldAutoExpandSearch(firstPass); attempt += 1) {
        const expanded = await expandLatestSelectionForMoreEvidence(attempt);
        if (!expanded) break;
        const retryState: any = buildAgentRetryState(firstPass, attempt);
        if (focusAnchors.length) retryState.focusAnchors = focusAnchors;
        firstPass = await runSearchRequest(prompt.searchPayload({
          agentState: retryState
        }), timeoutMs, `第 ${attempt + 1} 轮：自动扩区后继续检索`);
      }
      const firstHits = Array.isArray(firstPass?.hits) ? firstPass.hits : [];
      if (firstPass?.agent?.enabled) return firstPass;
      if (!shouldRetryExpandedSearch(firstHits)) return firstPass;
      const secondPass = await runSearchRequest(prompt.searchPayload({ expandedRetry: true }), timeoutMs, '扩展上下文兜底检索');
      const secondHits = Array.isArray(secondPass?.hits) ? secondPass.hits : [];
      return isBetterSearchResult(secondHits, firstHits) ? secondPass : firstPass;
    } finally {
      search.searchFinishedAt.value = Date.now();
      search.searchRunning.value = false;
    }
  }

  // DOM Agent 定位收敛后启动唯一的 LangChain Planning Agent；Recon/Experience/Skills/MCP 均由 Agent 按需选用。
  async function runChangePlanForResolved(instruction: string) {
    const bindings = selection.reusableSourceBindings(instruction, projectRoot());
    if (!bindings.length) {
      prompt.generatePrompt({ userInstruction: instruction });
      return;
    }
    if (await runConnectedAgent(instruction, bindings)) return;
    // 模型不可用：退回纯文本提示词，不产出结构化计划。
    if (!model.useModelAssist.value || !model.canUseModelAssist.value) {
      prompt.generatePrompt({ userInstruction: instruction });
      return;
    }
    search.modelAssistAttempted.value = true;
    const modelResult: any = await model.runSelectionContextAssist({ userInstruction: instruction, selectionBindings: bindings });
    if (modelResult?.stopped) return;
    search.changePlanResult.value = modelResult?.changePlan
      || (search.candidateHits.value[0] as any)?.modelChangePlan
      || null;
    prompt.generatePrompt({ userInstruction: instruction });
  }

  async function runSearchRequest(body: unknown, timeoutMs: number, label = '') {
    if (label) search.appendProcessLog(`检索请求开始：${label}`);
    return await sourceServerNdjson('/api/search/stream', {
      method: 'POST',
      body: {
        ...(body as Record<string, unknown>),
        projectRoot: projectRoot(),
        adapter: model.selectedModel.value || null
      },
      timeoutMs: Math.max(timeoutMs, Number(model.selectedModel.value?.timeoutMs || 120000) * 2 + 5000),
      timeoutMessage: search.includeApiEvidence.value
        ? '源码检索超时，请确认项目源码目录是否选错，或减少捕获接口/补充关键词后重试'
        : '源码检索超时，请确认项目源码目录是否选错，或补充关键词后重试',
      onEvent(event) {
        if (event.type === 'log' && event.log) {
          search.appendProcessLog(event.log);
          if (String(event.log).startsWith('DOM Agent 触发判断：启用')) {
            search.agentUsed.value = true;
          }
        }
      }
    });
  }

  async function runModelAssistForCandidates(userInstruction: string) {
    if (!search.candidateHits.value.length) return false;
    search.modelAssistAttempted.value = true;
    if (!model.useModelAssist.value || !model.canUseModelAssist.value) {
      const text = modelAssistUnavailableText();
      search.candidateError.value = text;
      appUiStore.setToast(text);
      return true;
    }
    const modelResult = await model.runModelAssist();
    if (modelResult?.stopped) return true;
    if (hasUsableModelResult(modelResult)) {
      selection.filesConfirmed.value = true;
      bindResolvedSelectionContext(userInstruction);
      prompt.generatePrompt({ userInstruction });
      return true;
    }
    return false;
  }

  async function expandLatestSelectionForMoreEvidence(attempt: number) {
    const before = latestSelectionSnapshot();
    const items = selection.selectedItems?.value || [];
    const latest = items[items.length - 1];
    const uid = latest?.uid || '';
    if (!uid || typeof selection.expandSelection !== 'function') return false;
    search.appendProcessLog?.(`证据不足：自动扩大当前选区 ${uid}（第 ${attempt} 次）`);
    await selection.expandSelection(uid);
    const changed = await waitForSelectionSnapshotChange(before);
    if (changed) {
      search.appendProcessLog?.('自动扩区完成：选区对象已更新，继续检索');
      appUiStore.setToast('已自动扩大当前选区并继续检索');
      return true;
    }
    search.appendProcessLog?.('自动扩区停止：未检测到选区变化');
    return false;
  }

  function latestSelectionSnapshot() {
    return latestSelectionSnapshotFromItems(selection.selectedItems?.value || []);
  }

  async function waitForSelectionSnapshotChange(before: { uid: string; signature: string }) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 1500) {
      await sleep(80);
      const current = latestSelectionSnapshot();
      if (current.uid && current.uid === before.uid && current.signature && current.signature !== before.signature) {
        return true;
      }
    }
    return false;
  }

  function modelAssistUnavailableText() {
    if (!model.selectedModel.value) return '模型定位未启用：请先在输入框模型菜单里选择或配置模型。';
    if (!source.project.value || source.project.value.source !== 'source-server') {
      return '模型定位不可用：请通过本地源码服务重新关联项目，模型需要读取真实源码文件。';
    }
    return '模型定位不可用：请检查模型配置。';
  }

  function projectRoot() {
    return String(source.project.value?.path || source.project.value?.root || '').trim();
  }

  function bindResolvedSelectionContext(userInstruction: string, searchResult: any = null) {
    const ids = selection.referencedSelectionIds(userInstruction);
    if (ids.length !== 1) return;
    const selected = search.selectedCandidateHits.value.length
      ? search.selectedCandidateHits.value
      : search.candidateHits.value.slice(0, 1);
    const targets = sourceTargetsFromCandidates(selected);
    const root = projectRoot();
    if (!root || !targets.length) return;
    selection.bindSourceContext(ids, {
      projectRoot: root,
      designRequirement: userInstruction,
      targets,
      investigation: sourceInvestigationFromResult(searchResult),
      originSelections: lastOriginSelections,
      resolvedAt: Date.now()
    } satisfies SelectionSourceBinding);
    search.appendProcessLog(`选区源码上下文已绑定：${ids[0]} -> ${targets.map(target => target.file).join('、')}`);
  }

  function sourceInvestigationFromResult(result: any) {
    const locator = result?.agent?.locator || result?.agent || null;
    if (!locator || locator.status !== 'resolved') return null;
    return {
      status: 'resolved',
      reason: String(locator.reason || ''),
      coveredDom: Array.isArray(locator.coveredDom) ? locator.coveredDom.map(String) : [],
      missingEvidence: Array.isArray(locator.missingEvidence) ? locator.missingEvidence.map(String) : [],
      relations: (Array.isArray(locator.relations) ? locator.relations : []).map((relation: any) => ({
        from: String(relation?.from || ''),
        to: String(relation?.to || ''),
        type: String(relation?.type || 'related'),
        evidence: String(relation?.evidence || '')
      })).filter((relation: any) => relation.from && relation.to)
    };
  }

  async function reuseSelectionSourceContext(userInstruction: string) {
    const bindings = selection.reusableSourceBindings(userInstruction, projectRoot());
    if (!bindings.length) return false;
    search.candidateHits.value = candidateHitsFromBindings(bindings);
    if (!search.candidateHits.value.length) return false;
    search.selectedCandidatePaths.value = search.candidateHits.value.map((hit: any) => hit.file);
    search.candidateError.value = '';
    search.processLogs.value = [
      `复用选区源码上下文：${bindings.map((item: any) => item.uid).join('、')}`,
      '已跳过 DOM Agent、本地源码检索和源码定位模型'
    ];
    search.searchRunning.value = false;
    search.candidateLoading.value = false;
    search.searchStartedAt.value = Date.now();
    search.searchFinishedAt.value = 0;
    search.modelAssistAttempted.value = true;
    selection.filesConfirmed.value = false;
    if (await runConnectedAgent(userInstruction, bindings)) {
      search.searchFinishedAt.value = Date.now();
      selection.filesConfirmed.value = true;
      return true;
    }
    if (!model.useModelAssist.value || !model.canUseModelAssist.value) {
      const text = modelAssistUnavailableText();
      search.candidateError.value = text;
      search.searchFinishedAt.value = Date.now();
      appUiStore.setToast(text);
      return true;
    }
    const modelResult = await model.runSelectionContextAssist({
      userInstruction,
      selectionBindings: bindings
    });
    search.searchFinishedAt.value = Date.now();
    if (modelResult?.stopped) return true;
    if (hasUsableModelResult(modelResult)) {
      selection.filesConfirmed.value = true;
      prompt.generatePrompt({ userInstruction });
      appUiStore.setToast('已复用选区源码上下文并完成模型增强');
      return true;
    }
    search.candidateError.value = model.modelAssistError.value || '选区源码上下文增强失败，请重试。';
    return true;
  }

  async function runConnectedAgent(
    userInstruction: string,
    bindings: any[],
    options: { searchPayload?: Record<string, unknown> } = {}
  ) {
    const provider = connectAgentStore.activeProvider;
    if (!provider?.connected) return false;
    const controller = new AbortController();
    connectAgentStore.beginTask(controller);
    selection.filesConfirmed.value = bindings.length > 0;
    search.appendProcessLog(bindings.length
      ? `Connect Agent 分流：DOM Locator 已完成，交给 ${provider.name}`
      : `Connect Agent 分流：本地事实准备完成后，由 ${provider.name} 自行定位并开发`);
    try {
      const result = await runConnectAgentTask(provider.id, {
        projectRoot: projectRoot(),
        pageUrl: state.currentPageHref.value,
        userInstruction,
        selectionBindings: bindings,
        searchPayload: options.searchPayload || null
      }, {
        controller,
        onEvent: event => {
          connectAgentStore.applyTaskEvent(event);
          if (event?.type === 'locator-evidence' && event.evidence?.route) {
            route.applyRouteResolverTrace({
              pagePath: event.evidence.route.pagePath,
              matched: event.evidence.route.matched,
              bestPageFile: event.evidence.route.bestPageFile,
              hits: event.evidence.route.hits
            });
          }
        }
      });
      connectAgentStore.completeTask(result);
      selection.bindAgentMeanings({
        meanings: result.selectionMeanings || [],
        providerId: provider.id,
        threadId: result.threadId,
        projectRoot: projectRoot(),
        designRequirement: userInstruction,
        changedFiles: result.changedFiles || []
      });
      appUiStore.setToast(`${provider.name} 已完成开发任务`);
    } catch (error) {
      connectAgentStore.failTask(error);
      appUiStore.setToast((error as Error)?.message || `${provider.name} 开发任务失败`);
    }
    return true;
  }

  return {
    sendComposer,
    searchCandidateFiles,
    runModelAssistForCandidates
  };
}

// 从一次检索结果里取「原始选区的稳定锚点」候选（用于扩区全程保持的 focusAnchors）。
function buildAgentRetryState(previousResult: any, attempt: number) {
  const agent = previousResult?.agent || {};
  const inspectionCandidates = Array.isArray(agent?.inspection?.candidates)
    ? agent.inspection.candidates
    : [];
  return {
    expansionRetry: true,
    expansionRoundsUsed: attempt,
    previousPlan: agent?.plan || null,
    previousCandidates: inspectionCandidates.slice(0, 8).map((item: any) => ({
      file: item?.file || '',
      score: item?.score || 0,
      matchedGroups: Array.isArray(item?.matchedGroups)
        ? item.matchedGroups.map((group: any) => ({
          keywords: Array.isArray(group?.keywords) ? group.keywords : [],
          source: group?.source || '',
          range: group?.range || ''
        }))
        : []
    })),
    previousReason: agent?.evidence?.reason || ''
  };
}

function shouldAutoExpandSearch(result: any) {
  const hits = Array.isArray(result?.hits) ? result.hits : [];
  if (hits.length) return false;
  return !!(result?.needsMoreEvidence || result?.needMoreDom || result?.agent?.needMoreDom);
}

function latestSelectionSnapshotFromItems(items: any[]) {
  const latest = items[items.length - 1];
  if (!latest?.uid) return { uid: '', signature: '' };
  const info = latest.info || latest.element || {};
  const asset = latest.assetInfo || latest.asset || {};
  return {
    uid: latest.uid,
    signature: JSON.stringify([
      info.tag || info.tagName || '',
      info.selector || '',
      info.className || '',
      info.text || '',
      info.searchText || '',
      info.outerHtml || info.rawOuterHtml || '',
      asset.selector || '',
      asset.className || '',
      asset.text || '',
      asset.outerHtml || asset.rawOuterHtml || ''
    ]).slice(0, 20000)
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hasUsableModelResult(result: any) {
  return (result?.modelItems || result?.targetFiles || []).some((item: any) => {
    return item && item.exists !== false && (item.path || item.file);
  });
}

function shouldAutoRunModelAssist(hits: any[]) {
  const list = Array.isArray(hits) ? hits : [];
  return list.length > 0;
}

function hasStrongSearchEvidence(hits: any[]) {
  const list = Array.isArray(hits) ? hits : [];
  return list.some(hit => {
    if (!hit) return false;
    if (hit.preciseEvidence || hit.uniqueMatchText || hit.uniqueSnippet) return true;
    if (Number(hit.exactMatchCount || 0) === 1 && Number(hit.contextScore || 0) >= 18) return true;
    if (Number(hit.contextStrongMatchCount || 0) >= 2) return true;
    if (Number(hit.contextScore || 0) >= 32 && (hit.contextReasons || []).length >= 2) return true;
    return false;
  });
}

function shouldRetryExpandedSearch(hits: any[]) {
  const list = Array.isArray(hits) ? hits : [];
  if (list.length < 2) return false;
  if (hasStrongSearchEvidence(list)) return false;
  if (list.length >= 6) return true;
  const exactLikeHits = list.filter(hit => hit?.exactMatchText || hit?.uniqueMatchText).length;
  return exactLikeHits <= 1;
}

function isBetterSearchResult(nextHits: any[], currentHits: any[]) {
  const next = Array.isArray(nextHits) ? nextHits : [];
  const current = Array.isArray(currentHits) ? currentHits : [];
  if (!next.length) return false;
  const nextStrong = hasStrongSearchEvidence(next);
  const currentStrong = hasStrongSearchEvidence(current);
  if (nextStrong !== currentStrong) return nextStrong;
  if (next.length !== current.length) return next.length < current.length;
  return Number(next[0]?.score || 0) > Number(current[0]?.score || 0);
}
