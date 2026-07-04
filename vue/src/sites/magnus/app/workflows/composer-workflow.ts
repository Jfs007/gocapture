import { sourceServerNdjson } from '../services/source-service';
import {
  candidateHitsFromBindings,
  sourceTargetsFromCandidates
} from '../services/selection-source-context';
import { useAppUiStore } from '../../stores/app-ui.store';
import type { MagnusRuntimeState } from '../runtime/context';
import type { SelectionSourceBinding } from '../types/selection.types';

const MAX_AUTO_EXPAND_ATTEMPTS = 3;

export function createComposerWorkflow(state: MagnusRuntimeState) {
  const { source, route, search, selection, composer, model, prompt } = state;
  const appUiStore = useAppUiStore();

  async function sendComposer() {
    if (model.modelAssistLoading.value) {
      model.stopModelAssist();
      return;
    }
    if (!source.project.value) return;
    const instruction = composer.promptIntent.value.trim();
    if (!instruction) return;
    if (await reuseSelectionSourceContext(instruction)) return;
    if (search.showCandidatePicker.value) {
      await runModelAssistForCandidates(instruction);
      return;
    }
    if (!selection.confirmSelectionContext(composer.invalidatePrompt)) return;
    await searchCandidateFiles();
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

  async function runSearchWithOptionalRetry(timeoutMs: number) {
    try {
      let firstPass = await runSearchRequest(prompt.searchPayload(), timeoutMs, '第 1 轮：原始选区检索');
      for (let attempt = 1; attempt <= MAX_AUTO_EXPAND_ATTEMPTS && shouldAutoExpandSearch(firstPass); attempt += 1) {
        const expanded = await expandLatestSelectionForMoreEvidence(attempt);
        if (!expanded) break;
        firstPass = await runSearchRequest(prompt.searchPayload({
          agentState: buildAgentRetryState(firstPass, attempt)
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

  async function runSearchRequest(body: unknown, timeoutMs: number, label = '') {
    if (label) search.appendProcessLog(`检索请求开始：${label}`);
    return await sourceServerNdjson('/api/search/stream', {
      method: 'POST',
      body: {
        ...(body as Record<string, unknown>),
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

  function bindResolvedSelectionContext(userInstruction: string) {
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
      resolvedAt: Date.now()
    } satisfies SelectionSourceBinding);
    search.appendProcessLog(`选区源码上下文已绑定：${ids[0]} -> ${targets.map(target => target.file).join('、')}`);
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

  return {
    sendComposer,
    searchCandidateFiles,
    runModelAssistForCandidates
  };
}

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
