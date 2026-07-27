import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  bindConnectAgentThread,
  connectAgent,
  listConnectAgents,
  listConnectAgentMessages,
  listConnectAgentThreads,
  type ConnectAgentProvider,
  type ConnectAgentTask,
  type ConnectAgentThreadGroups,
  type ConnectAgentTimelineMessage
} from '../app/services/connect-agent.service';

export const useConnectAgentStore = defineStore('gocapture.connect-agent', () => {
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
  const threadGroups = ref<ConnectAgentThreadGroups>({
    project: [],
    recent: [],
    projectlessStateAvailable: false
  });
  const threadPickerVisible = ref(false);
  const threadLoading = ref(false);
  const bindingThreadId = ref('');
  const selectedProviderId = ref('');
  const pickerProviderId = ref('');
  const currentProjectRoot = ref('');

  const activeProvider = computed(() => {
    const selected = providers.value.find(provider => provider.id === selectedProviderId.value);
    if (selected) return selected;
    return providers.value.find(provider => provider.projectThreadId)
      || providers.value.find(provider => provider.connected)
      || null;
  });
  const pickerProvider = computed(() =>
    providers.value.find(provider => provider.id === pickerProviderId.value) || null);
  const taskRunning = computed(() => taskStatus.value === 'running');

  async function refreshProviders(refresh = false, projectRoot = '') {
    const root = String(projectRoot || '').trim();
    if (root) {
      currentProjectRoot.value = root;
    }
    loading.value = true;
    connectionError.value = '';
    try {
      setProviders(await listConnectAgents(refresh, root));
      restoreSelectedProvider(root);
      return providers.value;
    } catch (error) {
      connectionError.value = (error as Error)?.message || '无法检查 Agent 连接状态';
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function connectProvider(providerId: string, projectRoot = '') {
    const id = String(providerId || '').trim();
    const root = String(projectRoot || '').trim();
    loading.value = true;
    connectionError.value = '';
    try {
      const available = await listConnectAgents(true, root);
      setProviders(available);
      const provider = available.find(item => item.id === id);
      if (!provider) throw new Error('当前版本未提供所选 Agent');
      if (!provider.installed) throw new Error(provider.message || `未检测到 ${provider.name}`);
      const connected = provider.connected ? provider : await connectAgent(provider.id);
      upsertProvider(connected);
      selectProvider(id, root);
      if (root) {
        setProviders(await listConnectAgents(false, root));
        return providers.value.find(item => item.id === id) || connected;
      }
      return connected;
    } catch (error) {
      connectionError.value = (error as Error)?.message || 'Agent 连接失败';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function openAgentPicker(projectRoot: string) {
    const root = String(projectRoot || '').trim();
    if (!root) {
      connectionError.value = '请先连接项目源码';
      return false;
    }
    currentProjectRoot.value = root;
    threadPickerVisible.value = true;
    threadLoading.value = true;
    connectionError.value = '';
    try {
      await refreshProviders(true, root);
      const initialProvider = activeProvider.value;
      pickerProviderId.value = initialProvider?.id || providers.value[0]?.id || '';
      if (initialProvider?.connected && initialProvider.supportsThreadBinding) {
        threadGroups.value = await listConnectAgentThreads(initialProvider.id, root);
      } else {
        clearThreadGroups();
      }
      return true;
    } catch (error) {
      connectionError.value = (error as Error)?.message || '无法加载 Codex 任务';
      return false;
    } finally {
      threadLoading.value = false;
    }
  }

  function closeThreadPicker() {
    if (bindingThreadId.value) return;
    threadPickerVisible.value = false;
  }

  async function chooseProvider(providerId: string) {
    const root = currentProjectRoot.value;
    const provider = await connectProvider(providerId, root);
    if (!provider) return false;
    pickerProviderId.value = provider.id;
    if (!provider.supportsThreadBinding) {
      clearThreadGroups();
      await loadTimeline(root, provider.id);
      threadPickerVisible.value = false;
      return true;
    }
    threadLoading.value = true;
    try {
      threadGroups.value = await listConnectAgentThreads(provider.id, root);
      return true;
    } catch (error) {
      connectionError.value = (error as Error)?.message || `无法加载 ${provider.name} 任务`;
      return false;
    } finally {
      threadLoading.value = false;
    }
  }

  async function bindThread(projectRoot: string, threadId: string) {
    const root = String(projectRoot || '').trim();
    const id = String(threadId || '').trim();
    const providerId = pickerProviderId.value;
    if (!root || !id || !providerId) return false;
    bindingThreadId.value = id;
    connectionError.value = '';
    try {
      const session = await bindConnectAgentThread(providerId, root, id);
      selectProvider(providerId, root);
      setProviders(await listConnectAgents(false, root));
      await loadTimeline(root, providerId);
      threadPickerVisible.value = false;
      return !!session?.threadId;
    } catch (error) {
      connectionError.value = (error as Error)?.message || '绑定 Agent 任务失败';
      return false;
    } finally {
      bindingThreadId.value = '';
    }
  }

  async function loadTimeline(projectRoot: string, providerId = '') {
    const root = String(projectRoot || '').trim();
    const resolvedProviderId = providerId || selectedProviderId.value || 'codex';
    timelineProjectRoot.value = root;
    if (!root) {
      timeline.value = [];
      return [];
    }
    timelineLoading.value = true;
    try {
      const messages = await listConnectAgentMessages(root, resolvedProviderId);
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

  function selectProvider(providerId: string, root = currentProjectRoot.value) {
    selectedProviderId.value = String(providerId || '');
    pickerProviderId.value = selectedProviderId.value;
    if (root && selectedProviderId.value) {
      window.localStorage.setItem(providerStorageKey(root), selectedProviderId.value);
    }
  }

  function restoreSelectedProvider(root: string) {
    const saved = root ? window.localStorage.getItem(providerStorageKey(root)) || '' : '';
    const provider = providers.value.find(item => item.id === saved)
      || providers.value.find(item => item.projectThreadId)
      || providers.value.find(item => item.connected);
    if (provider) selectProvider(provider.id, root);
  }

  function clearThreadGroups() {
    threadGroups.value = {
      project: [],
      recent: [],
      projectlessStateAvailable: false
    };
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
    threadGroups,
    threadPickerVisible,
    threadLoading,
    bindingThreadId,
    selectedProviderId,
    pickerProviderId,
    pickerProvider,
    activeProvider,
    taskRunning,
    refreshProviders,
    loadTimeline,
    connectProvider,
    openAgentPicker,
    chooseProvider,
    closeThreadPicker,
    bindThread,
    selectProvider,
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

function providerStorageKey(projectRoot: string) {
  return `gocapture.connect-agent.provider:${projectRoot}`;
}
