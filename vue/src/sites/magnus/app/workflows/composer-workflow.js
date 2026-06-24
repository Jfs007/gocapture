import { sourceServerJson } from '../../services/source-service';

export function createComposerWorkflow({
  source,
  route,
  search,
  selection,
  composer,
  model,
  prompt,
  toast
}) {
  async function sendComposer() {
    if (model.modelAssistLoading.value) {
      model.stopModelAssist();
      return;
    }
    if (!source.project.value) return;
    const instruction = composer.promptIntent.value.trim();
    if (!instruction) return;
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

      const timeoutMs = search.includeApiEvidence.value ? 30000 : 12000;
      const data = await runSearchWithOptionalRetry(timeoutMs);
      search.candidateHits.value = Array.isArray(data.hits) ? data.hits : [];
      route.applyRouteResolverTrace(data.routeResolver || null);
      search.apiTrace.value = data.apiTrace || null;
      search.i18nTrace.value = data.i18nTrace || null;
      search.definitionTrace.value = data.definitionTrace || null;

      if (!search.candidateHits.value.length) {
        search.selectedCandidatePaths.value = [];
        search.candidateError.value = '未找到候选文件。可以继续补充选区，或在输入框里补充更具体的修改要求后重试。';
      } else {
        search.selectedCandidatePaths.value = [search.candidateHits.value[0].file];
        search.expandedCandidatePath.value = '';
        toast.setToast(`找到 ${search.candidateHits.value.length} 个候选文件`);
      }

      if (shouldAutoRunModelAssist(search.candidateHits.value)) {
        const modelHandled = await runModelAssistForCandidates(composer.promptIntent.value.trim());
        if (modelHandled) return model.modelAssistResult.value?.stopped ? [] : search.candidateHits.value;
      }
      return search.candidateHits.value;
    } catch (error) {
      search.selectedCandidatePaths.value = [];
      search.candidateError.value = `${error.message || error}。`;
      return [];
    } finally {
      search.candidateLoading.value = false;
    }
  }

  async function runSearchWithOptionalRetry(timeoutMs) {
    try {
      const firstPass = await runSearchRequest(prompt.searchPayload(), timeoutMs);
      const firstHits = Array.isArray(firstPass?.hits) ? firstPass.hits : [];
      if (!shouldRetryExpandedSearch(firstHits)) return firstPass;
      const secondPass = await runSearchRequest(prompt.searchPayload({ expandedRetry: true }), timeoutMs);
      const secondHits = Array.isArray(secondPass?.hits) ? secondPass.hits : [];
      return isBetterSearchResult(secondHits, firstHits) ? secondPass : firstPass;
    } finally {
      search.searchFinishedAt.value = Date.now();
      search.searchRunning.value = false;
    }
  }

  async function runSearchRequest(body, timeoutMs) {
    return await sourceServerJson('/api/search', {
      method: 'POST',
      body,
      timeoutMs,
      timeoutMessage: search.includeApiEvidence.value
        ? '接口调用链追踪超过 30 秒，请减少捕获接口或补充关键词后重试'
        : '源码检索超过 12 秒，请补充关键词后重试'
    });
  }

  async function runModelAssistForCandidates(userInstruction) {
    if (!search.candidateHits.value.length) return false;
    search.modelAssistAttempted.value = true;
    if (!model.useModelAssist.value || !model.canUseModelAssist.value) {
      const text = modelAssistUnavailableText();
      search.candidateError.value = text;
      toast.setToast(text);
      return true;
    }
    const modelResult = await model.runModelAssist();
    if (modelResult?.stopped) return true;
    if (hasUsableModelResult(modelResult)) {
      selection.filesConfirmed.value = true;
      prompt.generatePrompt({ userInstruction });
      return true;
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

  return {
    sendComposer,
    searchCandidateFiles,
    runModelAssistForCandidates
  };
}

function hasUsableModelResult(result) {
  return (result?.modelItems || result?.targetFiles || []).some(item => {
    return item && item.exists !== false && (item.path || item.file);
  });
}

function shouldAutoRunModelAssist(hits) {
  const list = Array.isArray(hits) ? hits : [];
  return list.length > 0;
}

function hasStrongSearchEvidence(hits) {
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

function shouldRetryExpandedSearch(hits) {
  const list = Array.isArray(hits) ? hits : [];
  if (list.length < 2) return false;
  if (hasStrongSearchEvidence(list)) return false;
  if (list.length >= 6) return true;
  const exactLikeHits = list.filter(hit => hit?.exactMatchText || hit?.uniqueMatchText).length;
  return exactLikeHits <= 1;
}

function isBetterSearchResult(nextHits, currentHits) {
  const next = Array.isArray(nextHits) ? nextHits : [];
  const current = Array.isArray(currentHits) ? currentHits : [];
  if (!next.length) return false;
  const nextStrong = hasStrongSearchEvidence(next);
  const currentStrong = hasStrongSearchEvidence(current);
  if (nextStrong !== currentStrong) return nextStrong;
  if (next.length !== current.length) return next.length < current.length;
  return Number(next[0]?.score || 0) > Number(current[0]?.score || 0);
}
