import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { RuntimeSelectionPayload, SelectionAsset, SelectionId } from '../domain/selection/selection.types';

export const useSelectionStore = defineStore('magnus.selection', () => {
  const items = ref<SelectionAsset[]>([]);
  const activeId = ref<SelectionId | null>(null);
  const confirmed = ref(false);
  const filesConfirmed = ref(false);
  const customEvidence = ref('');
  const evidenceMessages = ref<string[]>([]);

  const latest = computed(() => items.value[items.value.length - 1] || null);
  const hasSelection = computed(() => items.value.length > 0);

  function mapRuntimeSelection(raw: RuntimeSelectionPayload, index: number): SelectionAsset {
    const element = raw?.element || raw?.info || raw || {};
    const uid = raw?.uid || element.uid || `remote-selection-${Date.now()}-${index}`;
    return {
      uid,
      element,
      asset: raw?.asset || element,
      thumbnailUrl: raw?.thumbnailUrl || raw?.thumbnail || '',
      thumbnailCaptured: !!(raw?.thumbnailUrl || raw?.thumbnail)
    };
  }

  function replaceSelections(rawSelections: RuntimeSelectionPayload[]) {
    items.value = (Array.isArray(rawSelections) ? rawSelections : []).map(mapRuntimeSelection);
    activeId.value = latest.value?.uid || null;
    confirmed.value = false;
    filesConfirmed.value = false;
  }

  function removeSelection(id: SelectionId) {
    items.value = items.value.filter(item => item.uid !== id);
    if (activeId.value === id) activeId.value = latest.value?.uid || null;
    confirmed.value = false;
    filesConfirmed.value = false;
  }

  function clear() {
    items.value = [];
    activeId.value = null;
    confirmed.value = false;
    filesConfirmed.value = false;
    customEvidence.value = '';
    evidenceMessages.value = [];
  }

  function setActive(id: SelectionId | null) {
    activeId.value = id;
  }

  function markConfirmed(value: boolean) {
    confirmed.value = value;
    if (!value) filesConfirmed.value = false;
  }

  return {
    items,
    activeId,
    confirmed,
    filesConfirmed,
    customEvidence,
    evidenceMessages,
    latest,
    hasSelection,
    replaceSelections,
    removeSelection,
    clear,
    setActive,
    markConfirmed
  };
});
