import type { SelectionCommandDeps } from './selection-command.deps';

export function createPreviewSelectionUseCase(deps: SelectionCommandDeps) {
  function previewSelection(asset: { uid?: string } | null | undefined) {
    deps.bridge.sendCommand('selection.highlight', { uid: asset?.uid || '' });
  }

  function restoreSelectionPreview() {
    deps.bridge.sendCommand('selection.highlight', { uid: '' });
  }

  return { previewSelection, restoreSelectionPreview };
}
