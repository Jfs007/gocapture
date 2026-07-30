import { storeToRefs } from 'pinia';
import { compactText, escapeRegExp } from '../utils/text';
import {
  GOCAPTURE_INTERNAL_REQUEST_HEADER,
  GOCAPTURE_INTERNAL_REQUEST_VALUE,
  SOURCE_SERVER_URL
} from '../services/source-service';
import { useRequestStore } from '../../stores/request.store';

type HeaderInput = Headers | Array<[string, string]> | Record<string, string> | undefined;

export function usePageRequests() {
  const requestStore = useRequestStore();
  const { items: recentRequests } = storeToRefs(requestStore);

  function getHeaderValue(headers: HeaderInput, name: string) {
    if (!headers || !name) return '';
    const target = String(name).toLowerCase();
    if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) || (headers as Headers).get(target) || '';
    if (Array.isArray(headers)) {
      const item = headers.find(([key]) => String(key || '').toLowerCase() === target);
      return item ? String(item[1] || '') : '';
    }
    if (typeof headers === 'object') {
      const key = Object.keys(headers).find(item => item.toLowerCase() === target);
      return key ? String((headers as Record<string, string>)[key] || '') : '';
    }
    return '';
  }

  function hasInternalGoCaptureHeader(info: any) {
    return getHeaderValue(info.headers, GOCAPTURE_INTERNAL_REQUEST_HEADER) === GOCAPTURE_INTERNAL_REQUEST_VALUE;
  }

  function isInternalGoCaptureRequest(info: any) {
    if (hasInternalGoCaptureHeader(info)) return true;
    try {
      const url = new URL(info.url || '', window.location.href);
      const sourceUrl = new URL(SOURCE_SERVER_URL);
      if (url.origin !== sourceUrl.origin) return false;
      return url.pathname === '/health'
        || url.pathname.startsWith('/api/source/')
        || url.pathname.startsWith('/api/route/')
        || url.pathname.startsWith('/api/connect-agents');
    } catch (error) {
      return false;
    }
  }

  function rememberRequest(info: any) {
    if (!info.url) return;
    if (isInternalGoCaptureRequest(info)) return;
    requestStore.remember(info);
  }

  function apiResponseValues() {
    const values = recentRequests.value
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

  return {
    recentRequests,
    rememberRequest,
    denoiseTextByApi
  };
}
