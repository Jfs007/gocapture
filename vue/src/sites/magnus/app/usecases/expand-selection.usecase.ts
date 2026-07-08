import type { SelectionCommandDeps } from './selection-command.deps';

export function createExpandSelectionUseCase(deps: SelectionCommandDeps) {
  return async function expandSelection(uid: string) {
    if (!uid) return;
    const selection = deps.selectionStore.items.find(item => item.uid === uid);
    deps.bridge.sendCommand('selection.expand', { uid }, {
      pageBindingId: selection?.pageBindingId || ''
    });
  };
}
