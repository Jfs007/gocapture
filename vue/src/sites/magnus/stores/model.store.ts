import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { ModelConfig, ModelLocateResult, ModelRunStatus } from '../domain/model/model.types';

export const useModelStore = defineStore('magnus.model', () => {
  const selectedModelId = ref<string | null>(null);
  const configs = ref<ModelConfig[]>([]);
  const status = ref<ModelRunStatus>('idle');
  const logs = ref<string[]>([]);
  const result = ref<ModelLocateResult | null>(null);
  const error = ref('');

  function start() {
    status.value = 'running';
    logs.value = [];
    result.value = null;
    error.value = '';
  }

  function appendLog(log: string) {
    logs.value.push(log);
  }

  function applyResult(nextResult: ModelLocateResult | null) {
    result.value = nextResult;
    status.value = nextResult?.stopped ? 'stopped' : 'success';
  }

  function fail(reason: unknown) {
    status.value = 'error';
    error.value = `${(reason as Error)?.message || reason || ''}`;
  }

  function reset() {
    status.value = 'idle';
    logs.value = [];
    result.value = null;
    error.value = '';
  }

  return {
    selectedModelId,
    configs,
    status,
    logs,
    result,
    error,
    start,
    appendLog,
    applyResult,
    fail,
    reset
  };
});
