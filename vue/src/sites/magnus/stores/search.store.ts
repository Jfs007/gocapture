import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { CandidateFile } from '../app/types/search.types';

export const useSearchStore = defineStore('magnus.search', () => {
  const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle');
  const candidates = ref<CandidateFile[]>([]);
  const selectedCandidatePaths = ref<string[]>([]);
  const expandedCandidatePath = ref('');
  const apiTrace = ref<unknown>(null);
  const i18nTrace = ref<unknown>(null);
  const definitionTrace = ref<unknown>(null);
  const startedAt = ref(0);
  const finishedAt = ref(0);
  const error = ref('');
  const includeApiEvidence = ref(true);
  const modelAssistAttempted = ref(false);
  const showCandidatePicker = ref(false);
  const needsMoreEvidence = ref(false);

  const selectedCandidates = computed(() => {
    const selected = new Set(selectedCandidatePaths.value);
    return candidates.value.filter(item => selected.has(item.file));
  });

  function start() {
    status.value = 'loading';
    error.value = '';
    startedAt.value = Date.now();
    finishedAt.value = 0;
    modelAssistAttempted.value = false;
  }

  function applyResult(result: {
    hits?: CandidateFile[];
    apiTrace?: unknown;
    i18nTrace?: unknown;
    definitionTrace?: unknown;
  }) {
    candidates.value = Array.isArray(result?.hits) ? result.hits : [];
    selectedCandidatePaths.value = candidates.value[0]?.file ? [candidates.value[0].file] : [];
    expandedCandidatePath.value = '';
    apiTrace.value = result?.apiTrace || null;
    i18nTrace.value = result?.i18nTrace || null;
    definitionTrace.value = result?.definitionTrace || null;
    status.value = candidates.value.length ? 'success' : 'idle';
    finishedAt.value = Date.now();
  }

  function fail(reason: unknown) {
    status.value = 'error';
    error.value = `${(reason as Error)?.message || reason || ''}`;
    finishedAt.value = Date.now();
  }

  function reset() {
    status.value = 'idle';
    candidates.value = [];
    selectedCandidatePaths.value = [];
    expandedCandidatePath.value = '';
    apiTrace.value = null;
    i18nTrace.value = null;
    definitionTrace.value = null;
    startedAt.value = 0;
    finishedAt.value = 0;
    error.value = '';
    modelAssistAttempted.value = false;
  }

  return {
    status,
    candidates,
    selectedCandidatePaths,
    expandedCandidatePath,
    apiTrace,
    i18nTrace,
    definitionTrace,
    startedAt,
    finishedAt,
    error,
    includeApiEvidence,
    modelAssistAttempted,
    showCandidatePicker,
    needsMoreEvidence,
    selectedCandidates,
    start,
    applyResult,
    fail,
    reset
  };
});
