import type { MagnusStores } from '../runtime/stores';

export function createSendRequestUseCase(stores: MagnusStores, runComposerWorkflow: () => Promise<void>) {
  return async function sendRequest() {
    stores.composerStore.setSending(true);
    try {
      await runComposerWorkflow();
    } finally {
      stores.composerStore.setSending(false);
    }
  };
}
