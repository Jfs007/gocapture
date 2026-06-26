import { computed, ref } from 'vue';
import { compactText } from '../../core/element-context';

interface SelectionModuleOptions {
  sendCommand: (type: string, payload?: unknown) => void;
  getPromptIntent: () => string;
  resetCandidateState: () => void;
  resetComposer: () => void;
  setToast: (message: string) => void;
}

export function useSelectionModule({
  sendCommand,
  getPromptIntent,
  resetCandidateState,
  resetComposer,
  setToast
}: SelectionModuleOptions) {
  const selectedItems = ref<any[]>([]);
  const layoutTick = ref(0);
  const selectionConfirmed = ref(false);
  const filesConfirmed = ref(false);
  const customEvidence = ref('');
  const evidenceMessages = ref<string[]>([]);

  const latestSelection = computed(() => selectedItems.value[selectedItems.value.length - 1] || null);
  const canConfirmSelection = computed(() => selectedItems.value.length > 0);

  const promptAssets = computed(() => {
    return selectedItems.value.map((item, index) => ({
      uid: item.uid,
      token: `@选区${index + 1}`,
      index: index + 1,
      label: `选区 ${index + 1}`,
      summary: compactText(item.info?.text || item.info?.className || item.info?.tag || item.assetInfo?.text || `选区${index + 1}`, 24),
      thumbnailUrl: item.thumbnailUrl || '',
      className: item.info?.className || '',
      text: item.info?.text || '',
      selector: item.info?.selector || '',
      innerHtml: item.info?.innerHtml || '',
      outerHtml: item.info?.outerHtml || '',
      inlineStyle: item.info?.inlineStyle || '',
      computedStyle: item.info?.computedStyle || null,
      box: item.info?.box || null,
      assetSelector: item.assetInfo?.selector || '',
      assetText: item.assetInfo?.text || '',
      assetInnerHtml: item.assetInfo?.innerHtml || '',
      assetOuterHtml: item.assetInfo?.outerHtml || '',
      assetInlineStyle: item.assetInfo?.inlineStyle || '',
      assetComputedStyle: item.assetInfo?.computedStyle || null,
      assetBox: item.assetInfo?.box || null,
      thumbnailCaptured: !!item.thumbnailUrl
    }));
  });

  function selectionPayloads() {
    return selectedItems.value.map((item, index) => ({
      index: index + 1,
      token: `@选区${index + 1}`,
      element: item.info,
      asset: item.assetInfo || null,
      thumbnailCaptured: !!item.thumbnailUrl
    }));
  }

  function selectionFromRemote(raw: any, index: number) {
    const info = raw?.element || raw?.info || raw || {};
    const uid = raw?.uid || info.uid || `remote-selection-${Date.now()}-${index}`;
    return {
      uid,
      element: null,
      info,
      assetElement: null,
      assetInfo: raw?.asset || info,
      thumbnailUrl: raw?.thumbnailUrl || raw?.thumbnail || ''
    };
  }

  function applyRemoteSelections(rawSelections: unknown) {
    const list = Array.isArray(rawSelections) ? rawSelections : [];
    selectedItems.value = list.map(selectionFromRemote);
  }

  function invalidateSelectionConfirm() {
    selectionConfirmed.value = false;
    filesConfirmed.value = false;
    resetCandidateState?.();
  }

  function confirmSelectionContext(invalidatePrompt?: () => void) {
    if (!canConfirmSelection.value) return false;
    selectionConfirmed.value = true;
    filesConfirmed.value = false;
    invalidatePrompt?.();
    setToast('选区已确认');
    return true;
  }

  function previewSelection(item: any) {
    sendCommand('selection.highlight', { uid: item?.uid || '' });
  }

  function restoreSelectionPreview() {
    sendCommand('selection.highlight', { uid: '' });
  }

  function expandSelection(uid: string) {
    if (!uid) return;
    sendCommand('selection.expand', { uid });
  }

  function removeSelection(uid: string) {
    const index = selectedItems.value.findIndex(item => item.uid === uid);
    if (index === -1) return;
    sendCommand('selection.remove', { uid });
    selectedItems.value.splice(index, 1);
    invalidateSelectionConfirm();
    window.__MAGNUS_SELECTIONS__ = selectionPayloads();
    setToast(String(getPromptIntent?.() || '').includes('@选区')
      ? '已移除选区，请检查输入框中的 @选区 引用'
      : '已移除选区');
    layoutTick.value++;
  }

  function clearSelections(notifyRuntime = true) {
    if (notifyRuntime) sendCommand('selection.clear');
    selectedItems.value = [];
    selectionConfirmed.value = false;
    customEvidence.value = '';
    evidenceMessages.value = [];
    resetCandidateState?.();
    resetComposer?.();
    window.__MAGNUS_LAST_ELEMENT__ = null;
    window.__MAGNUS_LAST_ELEMENT_INFO__ = null;
    window.__MAGNUS_SELECTIONS__ = [];
    setToast('');
  }

  return {
    selectedItems,
    layoutTick,
    selectionConfirmed,
    filesConfirmed,
    customEvidence,
    evidenceMessages,
    latestSelection,
    canConfirmSelection,
    promptAssets,
    selectionPayloads,
    selectionFromRemote,
    applyRemoteSelections,
    invalidateSelectionConfirm,
    confirmSelectionContext,
    previewSelection,
    restoreSelectionPreview,
    expandSelection,
    removeSelection,
    clearSelections
  };
}
