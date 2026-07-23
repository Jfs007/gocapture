import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ConnectAgentProvider, ConnectAgentTask } from '../app/services/connect-agent.service';

export const useConnectAgentStore = defineStore('magnus.connect-agent', () => {
  const providers = ref<ConnectAgentProvider[]>([]);
  const loading = ref(false);
  const connectionError = ref('');
  const task = ref<ConnectAgentTask | null>(null);
  const taskStatus = ref<'idle' | 'running' | 'completed' | 'failed' | 'cancelled'>('idle');
  const taskLogs = ref<string[]>([]);
  const taskError = ref('');
  const taskStartedAt = ref(0);
  const taskFinishedAt = ref(0);
  const taskController = ref<AbortController | null>(null);

  const activeProvider = computed(() => providers.value.find(provider => provider.connected) || null);
  const taskRunning = computed(() => taskStatus.value === 'running');

  function setProviders(nextProviders: ConnectAgentProvider[]) {
    providers.value = Array.isArray(nextProviders) ? nextProviders : [];
  }

  function upsertProvider(provider: ConnectAgentProvider) {
    providers.value = providers.value
      .filter(item => item.id !== provider.id)
      .concat(provider);
  }

  function beginTask(controller: AbortController) {
    task.value = null;
    taskStatus.value = 'running';
    taskLogs.value = [];
    taskError.value = '';
    taskStartedAt.value = Date.now();
    taskFinishedAt.value = 0;
    taskController.value = controller;
  }

  function applyTaskEvent(event: any) {
    if (event?.task) task.value = { ...(task.value || {}), ...event.task };
    if (event?.event?.method === 'item/agentMessage/delta') {
      task.value = {
        ...(task.value || {}),
        finalResponse: `${task.value?.finalResponse || ''}${event.event?.params?.delta || ''}`
      } as ConnectAgentTask;
    }
    if (event?.event?.method === 'item/completed'
      && event.event?.params?.item?.type === 'agentMessage') {
      const text = String(event.event.params.item.text || '');
      if (text.length > String(task.value?.finalResponse || '').length) {
        task.value = { ...(task.value || {}), finalResponse: text } as ConnectAgentTask;
      }
    }
    const message = String(event?.message || '').trim();
    if (message && taskLogs.value[taskLogs.value.length - 1] !== message) {
      taskLogs.value.push(message);
    }
  }

  function completeTask(result: ConnectAgentTask) {
    task.value = result;
    taskStatus.value = result.status === 'completed' ? 'completed' : 'failed';
    taskFinishedAt.value = Number(result.finishedAt || Date.now());
    taskController.value = null;
  }

  function failTask(error: unknown) {
    const payload = (error as any)?.payload;
    if (payload?.task) task.value = { ...(task.value || {}), ...payload.task };
    taskError.value = (error as Error)?.message || String(error || 'Codex 开发任务失败');
    taskStatus.value = task.value?.status === 'cancelled' ? 'cancelled' : 'failed';
    taskFinishedAt.value = Date.now();
    taskController.value = null;
  }

  function cancelTask() {
    taskController.value?.abort();
  }

  function resetTask() {
    if (taskRunning.value) cancelTask();
    task.value = null;
    taskStatus.value = 'idle';
    taskLogs.value = [];
    taskError.value = '';
    taskStartedAt.value = 0;
    taskFinishedAt.value = 0;
    taskController.value = null;
  }

  return {
    providers,
    loading,
    connectionError,
    task,
    taskStatus,
    taskLogs,
    taskError,
    taskStartedAt,
    taskFinishedAt,
    taskController,
    activeProvider,
    taskRunning,
    setProviders,
    upsertProvider,
    beginTask,
    applyTaskEvent,
    completeTask,
    failTask,
    cancelTask,
    resetTask
  };
});
