import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { PageRequest } from '../app/types/page-request.types';
import { compactText, escapeRegExp } from '../app/utils/text';

export const useRequestStore = defineStore('gocapture.request', () => {
  const items = ref<PageRequest[]>([]);
  const enabled = ref(true);

  const recent = computed(() => enabled.value ? items.value.slice(0, 5) : []);

  function apiResponseValues() {
    const values = items.value
      .slice(0, 8)
      .flatMap(item => item.responseValues || [])
      .map(value => String(value || '').replace(/\s+/g, ' ').trim())
      .filter(value => value.length >= 2 && value.length <= 80);
    return Array.from(new Set(values)).sort((a, b) => b.length - a.length).slice(0, 180);
  }

  function denoiseTextByApi(text: string, limit = 140) {
    let value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';
    for (const dynamicValue of apiResponseValues()) {
      if (!dynamicValue || dynamicValue.length < 2) continue;
      value = value.replace(new RegExp(escapeRegExp(dynamicValue), 'g'), ' ');
    }
    value = value
      .replace(/\bY\d{4}M\d{2}\b/g, ' ')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
      .replace(/\b\d{2}-\d{2}\b/g, ' ')
      .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return compactText(value, limit);
  }

  function remember(request: PageRequest) {
    if (!request?.url && !request?.pathname) return;
    const key = `${request.method || 'GET'} ${request.url || request.pathname}`;
    items.value = [
      request,
      ...items.value.filter(item => `${item.method || 'GET'} ${item.url || item.pathname}` !== key)
    ].slice(0, 40);
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
    denoiseTextByApi,
    remember,
    clear,
    setEnabled
  };
});
