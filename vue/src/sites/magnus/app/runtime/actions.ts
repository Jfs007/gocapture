import { sourceServerJson } from '../services/source-service';
import { createComposerWorkflow } from '../workflows/composer-workflow';
import { useAppUiStore } from '../../stores/app-ui.store';
import type { MagnusActions, MagnusRuntimeState } from './context';

export function createMagnusActions(state: MagnusRuntimeState): MagnusActions {
  const { source, search, selection, composer, model } = state;
  const workflow = createComposerWorkflow(state);

  return {
    chooseProject: source.chooseProject,
    onFileInputChange: source.onFileInputChange,
    previewSelection: selection.previewSelection,
    restoreSelectionPreview: selection.restoreSelectionPreview,
    expandSelection: selection.expandSelection,
    removeSelection: selection.removeSelection,
    clearSelections: selection.clearSelections,
    sendComposer: workflow.sendComposer,
    openSourceFile,
    copyTextWithToast,
    toggleCandidateFile: (hit: any) => toggleCandidateFile(hit, search, selection),
    toggleCandidateDetail: (hit: any) => toggleCandidateDetail(hit, search),
    setIncludeApiEvidence: (value: boolean) => {
      search.includeApiEvidence.value = !!value;
    },
    onSearchOptionChange: () => search.clearCandidateState(),
    openModelEditor: model.openModelEditor,
    openProviderModelEditor: model.openProviderModelEditor,
    closeModelEditor: model.closeModelEditor,
    saveModelForm: model.saveModelForm,
    removeSelectedModel: model.removeSelectedModel,
    setSelectedModel: model.setSelectedModel,
    selectModelAndEnable: model.selectModelAndEnable,
    disableModelAssist: model.disableModelAssist,
    setUseModelAssist: model.setUseModelAssist,
    resetModelAssist: model.resetModelAssist,
    stopModelAssist: model.stopModelAssist
  };
}

async function openSourceFile(file: string, line?: number, column?: number) {
  if (!file) return;
  const appUiStore = useAppUiStore();
  try {
    await sourceServerJson('/api/source/open', {
      method: 'POST',
      body: { file, line: Number(line) > 0 ? line : undefined, column: Number(column) > 0 ? column : undefined },
      timeoutMs: 5000,
      timeoutMessage: '打开源码文件超时，请确认本地源码服务可用'
    });
    appUiStore.setToast(`已打开 ${file}`);
  } catch (error: any) {
    appUiStore.setToast(error.message || '打开源码文件失败');
  }
}

function toggleCandidateFile(hit: any, search: any, selection: any) {
  if (!hit) return;
  const selected = new Set(search.selectedCandidatePaths.value);
  if (selected.has(hit.file)) selected.delete(hit.file);
  else selected.add(hit.file);
  search.selectedCandidatePaths.value = Array.from(selected);
  search.invalidateCandidateConfirm();
}

function toggleCandidateDetail(hit: any, search: any) {
  if (!hit) return;
  search.expandedCandidatePath.value = search.expandedCandidatePath.value === hit.file ? '' : hit.file;
}

function copyTextWithToast(text: string) {
  const appUiStore = useAppUiStore();
  copyText(text).then(ok => {
    appUiStore.setToast(ok ? '已复制' : '复制失败');
  });
}

function copyText(text: string) {
  if (!text) return Promise.resolve(false);
  return copyTextByHost(text)
    .catch(() => false)
    .then(ok => ok || copyTextInFrame(text));
}

function copyTextByHost(text: string) {
  if (!window.parent || window.parent === window) return Promise.resolve(false);
  return new Promise<boolean>(resolve => {
    const requestId = `magnus-clipboard-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timer);
    };
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };
    const handleMessage = (event: MessageEvent) => {
      const message = event.data || {};
      if (message?.type !== 'magnus.clipboard.result' || message.requestId !== requestId) return;
      done(!!message.ok);
    };
    const timer = window.setTimeout(() => done(false), 3000);
    window.addEventListener('message', handleMessage);
    window.parent.postMessage({
      type: 'magnus.clipboard.write',
      requestId,
      text
    }, '*');
  });
}

function copyTextInFrame(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  return new Promise(resolve => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (error) {
      ok = false;
    }
    textarea.parentNode?.removeChild(textarea);
    resolve(ok);
  });
}
