import { type ComputedRef, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouteStore } from '../../stores/route.store';
import { isGoCaptureUiHref } from './page-location';

interface RouteResolverOptions {
  project: Ref<any>;
  currentPageHref: Ref<string>;
  pageUrlPath: ComputedRef<string>;
  sourceServerJson: (pathname: string, options?: Record<string, any>) => Promise<any>;
}

export function useRouteResolver({
  project,
  currentPageHref,
  pageUrlPath,
  sourceServerJson
}: RouteResolverOptions) {
  const routeStore = useRouteStore();
  const { resolverTrace: routeResolverTrace } = storeToRefs(routeStore);
  let routeResolveSeq = 0;
  let routeResolveTimer = 0;

  function sameRouteTracePage(trace: any) {
    const tracePath = String(trace?.pagePath || '').trim();
    return !tracePath || tracePath === pageUrlPath.value;
  }

  function applyRouteResolverTrace(nextTrace: any) {
    const currentTrace = routeResolverTrace.value;
    if (!nextTrace) return;
    if (nextTrace.matched) {
      routeStore.applyTrace(nextTrace);
      return;
    }
    if (currentTrace?.matched && sameRouteTracePage(currentTrace)) return;
    routeStore.applyTrace(nextTrace);
  }

  function scheduleRouteResolve() {
    if (routeResolveTimer) window.clearTimeout(routeResolveTimer);
    routeResolveTimer = window.setTimeout(() => {
      routeResolveTimer = 0;
      resolveCurrentPageRoute();
    }, 80);
  }

  async function resolveCurrentPageRoute() {
    if (!project.value || project.value.source !== 'source-server') {
      routeStore.applyTrace(null);
      return;
    }
    if (!currentPageHref.value || isGoCaptureUiHref(currentPageHref.value)) {
      routeStore.status = 'idle';
      routeStore.error = '';
      return;
    }

    const seq = ++routeResolveSeq;
    routeStore.status = 'loading';
    routeStore.error = '';
    try {
      const data = await sourceServerJson('/api/route/resolve', {
        method: 'POST',
        body: {
          url: currentPageHref.value,
          pagePath: pageUrlPath.value
        },
        timeoutMs: 5000,
        timeoutMessage: '页面路由解析超过 5 秒'
      });
      if (seq !== routeResolveSeq) return;
      routeStore.applyTrace(data.routeResolver || null);
    } catch (error: any) {
      if (seq !== routeResolveSeq) return;
      routeStore.applyTrace({
        projectKind: project.value?.kind || 'unknown',
        pagePath: pageUrlPath.value,
        adapters: [],
        matched: false,
        hits: [],
        errors: [error.message || String(error)]
      });
      routeStore.fail(error);
    }
  }

  function cleanupRouteResolver() {
    if (routeResolveTimer) {
      window.clearTimeout(routeResolveTimer);
      routeResolveTimer = 0;
    }
  }

  return {
    routeResolverTrace,
    sameRouteTracePage,
    applyRouteResolverTrace,
    scheduleRouteResolve,
    resolveCurrentPageRoute,
    cleanupRouteResolver
  };
}
