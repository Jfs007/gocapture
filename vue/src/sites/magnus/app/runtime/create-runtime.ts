import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createMagnusModules } from './create-modules';
import { createMagnusActions } from './actions';
import { syncRuntimeStateToStores } from './store-sync';
import { provideMagnusRuntime } from './provide';
import { registerRuntimeApi } from './api';
import { installLocationWatcher, pageHostText, pageUrlPath, readCurrentHref } from '../modules/page-location';
import type { MagnusRuntimeContext } from './context';

export function createMagnusRuntime(api: Record<string, any>) {
  const currentPageHref = ref(readCurrentHref(api));
  const sidePanelConfig = computed(() => api.sidePanelConfig || {});
  const routePagePath = computed(() => pageUrlPath(currentPageHref.value));
  const pageHost = computed(() => pageHostText(currentPageHref.value));
  let cleanupLocationWatcher: null | (() => void) = null;

  const runtime: MagnusRuntimeContext = {
    api,
    currentPageHref,
    sidePanelConfig,
    routePagePath,
    pageHost
  };
  const modules = createMagnusModules(runtime);
  const { source, route, search, bridge } = modules;

  syncRuntimeStateToStores(modules);
  const actions = createMagnusActions(modules);
  provideMagnusRuntime(api, modules, actions);

  watch([source.project, currentPageHref], () => {
    search.i18nTrace.value = null;
    search.definitionTrace.value = null;
    route.scheduleRouteResolve();
  });

  onMounted(() => {
    registerRuntimeApi(api, modules);
    cleanupLocationWatcher = installLocationWatcher(currentPageHref);
    source.restoreSavedProject();
    route.scheduleRouteResolve();
    bridge.connectSidePanelBridge();
  });

  onBeforeUnmount(() => {
    bridge.disconnectSidePanelBridge();
    route.cleanupRouteResolver();
    cleanupLocationWatcher?.();
    cleanupLocationWatcher = null;
    modules.toast.cleanupToast();
  });

  return {
    fileInputRef: source.fileInputRef,
    onFileInputChange: source.onFileInputChange,
    pageHost
  };
}
