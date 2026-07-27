import type { GoCaptureStores } from '../runtime/stores';

export function createSendRequestUseCase(stores: GoCaptureStores, runComposerWorkflow: () => Promise<void>) {
  return async function sendRequest() {
    stores.composerStore.setSending(true);
    try {
      await runComposerWorkflow();
    } finally {
      stores.composerStore.setSending(false);
    }
  };
}
