import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createMagnusModules } from '../app/create-magnus-modules';
import { createMagnusActions } from '../app/legacy-actions';
import { syncLegacyStateToStores } from '../app/legacy-state-sync';
import { provideMagnusRuntime } from '../app/provide-magnus-runtime';
import { registerRuntimeApi } from '../app/runtime-api';
import { installLocationWatcher, pageHostText, pageUrlPath, readCurrentHref } from './use-page-location';

export function useMagnusApp(api) {
  const currentPageHref = ref(readCurrentHref(api));
  const sidePanelConfig = computed(() => api.sidePanelConfig || {});
  const routePagePath = computed(() => pageUrlPath(currentPageHref.value));
  const pageHost = computed(() => pageHostText(currentPageHref.value));
  let cleanupLocationWatcher = null;

  const modules = createMagnusModules({
    api,
    sidePanelConfig,
    currentPageHref,
    routePagePath,
    pageHost
  });
  const { source, route, search, selection, composer, bridge, model, message } = modules;
  syncLegacyStateToStores({ source, search, composer, model, message });

  const actions = createMagnusActions({
    ...modules
  });
  provideMagnusRuntime(api, modules, actions);

  watch([source.project, currentPageHref], () => {
    search.i18nTrace.value = null;
    search.definitionTrace.value = null;
    route.scheduleRouteResolve();
  });

  onMounted(() => {
    registerRuntimeApi(api, bridge, selection);
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
    toast.cleanupToast();
  });

  return {
    fileInputRef: source.fileInputRef,
    onFileInputChange: source.onFileInputChange,
    pageHost
  };
}
