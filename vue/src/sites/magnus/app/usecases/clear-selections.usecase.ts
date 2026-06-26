import type { SelectionCommandDeps } from './selection-command.deps';
import { useAppUiStore } from '../../stores/app-ui.store';

export function createClearSelectionsUseCase(deps: SelectionCommandDeps) {
  const appUiStore = useAppUiStore();
  return async function clearSelections(notifyRuntime = true) {
    if (notifyRuntime) deps.bridge.sendCommand('selection.clear');
    deps.selectionStore.clear();
    deps.context.resetCandidateState();
    deps.context.resetComposer();
    appUiStore.setToast('');
  };
}
