import { computed } from 'vue';
import type { useComposerStore } from '../../stores/composer.store';

export type ComposerStore = ReturnType<typeof useComposerStore>;

export function createComposerFacade(store: ComposerStore) {
  const promptIntent = computed({
    get: () => store.content,
    set: value => store.setContent(String(value || ''))
  });

  const promptText = computed({
    get: () => store.finalPrompt,
    set: value => store.setFinalPrompt(String(value || ''))
  });

  function invalidatePrompt() {
    store.setFinalPrompt('');
  }

  function resetPromptComposer() {
    store.setFinalPrompt('');
    store.clearContent();
  }

  return {
    promptIntent,
    promptText,
    invalidatePrompt,
    resetPromptComposer
  };
}
