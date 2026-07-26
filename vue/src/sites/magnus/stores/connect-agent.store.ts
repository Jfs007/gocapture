import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  connectAgent,
  listConnectAgents,
  listConnectAgentMessages,
  type ConnectAgentProvider,
  type ConnectAgentTask,
  type ConnectAgentTimelineMessage
} from '../app/services/connect-agent.service';

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
  const timeline = ref<ConnectAgentTimelineMessage[]>([]);
  const timelineLoading = ref(false);
  const timelineProjectRoot = ref('');

  const activeProvider = computed(() => providers.value.find(provider => provider.connected) || null);
  const taskRunning = computed(() => taskStatus.value === 'running');

  async function refreshProviders(refresh = false, projectRoot = '') {
    loading.value = true;
    connectionError.value = '';
    try {
      setProviders(await listConnectAgents(refresh, projectRoot));
      return providers.value;
    } catch (error) {
      connectionError.value = (error as Error)?.message || '无法检查 Agent 连接状态';
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function connectDefaultAgent(projectRoot = '') {
    loading.value = true;
    connectionError.value = '';
    try {
      const available = await listConnectAgents(true, projectRoot);
      setProviders(available);
      const provider = available.find(item => item.id === 'codex');
      if (!provider) throw new Error('当前版本未提供 Codex 连接');
      if (provider.connected) return provider;
      if (!provider.installed) throw new Error(provider.message || '未检测到 Codex，请先安装并登录 Codex');
      const connected = await connectAgent(provider.id);
      upsertProvider(connected);
      if (projectRoot) {
        setProviders(await listConnectAgents(false, projectRoot));
        return activeProvider.value || connected;
      }
      return connected;
    } catch (error) {
      connectionError.value = (error as Error)?.message || 'Codex 连接失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function loadTimeline(projectRoot: string, providerId = 'codex') {
    const root = String(projectRoot || '').trim();
    timelineProjectRoot.value = root;
    if (!root) {
      timeline.value = [];
      return [];
    }
    timelineLoading.value = true;
    try {
      const messages = await listConnectAgentMessages(root, providerId);
      if (timelineProjectRoot.value === root) setTimeline(messages);
      return messages;
    } catch {
      if (timelineProjectRoot.value === root) timeline.value = [];
      return [];
    } finally {
      if (timelineProjectRoot.value === root) timelineLoading.value = false;
    }
  }

  function setProviders(nextProviders: ConnectAgentProvider[]) {
    providers.value = Array.isArray(nextProviders) ? nextProviders : [];
  }

  function upsertProvider(provider: ConnectAgentProvider) {
    providers.value = providers.value
      .filter(item => item.id !== provider.id)
      .concat(provider);
  }

  function setTimeline(messages: ConnectAgentTimelineMessage[]) {
    timeline.value = [...(Array.isArray(messages) ? messages : [])]
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  }

  function upsertTimelineMessage(message: ConnectAgentTimelineMessage) {
    if (!message?.id) return;
    const index = timeline.value.findIndex(item => item.id === message.id);
    if (index >= 0) {
      timeline.value[index] = { ...timeline.value[index], ...message };
      return;
    }
    timeline.value.push(message);
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
    if (event?.timelineMessage) upsertTimelineMessage(event.timelineMessage);
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
    if (result.threadId && activeProvider.value) {
      upsertProvider({
        ...activeProvider.value,
        projectThreadId: result.threadId
      });
    }
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
    timeline,
    timelineLoading,
    timelineProjectRoot,
    activeProvider,
    taskRunning,
    refreshProviders,
    loadTimeline,
    connectDefaultAgent,
    setProviders,
    upsertProvider,
    setTimeline,
    upsertTimelineMessage,
    beginTask,
    applyTaskEvent,
    completeTask,
    failTask,
    cancelTask,
    resetTask
  };
});
