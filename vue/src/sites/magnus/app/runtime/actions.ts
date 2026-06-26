import { sourceServerJson } from '../services/source-service';
import { createComposerWorkflow } from '../workflows/composer-workflow';
import type { MagnusActions, MagnusModules } from './context';

export function createMagnusActions(modules: MagnusModules): MagnusActions {
  const { source, search, selection, composer, model, toast } = modules;
  const workflow = createComposerWorkflow(modules);

  return {
    chooseProject: source.chooseProject,
    onFileInputChange: source.onFileInputChange,
    previewSelection: selection.previewSelection,
    restoreSelectionPreview: selection.restoreSelectionPreview,
    expandSelection: selection.expandSelection,
    removeSelection: selection.removeSelection,
    clearSelections: selection.clearSelections,
    onComposerInput: composer.onComposerInput,
    insertPromptAsset: composer.insertPromptAsset,
    sendComposer: workflow.sendComposer,
    openSourceFile: (file: string) => openSourceFile(file, toast),
    copyTextWithToast: (text: string) => copyTextWithToast(text, toast),
    toggleCandidateFile: (hit: any) => toggleCandidateFile(hit, search, selection),
    toggleCandidateDetail: (hit: any) => toggleCandidateDetail(hit, search),
    setIncludeApiEvidence: (value: boolean) => {
      search.includeApiEvidence.value = !!value;
    },
    onSearchOptionChange: () => search.clearCandidateState(selection.filesConfirmed),
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

async function openSourceFile(file: string, toast: any) {
  if (!file) return;
  try {
    await sourceServerJson('/api/source/open', {
      method: 'POST',
      body: { file },
      timeoutMs: 5000,
      timeoutMessage: '打开源码文件超时，请确认本地源码服务可用'
    });
    toast.setToast(`已打开 ${file}`);
  } catch (error: any) {
    toast.setToast(error.message || '打开源码文件失败');
  }
}

function toggleCandidateFile(hit: any, search: any, selection: any) {
  if (!hit) return;
  const selected = new Set(search.selectedCandidatePaths.value);
  if (selected.has(hit.file)) selected.delete(hit.file);
  else selected.add(hit.file);
  search.selectedCandidatePaths.value = Array.from(selected);
  search.invalidateCandidateConfirm(selection.filesConfirmed);
}

function toggleCandidateDetail(hit: any, search: any) {
  if (!hit) return;
  search.expandedCandidatePath.value = search.expandedCandidatePath.value === hit.file ? '' : hit.file;
}

function copyTextWithToast(text: string, toast: any) {
  copyText(text).then(ok => {
    toast.setToast(ok ? '已复制' : '复制失败');
  });
}

function copyText(text: string) {
  if (!text) return Promise.resolve(false);
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
