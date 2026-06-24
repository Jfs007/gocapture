import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export const useComposerStore = defineStore('magnus.composer', () => {
  const content = ref('');
  const finalPrompt = ref('');
  const isSending = ref(false);
  const mentionMenuVisible = ref(false);

  const trimmedContent = computed(() => content.value.trim());

  function setContent(value: string) {
    content.value = String(value || '');
    if (finalPrompt.value) finalPrompt.value = '';
  }

  function insertSelectionMention(token: string) {
    const normalized = String(token || '').trim();
    if (!normalized) return;
    const prefix = !content.value || /\s$/.test(content.value) ? '' : ' ';
    content.value = `${content.value}${prefix}${normalized} `;
  }

  function setSending(value: boolean) {
    isSending.value = !!value;
  }

  function setFinalPrompt(value: string) {
    finalPrompt.value = String(value || '');
  }

  function clearContent() {
    content.value = '';
  }

  return {
    content,
    finalPrompt,
    isSending,
    mentionMenuVisible,
    trimmedContent,
    setContent,
    insertSelectionMention,
    setSending,
    setFinalPrompt,
    clearContent
  };
});
