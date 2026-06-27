import { watch, type Ref } from 'vue';
import { useComposerStore } from '../../stores/composer.store';
import { useSelectionStore } from '../../stores/selection.store';

const CURRENT_KEY = 'magnus:sidepanel-ui:current';
const PAGE_KEY_PREFIX = 'magnus:sidepanel-ui:page:';
const MAX_SELECTIONS = 12;

interface PersistedUiState {
  content?: string;
  finalPrompt?: string;
  selections?: unknown[];
  savedAt?: number;
}

function storageKey(href: string) {
  const value = String(href || '').trim();
  return value ? `${PAGE_KEY_PREFIX}${value}` : CURRENT_KEY;
}

function readState(key: string): PersistedUiState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch (error) {
    return null;
  }
}

function writeState(key: string, state: PersistedUiState) {
  try {
    const payload = JSON.stringify({
      ...state,
      savedAt: Date.now()
    });
    window.localStorage.setItem(key, payload);
    window.localStorage.setItem(CURRENT_KEY, payload);
  } catch (error) {
  }
}

function restoreState(state: PersistedUiState | null) {
  if (!state) return;
  const composerStore = useComposerStore();
  const selectionStore = useSelectionStore();
  if (!composerStore.content && state.content) {
    composerStore.setContent(state.content);
  }
  if (!composerStore.finalPrompt && state.finalPrompt) {
    composerStore.setFinalPrompt(state.finalPrompt);
  }
  if (!selectionStore.items.length && Array.isArray(state.selections) && state.selections.length) {
    selectionStore.replaceSelections(state.selections as any[]);
  }
}

function currentState(): PersistedUiState {
  const composerStore = useComposerStore();
  const selectionStore = useSelectionStore();
  return {
    content: composerStore.content,
    finalPrompt: composerStore.finalPrompt,
    selections: selectionStore.items.slice(0, MAX_SELECTIONS)
  };
}

export function useSidePanelUiPersistence(currentPageHref: Ref<string>) {
  let restoredKey = '';

  function restoreForCurrentPage() {
    const key = storageKey(currentPageHref.value);
    if (restoredKey === key) return;
    restoredKey = key;
    restoreState(readState(key) || readState(CURRENT_KEY));
  }

  restoreForCurrentPage();

  watch(currentPageHref, restoreForCurrentPage);
  watch(currentState, state => {
    writeState(storageKey(currentPageHref.value), state);
  }, { deep: true });
}
