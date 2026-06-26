import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useAppUiStore = defineStore('magnus.appUi', () => {
  const runtimeConnected = ref(false);
  const toastText = ref('');
  const toastTimer = ref<number | null>(null);

  function setRuntimeConnected(value: boolean) {
    runtimeConnected.value = !!value;
  }

  function setToast(text: string) {
    toastText.value = text || '';
    cleanupToastTimer();
    if (text) {
      toastTimer.value = window.setTimeout(() => {
        toastText.value = '';
        toastTimer.value = null;
      }, 1800);
    }
  }

  function cleanupToastTimer() {
    if (!toastTimer.value) return;
    clearTimeout(toastTimer.value);
    toastTimer.value = null;
  }

  function cleanupToast() {
    cleanupToastTimer();
    toastText.value = '';
  }

  return {
    runtimeConnected,
    toastText,
    setRuntimeConnected,
    setToast,
    cleanupToast
  };
});
