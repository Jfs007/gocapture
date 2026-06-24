import type { MagnusStores } from '../dependencies';

export function createSendRequestUseCase(stores: MagnusStores, legacySend: () => Promise<void>) {
  return async function sendRequest() {
    stores.composerStore.setSending(true);
    try {
      await legacySend();
    } finally {
      stores.composerStore.setSending(false);
    }
  };
}
