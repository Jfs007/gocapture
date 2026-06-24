import type {
  NetworkRequestPayload,
  PageRouteChangedPayload,
  RuntimeConnectedPayload,
  RuntimeEvent,
  SelectionChangedPayload
} from '../../domain/bridge/bridge-event.types';
import type { MagnusStores } from '../dependencies';

export function createRuntimeEventHandler(stores: MagnusStores) {
  return async function handleRuntimeEvent(event: RuntimeEvent) {
    switch (event.type) {
      case 'selection.changed': {
        const payload = event.payload as SelectionChangedPayload;
        const selections = Array.isArray(payload?.selections)
          ? payload.selections
          : (payload?.selection ? [payload.selection] : []);
        stores.selectionStore.replaceSelections(selections);
        break;
      }
      case 'page.route_changed': {
        const payload = event.payload as PageRouteChangedPayload;
        stores.routeStore.setPage(payload?.url || '', stores.routeStore.pagePath);
        break;
      }
      case 'network.request': {
        stores.requestStore.remember(event.payload as NetworkRequestPayload);
        break;
      }
      case 'runtime.connected': {
        const payload = event.payload as RuntimeConnectedPayload;
        stores.appUiStore.setRuntimeConnected(true);
        if (payload?.page?.url) stores.routeStore.setPage(payload.page.url, stores.routeStore.pagePath);
        break;
      }
    }
  };
}
