import type { MagnusStores } from '../dependencies';
import type { BridgeClient } from '../../infrastructure/bridge/bridge-client';

export function createClearSelectionsUseCase(stores: MagnusStores, bridge: BridgeClient) {
  return async function clearSelections() {
    bridge.sendCommand('selection.clear');
    stores.selectionStore.clear();
    stores.searchStore.reset();
    stores.composerStore.clearContent();
    stores.composerStore.setFinalPrompt('');
  };
}
