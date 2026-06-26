import { provideMagnusCommands } from './commands';
import type { MagnusActions, MagnusModules } from './context';

export function provideMagnusRuntime(api: Record<string, any>, modules: MagnusModules, actions: MagnusActions) {
  const { source, route, composer } = modules;

  const commands = {
    sendRequest: actions.sendComposer,
    resolveRoute: route.resolveCurrentPageRoute,
    selectProject: source.chooseProject,
    openSourceFile: actions.openSourceFile,
    copyPrompt: () => actions.copyTextWithToast(composer.promptText.value),
    copyText: actions.copyTextWithToast,
    previewSelection: actions.previewSelection,
    restoreSelectionPreview: actions.restoreSelectionPreview,
    expandSelection: actions.expandSelection,
    removeSelection: actions.removeSelection,
    clearSelections: actions.clearSelections,
    toggleCandidateFile: actions.toggleCandidateFile,
    toggleCandidateDetail: actions.toggleCandidateDetail,
    setIncludeApiEvidence: actions.setIncludeApiEvidence,
    onSearchOptionChange: actions.onSearchOptionChange,
    openModelEditor: actions.openModelEditor,
    openProviderModelEditor: actions.openProviderModelEditor,
    closeModelEditor: actions.closeModelEditor,
    saveModelForm: actions.saveModelForm,
    removeSelectedModel: actions.removeSelectedModel,
    setSelectedModel: actions.setSelectedModel,
    selectModelAndEnable: actions.selectModelAndEnable,
    disableModelAssist: actions.disableModelAssist,
    setUseModelAssist: actions.setUseModelAssist,
    resetModelAssist: actions.resetModelAssist,
    stopModelAssist: actions.stopModelAssist
  };

  provideMagnusCommands(api.bootstrap?.createCommands?.(commands) || commands);
}
