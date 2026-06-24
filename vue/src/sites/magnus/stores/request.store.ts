import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { PageRequest } from '../domain/request/page-request.types';

export const useRequestStore = defineStore('magnus.request', () => {
  const items = ref<PageRequest[]>([]);
  const enabled = ref(true);

  const recent = computed(() => enabled.value ? items.value.slice(0, 5) : []);

  function remember(request: PageRequest) {
    if (!request?.url && !request?.pathname) return;
    const key = `${request.method || 'GET'} ${request.url || request.pathname}`;
    items.value = [
      request,
      ...items.value.filter(item => `${item.method || 'GET'} ${item.url || item.pathname}` !== key)
    ].slice(0, 30);
  }

  function clear() {
    items.value = [];
  }

  function setEnabled(value: boolean) {
    enabled.value = !!value;
  }

  return {
    items,
    enabled,
    recent,
    remember,
    clear,
    setEnabled
  };
});
