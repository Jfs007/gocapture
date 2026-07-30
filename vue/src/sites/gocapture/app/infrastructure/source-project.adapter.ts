import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
  buildProjectFromFileList,
  scanDirectoryHandle
} from '../services/project-scanner';
import { normalizeSourceServerProject, sourceServerJson, sourceServerNdjson } from '../services/source-service';
import { useProjectStore } from '../../stores/project.store';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useComposerStore } from '../../stores/composer.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';

export function useSourceProject({ currentPageHref }) {
  const projectStore = useProjectStore();
  const appUiStore = useAppUiStore();
  const composerStore = useComposerStore();
  const searchStore = useSearchStore();
  const selectionStore = useSelectionStore();
  const {
    current: project,
    serviceStatus: sourceServiceStatus,
    serviceError: sourceServiceError,
    serviceMessage: sourceServiceMessage
  } = storeToRefs(projectStore);
  const fileInputRef = ref(null);

  function boundPageUrl() {
    const pageUrl = String(currentPageHref?.value || '').trim();
    if (!pageUrl || pageUrl.includes('/settings')) return '';
    return pageUrl;
  }

  async function rememberProjectPath(projectValue) {
    if (!projectValue || projectValue.source !== 'source-server' || !projectValue.path) return;
    const pageUrl = boundPageUrl();
    if (!pageUrl) return;
    try {
      await sourceServerJson('/api/registry/bind', {
        method: 'POST',
        body: {
          url: pageUrl,
          projectRoot: projectValue.path
        },
        timeoutMs: 5000,
        timeoutMessage: '保存页面项目绑定超时'
      });
    } catch (error) {
    }
  }

  async function savedProjectPath() {
    const pageUrl = boundPageUrl();
    if (!pageUrl) return '';
    try {
      const data = await sourceServerJson(`/api/registry/resolve?url=${encodeURIComponent(pageUrl)}`, {
        timeoutMs: 3000,
        timeoutMessage: '读取页面项目绑定超时'
      });
      const projectRoot = data?.binding?.projectRoot;
      return typeof projectRoot === 'string' ? projectRoot : '';
    } catch (error) {
      return '';
    }
  }

  function resetAfterProjectChange(options = {}) {
    const preserveUi = !!options.preserveUi;
    if (!preserveUi) {
      selectionStore.confirmed = false;
      selectionStore.filesConfirmed = false;
      selectionStore.customEvidence = '';
      selectionStore.evidenceMessages = [];
      composerStore.setFinalPrompt('');
      composerStore.clearContent();
    }
    searchStore.reset();
  }

  async function restoreSavedProject() {
    const path = await savedProjectPath();
    if (!path || project.value || sourceServiceStatus.value === 'loading') return false;
    sourceServiceStatus.value = 'loading';
    sourceServiceError.value = '';
    sourceServiceMessage.value = '正在恢复已保存的本地源码路径...';
    try {
      await sourceServerJson('/health', {
        timeoutMs: 3000,
        timeoutMessage: '本地源码服务未响应，请确认已运行 npm run source:server'
      });
      sourceServiceMessage.value = '正在恢复源码路径并扫描项目...';
      const data = await sourceServerJson('/api/source/scan', {
        method: 'POST',
        body: { path },
        timeoutMs: 20000,
        timeoutMessage: '恢复源码路径超时，请重新选择项目源码'
      });
      projectStore.setProject(normalizeSourceServerProject(data.project || {}));
      projectStore.setServiceStatus('connected');
      resetAfterProjectChange({ preserveUi: true });
      appUiStore.setToast(`已恢复 ${project.value.name}`);
      return true;
    } catch (error) {
      projectStore.setServiceStatus('idle', '', `恢复已保存源码路径失败：${error.message || error}`);
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
    const selectedProject = data.project || {};
    projectStore.setProject(normalizeSourceServerProject(selectedProject));
    await rememberProjectPath(project.value);
    resetAfterProjectChange();
    projectStore.setServiceStatus('connected');
    appUiStore.setToast(`已关联 ${project.value.name}`);
  }

  async function chooseProject() {
    appUiStore.setToast('正在选择项目...');
    try {
      await chooseProjectFromSourceServer();
      return;
    } catch (error) {
      projectStore.setServiceStatus('fallback', '', `${error.message || error}。请先运行 npm run source:server；当前将使用浏览器目录选择兜底，无法拿到真实路径。`);
    }

    if (window.showDirectoryPicker && window.isSecureContext) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        projectStore.setProject(await scanDirectoryHandle(handle));
        resetAfterProjectChange();
        projectStore.setServiceStatus(sourceServiceStatus.value, sourceServiceMessage.value, '');
        appUiStore.setToast(`已关联 ${project.value.name}`);
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') {
          appUiStore.setToast('已取消选择');
          return;
        }
        appUiStore.setToast('目录选择器不可用，改用文件夹输入');
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
    projectStore.setProject(await buildProjectFromFileList(files));
    resetAfterProjectChange();
    projectStore.setServiceStatus(sourceServiceStatus.value, sourceServiceMessage.value, '');
    appUiStore.setToast(`已关联 ${project.value.name}`);
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
