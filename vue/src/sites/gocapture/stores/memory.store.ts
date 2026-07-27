import { ref } from 'vue';
import { defineStore } from 'pinia';
import { sourceServerJson } from '../app/services/source-service';
import { useProjectStore } from './project.store';

export const useMemoryStore = defineStore('gocapture.memory', () => {
  const projectStore = useProjectStore();
  const open = ref(false);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  const message = ref('');
  const snapshot = ref<any>(null);
  const toolProviders = ref<any[]>([]);
  const tools = ref<any[]>([]);
  const resourceProviders = ref<any[]>([]);
  const resources = ref<any[]>([]);

  async function openPanel() {
    open.value = true;
    await load();
  }

  function closePanel() {
    open.value = false;
    error.value = '';
    message.value = '';
  }

  async function load() {
    if (!projectStore.current?.path || projectStore.current.source !== 'source-server') {
      snapshot.value = null;
      error.value = '请先关联本地源码项目';
      return;
    }
    loading.value = true;
    error.value = '';
    message.value = '';
    try {
      const projectPath = projectStore.current.path;
      const [result, toolResult, resourceResult] = await Promise.all([
        sourceServerJson('/api/memory/read', {
          method: 'POST',
          body: { projectPath },
          timeoutMs: 10000,
          timeoutMessage: '读取记忆超时，请确认本地源码服务可用'
        }),
        sourceServerJson('/api/agent/tools', {
          timeoutMs: 5000,
          timeoutMessage: '读取工具清单超时'
        }),
        sourceServerJson(`/api/agent/resources?projectPath=${encodeURIComponent(projectPath)}`, {
          timeoutMs: 5000,
          timeoutMessage: '读取资源清单超时'
        })
      ]);
      snapshot.value = result.memory || null;
      toolProviders.value = Array.isArray(toolResult.providers) ? toolResult.providers : [];
      tools.value = Array.isArray(toolResult.tools) ? toolResult.tools : [];
      resourceProviders.value = Array.isArray(resourceResult.providers) ? resourceResult.providers : [];
      resources.value = Array.isArray(resourceResult.resources) ? resourceResult.resources : [];
    } catch (cause: any) {
      error.value = cause?.message || '读取记忆失败';
    } finally {
      loading.value = false;
    }
  }

  async function saveExperience(payload: any) {
    return save('/api/experience', payload, '项目经验已保存');
  }

  async function save(pathname: string, payload: any, successMessage: string) {
    saving.value = true;
    error.value = '';
    message.value = '';
    try {
      const result = await sourceServerJson(pathname, {
        method: 'POST',
        body: {
          ...payload,
          projectPath: projectStore.current?.path || ''
        },
        timeoutMs: 10000,
        timeoutMessage: '保存记忆超时，请确认本地源码服务可用'
      });
      snapshot.value = result.memory || null;
      message.value = successMessage;
      return true;
    } catch (cause: any) {
      error.value = cause?.message || '保存记忆失败';
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    open,
    loading,
    saving,
    error,
    message,
    snapshot,
    toolProviders,
    tools,
    resourceProviders,
    resources,
    openPanel,
    closePanel,
    load,
    saveExperience
  };
});
