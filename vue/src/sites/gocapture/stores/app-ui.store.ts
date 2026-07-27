import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useAppUiStore = defineStore('gocapture.appUi', () => {
  const runtimeConnected = ref(false);
  const serviceOnline = ref<boolean | null>(null);   // null=未探测，true=在线，false=本地服务未启动
  const serviceHealthMessage = ref('');
  const serviceHealthUrl = ref('');
  const mcpPanelOpen = ref(false);
  const toastText = ref('');
  const toastTimer = ref<number | null>(null);

  function setRuntimeConnected(value: boolean) {
    runtimeConnected.value = !!value;
  }

  function setServiceOnline(value: boolean | null, message = '', url = '') {
    serviceOnline.value = value;
    serviceHealthMessage.value = message || '';
    serviceHealthUrl.value = url || '';
  }

  function setMcpPanelOpen(value: boolean) {
    mcpPanelOpen.value = !!value;
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
    serviceOnline,
    serviceHealthMessage,
    serviceHealthUrl,
    mcpPanelOpen,
    toastText,
    setRuntimeConnected,
    setServiceOnline,
    setMcpPanelOpen,
    setToast,
    cleanupToast
  };
});
