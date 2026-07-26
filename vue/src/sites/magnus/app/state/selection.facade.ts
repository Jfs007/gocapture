import { computed } from 'vue';
import type { SelectionStore } from '../usecases/selection-command.deps';
import type { SelectionSourceBinding } from '../types/selection.types';
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
      sourceBinding: item.sourceBinding || null,
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

  function referencedSelectionIds(instruction: string) {
    const value = String(instruction || '');
    const matches = Array.from(value.matchAll(/@(?:\[)?选区(?:(\d+))?(?:\])?/g));
    if (!matches.length) return [];
    if (matches.some(match => !match[1])) return store.items.map(item => item.uid);
    return Array.from(new Set(matches
      .map(match => store.items[Number(match[1]) - 1]?.uid || '')
      .filter(Boolean)));
  }

  function reusableSourceBindings(instruction: string, projectRoot: string) {
    const ids = referencedSelectionIds(instruction);
    if (!ids.length) return [];
    const bindings = ids.map(uid => ({
      uid,
      binding: store.sourceBinding(uid)
    }));
    if (bindings.some(item => {
      return !item.binding
        || item.binding.projectRoot !== projectRoot
        || !item.binding.targets.length;
    })) return [];
    return bindings as Array<{ uid: string; binding: SelectionSourceBinding }>;
  }

  function bindSourceContext(ids: string[], binding: SelectionSourceBinding) {
    for (const uid of ids) store.bindSourceContext(uid, {
      ...binding,
      selectionId: uid
    });
  }

  function bindAgentMeanings({
    meanings,
    providerId,
    threadId,
    projectRoot,
    designRequirement,
    changedFiles
  }: {
    meanings: Array<{ selectionId: string; meaning: string }>;
    providerId: string;
    threadId: string;
    projectRoot: string;
    designRequirement: string;
    changedFiles: string[];
  }) {
    for (const item of meanings || []) {
      const uid = String(item?.selectionId || '');
      const meaning = String(item?.meaning || '').trim();
      if (!uid || !meaning) continue;
      const fallbackBinding: SelectionSourceBinding = {
        selectionId: uid,
        projectRoot,
        designRequirement,
        targets: (changedFiles || []).map(file => ({ file, role: 'related' })),
        resolvedAt: Date.now()
      };
      store.bindAgentContext(uid, {
        providerId,
        threadId,
        meaning,
        updatedAt: Date.now()
      }, fallbackBinding);
    }
  }

  return {
    selectedItems,
    filesConfirmed,
    selectionConfirmed,
    customEvidence,
    evidenceMessages,
    selectionPayloads,
    confirmSelectionContext,
    referencedSelectionIds,
    reusableSourceBindings,
    bindSourceContext,
    bindAgentMeanings
  };
}
