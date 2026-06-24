import { createPinia } from 'pinia';
import { createMagnusStores } from './dependencies';
import { createRuntimeEventHandler } from './usecases/handle-runtime-event.usecase';
import { createSendRequestUseCase } from './usecases/send-request.usecase';

export function createMagnusBootstrap() {
  const pinia = createPinia();
  const stores = createMagnusStores(pinia);
  const handleRuntimeEvent = createRuntimeEventHandler(stores);

  return {
    pinia,
    stores,
    handleRuntimeEvent,
    createCommands(legacy: {
      sendRequest(): Promise<void>;
      resolveRoute(): Promise<void>;
      selectProject(): Promise<void>;
      openSourceFile(file: string): Promise<void>;
      copyPrompt(): void;
      expandSelection(id: string): Promise<void>;
      removeSelection(id: string): Promise<void>;
      clearSelections(): Promise<void>;
    }) {
      return {
        sendRequest: createSendRequestUseCase(stores, legacy.sendRequest),
        resolveRoute: legacy.resolveRoute,
        selectProject: legacy.selectProject,
        openSourceFile: legacy.openSourceFile,
        copyPrompt: legacy.copyPrompt,
        expandSelection: legacy.expandSelection,
        removeSelection: legacy.removeSelection,
        clearSelections: legacy.clearSelections
      };
    }
  };
}
