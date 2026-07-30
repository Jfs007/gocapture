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
  const extensions = ref<any>(null);

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
      const [result, extensionResult] = await Promise.all([
        sourceServerJson('/api/memory/read', {
          method: 'POST',
          body: { projectPath },
          timeoutMs: 10000,
          timeoutMessage: '读取记忆超时，请确认本地源码服务可用'
        }),
        sourceServerJson(`/api/connect-agents/extensions?projectRoot=${encodeURIComponent(projectPath)}`, {
          timeoutMs: 10000,
          timeoutMessage: '读取 Agent 扩展超时'
        })
      ]);
      snapshot.value = result.memory || null;
      extensions.value = extensionResult.extensions || null;
    } catch (cause: any) {
      error.value = cause?.message || '读取记忆失败';
    } finally {
      loading.value = false;
    }
  }

  async function saveExperience(payload: any) {
    return save('/api/experience', payload, '项目经验已保存');
  }

  async function installExtension(kind: 'mcp' | 'skill', extension: any) {
    return mutateExtension(`/api/connect-agents/extensions/${kind}`, 'POST', {
      extension
    }, `${kind === 'mcp' ? 'MCP' : 'Skill'} 已安装并重载`);
  }

  async function removeExtension(kind: 'mcp' | 'skill', name: string) {
    return mutateExtension(`/api/connect-agents/extensions/${kind}`, 'DELETE', {
      name
    }, `${kind === 'mcp' ? 'MCP' : 'Skill'} 已移除并重载`);
  }

  async function reloadExtensions() {
    return mutateExtension('/api/connect-agents/extensions/reload', 'POST', {}, 'Agent 扩展已重载');
  }

  async function mutateExtension(pathname: string, method: string, payload: any, successMessage: string) {
    if (!projectStore.current?.path) return false;
    saving.value = true;
    error.value = '';
    message.value = '';
    try {
      const result = await sourceServerJson(pathname, {
        method,
        body: {
          ...payload,
          projectRoot: projectStore.current.path
        },
        timeoutMs: 20000,
        timeoutMessage: '更新 Agent 扩展超时'
      });
      extensions.value = result.extensions || extensions.value;
      message.value = successMessage;
      return true;
    } catch (cause: any) {
      error.value = cause?.message || '更新 Agent 扩展失败';
      return false;
    } finally {
      saving.value = false;
    }
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
    extensions,
    openPanel,
    closePanel,
    load,
    saveExperience,
    installExtension,
    removeExtension,
    reloadExtensions
  };
});
