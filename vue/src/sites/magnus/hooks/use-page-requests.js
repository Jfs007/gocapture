import { ref } from 'vue';
import { compactText, escapeRegExp } from '../core/element-context';

export function usePageRequests() {
  const recentRequests = ref([]);

  function rememberRequest(info) {
    if (!info.url) return;
    recentRequests.value = [
      info,
      ...recentRequests.value.filter(item => !(item.url === info.url && item.method === info.method))
    ].slice(0, 40);
  }

  function apiResponseValues() {
    const values = recentRequests.value
      .slice(0, 8)
      .flatMap(item => item.responseValues || [])
      .map(value => String(value || '').replace(/\s+/g, ' ').trim())
      .filter(value => value.length >= 2 && value.length <= 80);
    return Array.from(new Set(values)).sort((a, b) => b.length - a.length).slice(0, 180);
  }

  function denoiseTextByApi(text, limit = 140) {
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

  return {
    recentRequests,
    rememberRequest,
    denoiseTextByApi
  };
}
