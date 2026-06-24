import type { BridgeClient } from '../../infrastructure/bridge/bridge-client';

export function createExpandSelectionUseCase(bridge: BridgeClient) {
  return async function expandSelection(id: string) {
    if (!id) return;
    bridge.sendCommand('selection.expand', { uid: id });
  };
}
