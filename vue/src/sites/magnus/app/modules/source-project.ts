import { ref, shallowRef } from 'vue';
import {
  buildProjectFromFileList,
  scanDirectoryHandle
} from '../services/project-scanner';
import { normalizeSourceServerProject, sourceServerJson } from '../services/source-service';

export function useSourceProject({ projectStorageKey, resetProjectContext, setToast }) {
  const fileInputRef = ref(null);
  const project = shallowRef(null);
  const sourceServiceStatus = ref('idle');
  const sourceServiceError = ref('');
  const sourceServiceMessage = ref('');

  function rememberProjectPath(projectValue) {
    if (!projectValue || projectValue.source !== 'source-server' || !projectValue.path) return;
    try {
      window.localStorage.setItem(projectStorageKey.value, JSON.stringify({
        path: projectValue.path,
        name: projectValue.name || '',
        savedAt: Date.now()
      }));
    } catch (error) {
    }
  }

  function savedProjectPath() {
    try {
      const raw = window.localStorage.getItem(projectStorageKey.value);
      if (!raw) return '';
      const data = JSON.parse(raw);
      return data && typeof data.path === 'string' ? data.path : '';
    } catch (error) {
      return '';
    }
  }

  function resetAfterProjectChange() {
    if (typeof resetProjectContext === 'function') resetProjectContext();
  }

  async function restoreSavedProject() {
    const path = savedProjectPath();
    if (!path || project.value || sourceServiceStatus.value === 'loading') return false;
    sourceServiceStatus.value = 'loading';
    sourceServiceError.value = '';
    sourceServiceMessage.value = '正在恢复当前域名的本地源码路径...';
    try {
      await sourceServerJson('/health', {
        timeoutMs: 3000,
        timeoutMessage: '本地源码服务未响应，请确认已运行 npm run source:server'
      });
      const data = await sourceServerJson('/api/source/scan', {
        method: 'POST',
        body: { path },
        timeoutMs: 20000,
        timeoutMessage: '恢复源码路径超时，请重新选择项目源码'
      });
      project.value = normalizeSourceServerProject(data.project || {});
      sourceServiceStatus.value = 'connected';
      sourceServiceMessage.value = '';
      resetAfterProjectChange();
      setToast(`已恢复 ${project.value.name}`);
      return true;
    } catch (error) {
      sourceServiceStatus.value = 'idle';
      sourceServiceMessage.value = '';
      sourceServiceError.value = `恢复已保存源码路径失败：${error.message || error}`;
      return false;
    }
  }

  async function chooseProjectFromSourceServer() {
    sourceServiceStatus.value = 'loading';
    sourceServiceError.value = '';
    sourceServiceMessage.value = '正在检查本地源码服务...';
    await sourceServerJson('/health', {
      timeoutMs: 3000,
      timeoutMessage: '本地源码服务未响应，请确认已运行 npm run source:server'
    });
    sourceServiceMessage.value = '等待系统目录选择器，请在弹窗中选择源码目录...';
    const data = await sourceServerJson('/api/source/select', {
      method: 'POST',
      body: {},
      timeoutMs: 90000,
      timeoutMessage: '等待目录选择器超时，请确认系统弹窗是否被遮挡'
    });
    project.value = normalizeSourceServerProject(data.project || {});
    rememberProjectPath(project.value);
    resetAfterProjectChange();
    sourceServiceStatus.value = 'connected';
    sourceServiceMessage.value = '';
    setToast(`已关联 ${project.value.name}`);
  }

  async function chooseProject() {
    setToast('正在选择项目...');
    try {
      await chooseProjectFromSourceServer();
      return;
    } catch (error) {
      sourceServiceStatus.value = 'fallback';
      sourceServiceMessage.value = '';
      sourceServiceError.value = `${error.message || error}。请先运行 npm run source:server；当前将使用浏览器目录选择兜底，无法拿到真实路径。`;
    }

    if (window.showDirectoryPicker && window.isSecureContext) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        project.value = await scanDirectoryHandle(handle);
        resetAfterProjectChange();
        sourceServiceError.value = '';
        setToast(`已关联 ${project.value.name}`);
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') {
          setToast('已取消选择');
          return;
        }
        setToast('目录选择器不可用，改用文件夹输入');
      }
    }
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
      fileInputRef.value.click();
    }
  }

  async function onFileInputChange(event) {
    const files = event.target.files;
    if (!files || !files.length) return;
    project.value = await buildProjectFromFileList(files);
    resetAfterProjectChange();
    sourceServiceError.value = '';
    setToast(`已关联 ${project.value.name}`);
  }

  return {
    fileInputRef,
    project,
    sourceServiceStatus,
    sourceServiceError,
    sourceServiceMessage,
    chooseProject,
    onFileInputChange,
    restoreSavedProject
  };
}
