import { createPinia } from 'pinia';
import { createMagnusStores } from './stores';
import { createRuntimeEventHandler } from '../usecases/handle-runtime-event.usecase';
import { createSendRequestUseCase } from '../usecases/send-request.usecase';

export function createMagnusBootstrap() {
  const pinia = createPinia();
  const stores = createMagnusStores(pinia);
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
