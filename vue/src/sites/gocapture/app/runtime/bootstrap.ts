import { createPinia } from 'pinia';
import { createGoCaptureStores } from './stores';
import { createRuntimeEventHandler } from '../usecases/handle-runtime-event.usecase';
import { createSendRequestUseCase } from '../usecases/send-request.usecase';

export function createGoCaptureBootstrap() {
  const pinia = createPinia();
  const stores = createGoCaptureStores(pinia);
  const handleRuntimeEvent = createRuntimeEventHandler(stores);

  return {
    pinia,
    stores,
    handleRuntimeEvent,
    createCommands(commands: Record<string, any> & {
      sendRequest(): Promise<void>;
    }) {
      return {
        ...commands,
        sendRequest: createSendRequestUseCase(stores, commands.sendRequest)
      };
    }
  };
}
