import type { SelectionCommandDeps } from './selection-command.deps';
import { useAppUiStore } from '../../stores/app-ui.store';
import { deleteProjectSelectionReferences } from '../services/selection-reference.service';

export function createClearSelectionsUseCase(deps: SelectionCommandDeps) {
  const appUiStore = useAppUiStore();
  return async function clearSelections(notifyRuntime = true) {
    await deleteProjectSelectionReferences(deps.context.getProjectRoot());
    if (notifyRuntime) deps.bridge.sendCommand('selection.clear');
    deps.selectionStore.clear();
    deps.context.resetCandidateState();
    deps.context.resetComposer();
    appUiStore.setToast('');
  };
}
