import { computed } from 'vue';
import type { SelectionStore } from '../usecases/selection-command.deps';
import { useAppUiStore } from '../../stores/app-ui.store';

export function createSelectionFacade(store: SelectionStore) {
  const appUiStore = useAppUiStore();
  const selectedItems = computed(() => {
    return store.items.map(item => ({
      uid: item.uid,
      element: null,
      info: item.element || {},
      assetElement: null,
      assetInfo: item.asset || item.element || {},
      thumbnailUrl: item.thumbnailUrl || ''
    }));
  });

  const filesConfirmed = computed({
    get: () => store.filesConfirmed,
    set: value => { store.filesConfirmed = value; }
  });

  const selectionConfirmed = computed({
    get: () => store.confirmed,
    set: value => store.markConfirmed(value)
  });

  const customEvidence = computed({
    get: () => store.customEvidence,
    set: value => { store.customEvidence = value; }
  });

  const evidenceMessages = computed({
    get: () => store.evidenceMessages,
    set: value => { store.evidenceMessages = value; }
  });

  function selectionPayloads() {
    return store.items.map((item: any, index) => ({
      index: index + 1,
      token: `@选区${index + 1}`,
      element: item.element,
      asset: item.asset || null,
      sourceLocate: item.sourceLocate || item.element?.sourceLocate || null,
      thumbnailCaptured: !!item.thumbnailUrl
    }));
  }

  function confirmSelectionContext(invalidatePrompt?: () => void) {
    if (!store.hasSelection) return false;
    store.markConfirmed(true);
    store.filesConfirmed = false;
    invalidatePrompt?.();
    appUiStore.setToast('选区已确认');
    return true;
  }

  return {
    selectedItems,
    filesConfirmed,
    selectionConfirmed,
    customEvidence,
    evidenceMessages,
    selectionPayloads,
    confirmSelectionContext
  };
}
