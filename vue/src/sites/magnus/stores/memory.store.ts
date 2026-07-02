import { ref } from 'vue';
import { defineStore } from 'pinia';
import { sourceServerJson } from '../app/services/source-service';
import { useProjectStore } from './project.store';

export const useMemoryStore = defineStore('magnus.memory', () => {
  const projectStore = useProjectStore();
  const open = ref(false);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  const message = ref('');
  const snapshot = ref<any>(null);

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
      const result = await sourceServerJson('/api/memory/read', {
        method: 'POST',
        body: { projectPath: projectStore.current.path },
        timeoutMs: 10000,
        timeoutMessage: '读取记忆超时，请确认本地源码服务可用'
      });
      snapshot.value = result.memory || null;
    } catch (cause: any) {
      error.value = cause?.message || '读取记忆失败';
    } finally {
      loading.value = false;
    }
  }

  async function saveSkill(payload: any) {
    return save('/api/memory/skill', payload, '项目经验已保存');
  }

  async function saveSession(payload: any) {
    return save('/api/memory/session', payload, '任务会话已保存');
  }

  async function removeSession(id: string) {
    return save('/api/memory/session/remove', { id }, '任务会话已清除');
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
      snapshot.value = result.memory || snapshot.value;
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
    openPanel,
    closePanel,
    load,
    saveSkill,
    saveSession,
    removeSession
  };
});
