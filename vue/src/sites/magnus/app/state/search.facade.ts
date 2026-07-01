import { computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useComposerStore } from '../../stores/composer.store';
import { useModelStore } from '../../stores/model.store';
import { useRequestStore } from '../../stores/request.store';
import { useRouteStore } from '../../stores/route.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';

export function useSearchFacade() {
  const composerStore = useComposerStore();
  const modelStore = useModelStore();
  const requestStore = useRequestStore();
  const routeStore = useRouteStore();
  const searchStore = useSearchStore();
  const selectionStore = useSelectionStore();
  const {
    candidates: candidateHits,
    apiTrace,
    i18nTrace,
    definitionTrace,
    candidateLoading,
    searchRunning,
    error: candidateError,
    startedAt: searchStartedAt,
    finishedAt: searchFinishedAt,
    includeApiEvidence,
    selectedCandidatePaths,
    expandedCandidatePath,
    modelAssistAttempted,
    keywords: searchKeywords,
    processLogs,
    agentUsed,
    serverNeedsMoreEvidence
  } = storeToRefs(searchStore);
  const { resolverTrace: routeResolverTrace } = storeToRefs(routeStore);
  const { recent: recentRequests } = storeToRefs(requestStore);
  const { filesConfirmed } = storeToRefs(selectionStore);
  const modelAssistLoading = computed(() => modelStore.status === 'running');

  const searchApiRequests = computed(() => includeApiEvidence.value ? recentRequests.value.slice(0, 5) : []);
  const selectedCandidateHits = computed(() => {
    const selected = new Set(selectedCandidatePaths.value);
    return candidateHits.value.filter(hit => selected.has(hit.file));
  });
  const routeResolverMatched = computed(() => !!routeResolverTrace.value?.matched);
  const hasReliableCandidateEvidence = computed(() => {
    return routeResolverMatched.value || candidateHits.value.some(hit => {
      return hit.stage === 'model-agent' || hit.preciseEvidence;
    });
  });
  const localNeedsMoreEvidence = computed(() => {
    if (serverNeedsMoreEvidence.value) return true;
    return candidateHits.value.length > 1 && !filesConfirmed.value && !hasReliableCandidateEvidence.value;
  });
  const needsMoreEvidence = computed(() => localNeedsMoreEvidence.value && !modelAssistLoading.value && !modelAssistAttempted.value);
  const showCandidatePicker = computed(() => {
    return candidateHits.value.length > 1 && !filesConfirmed.value && !localNeedsMoreEvidence.value && !modelAssistLoading.value;
  });

  watch([candidateLoading, searchRunning, candidateError, candidateHits], ([loading, running, error]) => {
    if (error) searchStore.status = 'error';
    else if (loading || running) searchStore.status = 'loading';
    else if (candidateHits.value.length) searchStore.status = 'success';
    else searchStore.status = 'idle';
  }, { immediate: true, deep: true });

  watch([showCandidatePicker, needsMoreEvidence], ([showPicker, needsEvidence]) => {
    searchStore.showCandidatePicker = !!showPicker;
    searchStore.needsMoreEvidence = !!needsEvidence;
  }, { immediate: true });

  function invalidateCandidateConfirm() {
    selectionStore.filesConfirmed = false;
    composerStore.setFinalPrompt('');
  }

  function clearCandidateState() {
    candidateHits.value = [];
    candidateError.value = '';
    searchRunning.value = false;
    candidateLoading.value = false;
    searchStartedAt.value = 0;
    searchFinishedAt.value = 0;
    selectedCandidatePaths.value = [];
    expandedCandidatePath.value = '';
    selectionStore.filesConfirmed = false;
    modelAssistAttempted.value = false;
    modelStore.reset();
    composerStore.setFinalPrompt('');
  }

  return {
    candidateHits,
    apiTrace,
    i18nTrace,
    definitionTrace,
    candidateLoading,
    searchRunning,
    candidateError,
    searchStartedAt,
    searchFinishedAt,
    searchKeywords,
    includeApiEvidence,
    selectedCandidatePaths,
    expandedCandidatePath,
    modelAssistAttempted,
    processLogs,
    agentUsed,
    serverNeedsMoreEvidence,
    searchApiRequests,
    selectedCandidateHits,
    needsMoreEvidence,
    showCandidatePicker,
    appendProcessLog: searchStore.appendProcessLog,
    invalidateCandidateConfirm,
    clearCandidateState
  };
}
