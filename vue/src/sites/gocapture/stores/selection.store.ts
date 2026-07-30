import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  RuntimeSelectionPayload,
  SelectionAsset,
  SelectionId,
  SelectionSourceBinding
} from '../app/types/selection.types';
import { compactText } from '../app/utils/text';

export const useSelectionStore = defineStore('gocapture.selection', () => {
  const items = ref<SelectionAsset[]>([]);
  const activeId = ref<SelectionId | null>(null);
  const confirmed = ref(false);
  const filesConfirmed = ref(false);
  const customEvidence = ref('');
  const evidenceMessages = ref<string[]>([]);

  const latest = computed(() => items.value[items.value.length - 1] || null);
  const hasSelection = computed(() => items.value.length > 0);
  const promptAssets = computed(() => {
    return items.value.map((item: any, index) => {
      const info = item.element || {};
      const assetInfo = item.asset || info;
      return {
        uid: item.uid,
        createdAt: item.createdAt || 0,
        token: `@选区${index + 1}`,
        index: index + 1,
        label: `选区 ${index + 1}`,
        summary: compactText(info.text || info.className || info.tag || assetInfo.text || `选区${index + 1}`, 24),
        thumbnailUrl: item.thumbnailUrl || '',
        className: info.className || '',
        text: info.text || '',
        selector: info.selector || '',
        innerHtml: info.innerHtml || '',
        outerHtml: info.outerHtml || '',
        inlineStyle: info.inlineStyle || '',
        computedStyle: info.computedStyle || null,
        box: info.box || null,
        assetSelector: assetInfo.selector || '',
        assetText: assetInfo.text || '',
        assetInnerHtml: assetInfo.innerHtml || '',
        assetOuterHtml: assetInfo.outerHtml || '',
        assetInlineStyle: assetInfo.inlineStyle || '',
        assetComputedStyle: assetInfo.computedStyle || null,
        assetBox: assetInfo.box || null,
        sourceBinding: item.sourceBinding || null,
        thumbnailCaptured: !!item.thumbnailUrl
      };
    });
  });

  function mapRuntimeSelection(
    raw: RuntimeSelectionPayload,
    index: number,
    previous?: SelectionAsset
  ): SelectionAsset {
    const element = raw?.element || raw?.info || raw || {};
    const uid = raw?.uid || element.uid || `remote-selection-${Date.now()}-${index}`;
    const thumbnailUrl = raw?.thumbnailUrl || raw?.thumbnail || previous?.thumbnailUrl || '';
    return {
      uid,
      createdAt: Number(raw?.createdAt || raw?.capturedAt || previous?.createdAt || Date.now()),
      pageBindingId: raw?.pageBindingId || (raw as any)?.workspaceId || previous?.pageBindingId || '',
      element,
      originalElement: raw?.originalElement || previous?.originalElement || element,
      asset: raw?.asset || element,
      sourceLocate: raw?.sourceLocate || raw?.sourceEvidence || element.sourceLocate || null,
      sourceBinding: raw?.sourceBinding || previous?.sourceBinding || null,
      thumbnailUrl,
      thumbnailCaptured: !!thumbnailUrl
    };
  }

  function replaceSelections(rawSelections: RuntimeSelectionPayload[]) {
    const previousById = new Map(items.value.map(item => [item.uid, item]));
    items.value = (Array.isArray(rawSelections) ? rawSelections : []).map((raw, index) => {
      const element = raw?.element || raw?.info || raw || {};
      const uid = raw?.uid || element.uid || '';
      return mapRuntimeSelection(raw, index, uid ? previousById.get(uid) : undefined);
    });
    activeId.value = latest.value?.uid || null;
    confirmed.value = false;
    filesConfirmed.value = false;
  }

  function bindSourceContext(id: SelectionId, binding: SelectionSourceBinding) {
    const item = items.value.find(selection => selection.uid === id);
    if (!item) return false;
    item.sourceBinding = binding;
    return true;
  }

  function restoreLocationReferences(references: Array<{
    selectionId: string;
    thumbnail?: string;
    locations: Array<{
      file: string;
      startLine: number;
      endLine: number;
      anchor: string;
      source?: string;
    }>;
  }>, projectRoot: string) {
    for (const reference of references) {
      const uid = String(reference?.selectionId || '').trim();
      const targets = (Array.isArray(reference?.locations) ? reference.locations : [])
        .map(location => ({
          file: String(location?.file || '').trim(),
          role: 'render',
          line: Number(location?.startLine || 0),
          endLine: Number(location?.endLine || location?.startLine || 0),
          anchor: String(location?.anchor || '').trim(),
          source: String(location?.source || ''),
          targetSnippet: String(location?.source || '')
        }))
        .filter(location => location.file && (location.line || location.anchor));
      if (!uid || !targets.length) continue;
      const existing = items.value.find(item => item.uid === uid);
      const sourceBinding = {
        selectionId: uid,
        projectRoot,
        designRequirement: '',
        targets,
        resolvedAt: Date.now()
      } as SelectionSourceBinding;
      if (existing) {
        existing.sourceBinding = sourceBinding;
        if (reference.thumbnail) existing.thumbnailUrl = reference.thumbnail;
        continue;
      }
      const first = targets[0];
      items.value.push(mapRuntimeSelection({
        uid,
        element: {
          tag: 'source',
          className: '',
          text: first.anchor || first.file,
          selector: first.file
        },
        sourceBinding,
        thumbnailUrl: reference.thumbnail || ''
      } as any, items.value.length));
    }
    activeId.value = latest.value?.uid || null;
  }

  function sourceBinding(id: SelectionId) {
    return items.value.find(selection => selection.uid === id)?.sourceBinding || null;
  }

  function bindAgentContext(
    id: SelectionId,
    context: NonNullable<SelectionSourceBinding['agentContext']>,
    fallbackBinding?: SelectionSourceBinding
  ) {
    const item = items.value.find(selection => selection.uid === id);
    if (!item) return false;
    item.sourceBinding = {
      ...(item.sourceBinding || fallbackBinding),
      selectionId: id,
      agentContext: context
    } as SelectionSourceBinding;
    return true;
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
    promptAssets,
    replaceSelections,
    bindSourceContext,
    restoreLocationReferences,
    bindAgentContext,
    sourceBinding,
    removeSelection,
    clear,
    setActive,
    markConfirmed
  };
});
