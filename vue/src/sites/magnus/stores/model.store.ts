import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ModelConfig, ModelLocateResult, ModelRunStatus } from '../app/types/model.types';

export const useModelStore = defineStore('magnus.model', () => {
  const selectedModelId = ref<string | null>(null);
  const configs = ref<ModelConfig[]>([]);
  const useModelAssist = ref(false);
  const canUseModelAssist = ref(false);
  const editorOpen = ref(false);
  const form = ref<Record<string, any>>({});
  const status = ref<ModelRunStatus>('idle');
  const logs = ref<string[]>([]);
  const result = ref<ModelLocateResult | null>(null);
  const error = ref('');
  const startedAt = ref(0);
  const finishedAt = ref(0);

  const selectedModel = computed(() => {
    return configs.value.find(item => item.id === selectedModelId.value) || null;
  });

  function start() {
    status.value = 'running';
    logs.value = [];
    result.value = null;
    error.value = '';
    startedAt.value = Date.now();
    finishedAt.value = 0;
  }

  function appendLog(log: string) {
    logs.value.push(log);
  }

  function applyResult(nextResult: ModelLocateResult | null) {
    result.value = nextResult;
    status.value = nextResult?.stopped ? 'stopped' : 'success';
    finishedAt.value = Date.now();
  }

  function fail(reason: unknown) {
    status.value = 'error';
    error.value = `${(reason as Error)?.message || reason || ''}`;
    finishedAt.value = Date.now();
  }

  function reset() {
    status.value = 'idle';
    logs.value = [];
    result.value = null;
    error.value = '';
    startedAt.value = 0;
    finishedAt.value = 0;
  }

  return {
    selectedModelId,
    configs,
    useModelAssist,
    canUseModelAssist,
    editorOpen,
    form,
    status,
    logs,
    result,
    error,
    startedAt,
    finishedAt,
    selectedModel,
    start,
    appendLog,
    applyResult,
    fail,
    reset
  };
});
