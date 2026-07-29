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

  function selectionPayloads(instruction = '') {
    const ids = new Set(referencedSelectionIds(instruction));
    return store.items.map((item: any, index) => ({
      uid: item.uid,
      selectionId: item.uid,
      index: index + 1,
      token: `@选区${index + 1}`,
      element: item.element,
      asset: item.asset || null,
      sourceLocate: item.sourceLocate || item.element?.sourceLocate || null,
      thumbnailCaptured: !!item.thumbnailUrl
    })).filter(item => ids.has(item.uid));
  }

  function selectionThumbnails(instruction = '') {
    const ids = new Set(referencedSelectionIds(instruction));
    return store.items
      .filter(item => item.thumbnailUrl && ids.has(item.uid))
      .map(item => ({
        selectionId: item.uid,
        thumbnail: item.thumbnailUrl || ''
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
    const activeId = store.activeId || store.items[store.items.length - 1]?.uid || '';
    if (!matches.length) return [];
    if (matches.some(match => !match[1])) return activeId ? [activeId] : [];
    return Array.from(new Set(matches
      .map(match => store.items[Number(match[1]) - 1]?.uid || '')
      .filter(Boolean)));
  }

  function reusableSourceBindings(instruction: string, projectRoot: string) {
    const ids = referencedSelectionIds(instruction);
    if (!ids.length) return [];
    const bindings = ids.map(uid => {
      const index = store.items.findIndex(item => item.uid === uid);
      return {
        uid,
        index: index + 1,
        token: index >= 0 ? `@选区${index + 1}` : '',
        binding: store.sourceBinding(uid)
      };
    });
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

  function restoreLocationReferences(references: any[], projectRoot: string) {
    store.restoreLocationReferences(references, projectRoot);
  }

  function bindAgentLocations({
    references,
    projectRoot,
    designRequirement,
  }: {
    references: Array<{
      selectionId: string;
      locations: Array<{
        file: string;
        startLine: number;
        endLine: number;
        anchor: string;
        source?: string;
      }>;
    }>;
    projectRoot: string;
    designRequirement: string;
  }) {
    for (const item of references || []) {
      const uid = String(item?.selectionId || '');
      const targets = (Array.isArray(item?.locations) ? item.locations : [])
        .map(location => ({
          file: String(location?.file || '').trim(),
          role: 'render',
          line: Number(location?.startLine || 0),
          endLine: Number(location?.endLine || location?.startLine || 0),
          anchor: String(location?.anchor || '').trim(),
          source: String(location?.source || ''),
          targetSnippet: String(location?.source || ''),
        }))
        .filter(location => location.file);
      if (!uid || !targets.length) continue;
      store.bindSourceContext(uid, {
        selectionId: uid,
        projectRoot,
        designRequirement,
        targets,
        resolvedAt: Date.now()
      });
    }
  }

  return {
    selectedItems,
    filesConfirmed,
    selectionConfirmed,
    customEvidence,
    evidenceMessages,
    selectionPayloads,
    selectionThumbnails,
    confirmSelectionContext,
    referencedSelectionIds,
    reusableSourceBindings,
    bindSourceContext,
    restoreLocationReferences,
    bindAgentLocations
  };
}
