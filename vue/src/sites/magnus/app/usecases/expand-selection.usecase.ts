import type { SelectionCommandDeps } from './selection-command.deps';

export function createExpandSelectionUseCase(deps: SelectionCommandDeps) {
  return async function expandSelection(uid: string) {
    if (!uid) return;
    deps.bridge.sendCommand('selection.expand', { uid });
  };
}
