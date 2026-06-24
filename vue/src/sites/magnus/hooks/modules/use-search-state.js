import { computed, ref } from 'vue';

export function useSearchState({
  routeResolverTrace,
  recentRequests,
  modelAssistLoading,
  filesConfirmed,
  resetModelAssist,
  invalidatePrompt
}) {
  const candidateHits = ref([]);
  const apiTrace = ref(null);
  const i18nTrace = ref(null);
  const definitionTrace = ref(null);
  const candidateLoading = ref(false);
  const searchRunning = ref(false);
  const candidateError = ref('');
  const searchStartedAt = ref(0);
  const searchFinishedAt = ref(0);
  const searchKeywords = ref('');
  const includeApiEvidence = ref(true);
  const selectedCandidatePaths = ref([]);
  const expandedCandidatePath = ref('');
  const modelAssistAttempted = ref(false);

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
  const localNeedsMoreEvidence = computed(() => candidateHits.value.length > 1 && !filesConfirmed.value && !hasReliableCandidateEvidence.value);
  const needsMoreEvidence = computed(() => localNeedsMoreEvidence.value && !modelAssistLoading.value && !modelAssistAttempted.value);
  const showCandidatePicker = computed(() => {
    return candidateHits.value.length > 1 && !filesConfirmed.value && !localNeedsMoreEvidence.value && !modelAssistLoading.value;
  });

  function invalidateCandidateConfirm(filesConfirmed) {
    filesConfirmed.value = false;
    invalidatePrompt();
  }

  function clearCandidateState(filesConfirmed) {
    candidateHits.value = [];
    candidateError.value = '';
    searchRunning.value = false;
    searchStartedAt.value = 0;
    searchFinishedAt.value = 0;
    selectedCandidatePaths.value = [];
    expandedCandidatePath.value = '';
    if (filesConfirmed) filesConfirmed.value = false;
    modelAssistAttempted.value = false;
    resetModelAssist();
    invalidatePrompt();
  }

  function resetProjectContext(selection, composer) {
    selection.selectionConfirmed.value = false;
    selection.customEvidence.value = '';
    selection.evidenceMessages.value = [];
    clearCandidateState(selection.filesConfirmed);
    composer.resetPromptComposer();
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
    searchApiRequests,
    selectedCandidateHits,
    needsMoreEvidence,
    showCandidatePicker,
    invalidateCandidateConfirm,
    clearCandidateState,
    resetProjectContext
  };
}
