import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { RouteResolverTrace } from '../app/types/route.types';

export const useRouteStore = defineStore('gocapture.route', () => {
  const pageUrl = ref('');
  const pagePath = ref('/');
  const resolverTrace = ref<RouteResolverTrace | null>(null);
  const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle');
  const error = ref('');

  function setPage(url: string, path: string) {
    pageUrl.value = url;
    pagePath.value = path || '/';
  }

  function applyTrace(trace: RouteResolverTrace | null) {
    resolverTrace.value = trace;
    status.value = trace?.matched ? 'success' : 'idle';
    error.value = '';
  }

  function fail(reason: unknown) {
    status.value = 'error';
    error.value = `${(reason as Error)?.message || reason || ''}`;
  }

  return {
    pageUrl,
    pagePath,
    resolverTrace,
    status,
    error,
    setPage,
    applyTrace,
    fail
  };
});
