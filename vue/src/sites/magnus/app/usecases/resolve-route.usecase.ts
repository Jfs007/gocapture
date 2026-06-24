import type { MagnusStores } from '../dependencies';
import type { RouteApi } from '../../infrastructure/api/RouteApi';

export function createResolveRouteUseCase(stores: MagnusStores, routeApi: RouteApi) {
  return async function resolveRoute() {
    stores.routeStore.status = 'loading';
    try {
      const trace = await routeApi.resolve({
        url: stores.routeStore.pageUrl,
        pagePath: stores.routeStore.pagePath
      });
      stores.routeStore.applyTrace(trace);
    } catch (error) {
      stores.routeStore.fail(error);
    }
  };
}
