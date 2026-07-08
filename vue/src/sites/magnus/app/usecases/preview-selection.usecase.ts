import type { SelectionCommandDeps } from './selection-command.deps';

export function createPreviewSelectionUseCase(deps: SelectionCommandDeps) {
  function previewSelection(asset: { uid?: string } | null | undefined) {
    const uid = asset?.uid || '';
    const selection = deps.selectionStore.items.find(item => item.uid === uid);
    deps.bridge.sendCommand('selection.highlight', { uid }, {
      pageBindingId: selection?.pageBindingId || ''
    });
  }

  function restoreSelectionPreview() {
    deps.bridge.sendCommand('selection.highlight', { uid: '' });
  }

  return { previewSelection, restoreSelectionPreview };
}
