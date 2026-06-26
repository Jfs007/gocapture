import { ref, type ComputedRef, type Ref } from 'vue';

export function hashRoutePath(hash: string) {
  const value = String(hash || '').replace(/^#/, '');
  if (!value) return '';
  const route = value.startsWith('!/') ? value.slice(1) : value;
  if (!route.startsWith('/')) return '';
  return route.split('?')[0] || '/';
}

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
  const routeResolverTrace = ref<any>(null);
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
      routeResolverTrace.value = nextTrace;
      return;
    }
    if (currentTrace?.matched && sameRouteTracePage(currentTrace)) return;
    routeResolverTrace.value = nextTrace;
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
      routeResolverTrace.value = null;
      return;
    }

    const seq = ++routeResolveSeq;
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
      routeResolverTrace.value = data.routeResolver || null;
    } catch (error: any) {
      if (seq !== routeResolveSeq) return;
      routeResolverTrace.value = {
        projectKind: project.value?.kind || 'unknown',
        pagePath: pageUrlPath.value,
        adapters: [],
        matched: false,
        hits: [],
        errors: [error.message || String(error)]
      };
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
