import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useAppUiStore = defineStore('magnus.appUi', () => {
  const runtimeConnected = ref(false);
  const toastText = ref('');

  function setRuntimeConnected(value: boolean) {
    runtimeConnected.value = !!value;
  }

  function setToast(text: string) {
    toastText.value = text || '';
  }

  return {
    runtimeConnected,
    toastText,
    setRuntimeConnected,
    setToast
  };
});
