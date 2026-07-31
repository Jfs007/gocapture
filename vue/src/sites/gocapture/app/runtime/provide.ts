import { provideGoCaptureCommands } from './commands';
import type { GoCaptureActions, GoCaptureRuntimeState } from './context';

export function provideGoCaptureRuntime(api: Record<string, any>, state: GoCaptureRuntimeState, actions: GoCaptureActions) {
  const { source, route, composer } = state;

  const commands = {
    sendRequest: actions.sendComposer,
    resolveRoute: route.resolveCurrentPageRoute,
    selectProject: source.chooseProject,
    openSourceFile: actions.openSourceFile,
    openSettings: actions.openSettings,
    rebindSidePanel: actions.rebindSidePanel,
    copyPrompt: () => actions.copyTextWithToast(composer.promptText.value),
    copyText: actions.copyTextWithToast,
    previewSelection: actions.previewSelection,
    restoreSelectionPreview: actions.restoreSelectionPreview,
    expandSelection: actions.expandSelection,
    removeSelection: actions.removeSelection,
    clearSelections: actions.clearSelections
  };

  provideGoCaptureCommands(api.bootstrap?.createCommands?.(commands) || commands);
}
