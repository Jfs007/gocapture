import type { MagnusStores } from '../dependencies';
import type { BridgeClient } from '../../infrastructure/bridge/bridge-client';

export function createRemoveSelectionUseCase(stores: MagnusStores, bridge: BridgeClient) {
  return async function removeSelection(id: string) {
    if (!id) return;
    bridge.sendCommand('selection.remove', { uid: id });
    stores.selectionStore.removeSelection(id);
    stores.searchStore.reset();
  };
}
