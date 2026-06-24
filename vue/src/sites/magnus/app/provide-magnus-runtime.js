import { provideMagnusCommands } from './MagnusAppProvider';
import { provideMagnusModules } from '../hooks/use-magnus-ctx';

export function provideMagnusRuntime(api, modules, actions) {
  const {
    source,
    route,
    search,
    selection,
    composer,
    model,
    message,
    prompt,
    toast
  } = modules;

  provideMagnusModules({
    source,
    route,
    search,
    selection,
    composer,
    model,
    message,
    prompt,
    toast,
    actions
  });

  const commands = {
    sendRequest: actions.sendComposer,
    resolveRoute: route.resolveCurrentPageRoute,
    selectProject: source.chooseProject,
    openSourceFile: actions.openSourceFile,
    copyPrompt: () => actions.copyTextWithToast(composer.promptText.value),
    expandSelection: actions.expandSelection,
    removeSelection: actions.removeSelection,
    clearSelections: actions.clearSelections
  };

  provideMagnusCommands(api.bootstrap?.createCommands?.(commands) || commands);
}
