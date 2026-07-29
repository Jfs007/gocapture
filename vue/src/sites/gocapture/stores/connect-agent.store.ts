import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  bindConnectAgentThread,
  connectAgent,
  listConnectAgents,
  listConnectAgentMessages,
  listConnectAgentThreads,
  loadConnectAgentSettings,
  respondConnectAgentInteraction,
  saveConnectAgentSettings,
  type ConnectAgentInteraction,
  type ConnectAgentProvider,
  type ConnectAgentProjectSettings,
  type ConnectAgentOptions,
  type ConnectAgentTask,
  type ConnectAgentThreadGroups,
  type ConnectAgentTimelineMessage
} from '../app/services/connect-agent.service';

export const useConnectAgentStore = defineStore('gocapture.connect-agent', () => {
  const providers = ref<ConnectAgentProvider[]>([]);
  const loading = ref(false);
  const connectionError = ref('');
  const task = ref<ConnectAgentTask | null>(null);
  const taskStatus = ref<'idle' | 'running' | 'waiting-input' | 'completed' | 'failed' | 'cancelled'>('idle');
  const taskLogs = ref<string[]>([]);
  const taskError = ref('');
  const taskStartedAt = ref(0);
  const taskFinishedAt = ref(0);
  const taskController = ref<AbortController | null>(null);
  const pendingInteraction = ref<ConnectAgentInteraction | null>(null);
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
  const projectSettings = ref<ConnectAgentProjectSettings>({ proxy: '', activeProviderId: '' });
  const settingsSaving = ref(false);
  let autoConnectPromise: Promise<void> | null = null;

  const activeProvider = computed(() => {
    const selected = providers.value.find(provider => provider.id === selectedProviderId.value);
    if (selected) return selected;
    return providers.value.find(provider => provider.projectThreadId)
      || providers.value.find(provider => provider.connected)
      || null;
  });
  const pickerProvider = computed(() =>
    providers.value.find(provider => provider.id === pickerProviderId.value) || null);
  const taskRunning = computed(() =>
    taskStatus.value === 'running' || taskStatus.value === 'waiting-input');
  const taskAwaitingInput = computed(() =>
    taskStatus.value === 'waiting-input' && !!pendingInteraction.value);

  async function refreshProviders(refresh = false, projectRoot = '') {
    const root = String(projectRoot || '').trim();
    if (root) {
      currentProjectRoot.value = root;
    }
    loading.value = true;
    connectionError.value = '';
    try {
      const [nextProviders, settings] = await Promise.all([
        listConnectAgents(refresh, root),
        root
          ? loadConnectAgentSettings(root)
          : Promise.resolve({ proxy: '', activeProviderId: '' })
      ]);
      setProviders(nextProviders);
      projectSettings.value = settings;
      restoreSelectedProvider(root);
      if (root && activeProvider.value && !settings.activeProviderId) {
        await persistActiveProvider(activeProvider.value.id, root);
      }
      await restoreProviderConnection(root);
      return providers.value;
    } catch (error) {
      connectionError.value = (error as Error)?.message || '无法检查 Agent 连接状态';
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function connectProvider(
    providerId: string,
    projectRoot = '',
    options?: ConnectAgentOptions
  ) {
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
      const connectOptions = {
        ...(options || {}),
        projectRoot: root
      };
      const connected = options || !provider.connected
        ? await connectAgent(provider.id, connectOptions)
        : provider;
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
      const [, settings] = await Promise.all([
        refreshProviders(true, root),
        loadConnectAgentSettings(root)
      ]);
      projectSettings.value = settings;
      const initialProvider = activeProvider.value;
      pickerProviderId.value = initialProvider?.id || providers.value[0]?.id || '';
      if (initialProvider?.connected && initialProvider.supportsThreadBinding) {
        threadGroups.value = await listConnectAgentThreads(initialProvider.id, root);
      } else {
        clearThreadGroups();
      }
      return true;
    } catch (error) {
      connectionError.value = (error as Error)?.message || '无法加载 Agent 任务';
      return false;
    } finally {
      threadLoading.value = false;
    }
  }

  async function saveProjectSettings(settings: ConnectAgentProjectSettings) {
    const root = currentProjectRoot.value;
    if (!root) return false;
    settingsSaving.value = true;
    connectionError.value = '';
    try {
      projectSettings.value = await saveConnectAgentSettings(root, settings);
      const provider = pickerProvider.value || activeProvider.value;
      if (provider?.connected) {
        const connected = await connectAgent(provider.id, { projectRoot: root });
        upsertProvider(connected);
      }
      return true;
    } catch (error) {
      connectionError.value = (error as Error)?.message || '保存 Agent 公共设置失败';
      return false;
    } finally {
      settingsSaving.value = false;
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
    await persistActiveProvider(provider.id, root);
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
      await persistActiveProvider(providerId, root);
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
    const saved = projectSettings.value.activeProviderId
      || (root ? window.localStorage.getItem(providerStorageKey(root)) || '' : '');
    const provider = providers.value.find(item => item.id === saved)
      || [...providers.value]
        .filter(item => item.projectThreadId)
        .sort((left, right) =>
          String(right.projectThreadUpdatedAt || '').localeCompare(
            String(left.projectThreadUpdatedAt || '')
          ))[0]
      || providers.value.find(item => item.connected);
    if (provider) selectProvider(provider.id, root);
  }

  async function persistActiveProvider(providerId: string, root: string) {
    if (!root || !providerId) return;
    projectSettings.value = await saveConnectAgentSettings(root, {
      ...projectSettings.value,
      activeProviderId: providerId
    });
  }

  async function restoreProviderConnection(root: string) {
    const provider = activeProvider.value;
    if (!root || !provider || provider.connected || !provider.installed) return;
    if (autoConnectPromise) {
      await autoConnectPromise;
      return;
    }
    autoConnectPromise = (async () => {
      try {
        await connectAgent(provider.id, { projectRoot: root });
        setProviders(await listConnectAgents(false, root));
        restoreSelectedProvider(root);
      } catch (error) {
        connectionError.value = (error as Error)?.message || `${provider.name} 自动连接失败`;
      } finally {
        autoConnectPromise = null;
      }
    })();
    await autoConnectPromise;
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
    pendingInteraction.value = null;
  }

  function applyTaskEvent(event: any) {
    if (event?.timelineMessage) upsertTimelineMessage(event.timelineMessage);
    if (event?.task) task.value = { ...(task.value || {}), ...event.task };
    const eventType = String(
      event?.rawType
      || event?.timelineMessage?.metadata?.eventType
      || ''
    );
    const interaction = event?.interaction
      || event?.timelineMessage?.metadata?.interaction
      || null;
    const waitingForInput = eventType === 'interaction-required'
      || event?.task?.status === 'waiting-input';
    if (interaction && waitingForInput) {
      pendingInteraction.value = interaction;
      taskStatus.value = 'waiting-input';
    } else if (eventType === 'interaction-resolved') {
      pendingInteraction.value = null;
      taskStatus.value = 'running';
    }
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
    pendingInteraction.value = null;
  }

  function failTask(error: unknown) {
    const payload = (error as any)?.payload;
    if (payload?.task) task.value = { ...(task.value || {}), ...payload.task };
    taskError.value = (error as Error)?.message || String(error || 'Agent 开发任务失败');
    taskStatus.value = task.value?.status === 'cancelled' ? 'cancelled' : 'failed';
    taskFinishedAt.value = Date.now();
    taskController.value = null;
    pendingInteraction.value = null;
  }

  async function answerInteraction(answer: string) {
    const interaction = pendingInteraction.value;
    const provider = activeProvider.value;
    const value = String(answer || '').trim();
    if (!interaction || !provider || !currentProjectRoot.value || !value) return false;
    taskError.value = '';
    try {
      const result = await respondConnectAgentInteraction(
        provider.id,
        currentProjectRoot.value,
        interaction.taskId,
        interaction.interactionId,
        value
      );
      if (result.timelineMessage) upsertTimelineMessage(result.timelineMessage);
      pendingInteraction.value = null;
      taskStatus.value = 'running';
      return true;
    } catch (error) {
      taskError.value = (error as Error)?.message || '提交 Agent 回答失败';
      return false;
    }
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
    pendingInteraction.value = null;
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
    taskAwaitingInput,
    pendingInteraction,
    projectSettings,
    settingsSaving,
    refreshProviders,
    loadTimeline,
    connectProvider,
    openAgentPicker,
    chooseProvider,
    closeThreadPicker,
    bindThread,
    saveProjectSettings,
    selectProvider,
    setProviders,
    upsertProvider,
    setTimeline,
    upsertTimelineMessage,
    beginTask,
    applyTaskEvent,
    completeTask,
    failTask,
    answerInteraction,
    cancelTask,
    resetTask
  };
});

function providerStorageKey(projectRoot: string) {
  return `gocapture.connect-agent.provider:${projectRoot}`;
}
