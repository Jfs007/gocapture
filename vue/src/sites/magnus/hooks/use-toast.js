import { ref } from 'vue';

export function useToast() {
  const toastText = ref('');
  const toastTimer = ref(0);

  function setToast(message) {
    toastText.value = message || '';
    if (toastTimer.value) clearTimeout(toastTimer.value);
    if (message) {
      toastTimer.value = window.setTimeout(() => {
        toastText.value = '';
      }, 1800);
    }
  }

  function cleanupToast() {
    if (toastTimer.value) clearTimeout(toastTimer.value);
    toastTimer.value = 0;
  }

  return {
    toastText,
    setToast,
    cleanupToast
  };
}
