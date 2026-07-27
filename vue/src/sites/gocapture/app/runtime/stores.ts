import type { Pinia } from 'pinia';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useChatStore } from '../../stores/chat.store';
import { useComposerStore } from '../../stores/composer.store';
import { useModelStore } from '../../stores/model.store';
import { useProjectStore } from '../../stores/project.store';
import { useRequestStore } from '../../stores/request.store';
import { useRouteStore } from '../../stores/route.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';

export function createGoCaptureStores(pinia: Pinia) {
  return {
    appUiStore: useAppUiStore(pinia),
    chatStore: useChatStore(pinia),
    composerStore: useComposerStore(pinia),
    modelStore: useModelStore(pinia),
    projectStore: useProjectStore(pinia),
    requestStore: useRequestStore(pinia),
    routeStore: useRouteStore(pinia),
    searchStore: useSearchStore(pinia),
    selectionStore: useSelectionStore(pinia)
  };
}

export type GoCaptureStores = ReturnType<typeof createGoCaptureStores>;
