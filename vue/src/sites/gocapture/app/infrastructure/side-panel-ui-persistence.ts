import { watch, type Ref } from 'vue';
import { useComposerStore } from '../../stores/composer.store';

const CURRENT_KEY = 'gocapture:sidepanel-ui:current';
const PAGE_KEY_PREFIX = 'gocapture:sidepanel-ui:page:';

interface PersistedUiState {
  content?: string;
  finalPrompt?: string;
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
  if (!composerStore.content && state.content) {
    composerStore.setContent(state.content);
  }
  if (!composerStore.finalPrompt && state.finalPrompt) {
    composerStore.setFinalPrompt(state.finalPrompt);
  }
}

function currentState(): PersistedUiState {
  const composerStore = useComposerStore();
  return {
    content: composerStore.content,
    finalPrompt: composerStore.finalPrompt
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
