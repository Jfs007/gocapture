import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createMagnusRuntimeState } from './create-runtime-state';
import { createMagnusActions } from './actions';
import { provideMagnusRuntime } from './provide';
import { registerRuntimeApi } from './api';
import { installLocationWatcher, pageHostText, pageUrlPath, readCurrentHref } from '../infrastructure/page-location';
import { useRouteStore } from '../../stores/route.store';
import { useAppUiStore } from '../../stores/app-ui.store';
import type { MagnusRuntimeContext } from './context';

export function createMagnusRuntime(api: Record<string, any>) {
  const currentPageHref = ref(readCurrentHref(api));
  const sidePanelConfig = computed(() => api.sidePanelConfig || {});
  const routePagePath = computed(() => pageUrlPath(currentPageHref.value));
  const pageHost = computed(() => pageHostText(currentPageHref.value));
  const routeStore = useRouteStore();
  const appUiStore = useAppUiStore();
  let cleanupLocationWatcher: null | (() => void) = null;

  const runtime: MagnusRuntimeContext = {
    api,
    currentPageHref,
    sidePanelConfig,
    routePagePath,
    pageHost
  };
  const state = createMagnusRuntimeState(runtime);
  const { source, route, search, bridge } = state;

  const actions = createMagnusActions(state);
  provideMagnusRuntime(api, state, actions);

  watch([source.project, currentPageHref], () => {
    routeStore.setPage(currentPageHref.value, routePagePath.value);
    search.i18nTrace.value = null;
    search.definitionTrace.value = null;
    route.scheduleRouteResolve();
  }, { immediate: true });

  watch(currentPageHref, () => {
    source.restoreSavedProject();
  });

  onMounted(() => {
    registerRuntimeApi(api, state);
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
    appUiStore.cleanupToast();
  });

  return {
    currentPageHref,
    fileInputRef: source.fileInputRef,
    onFileInputChange: source.onFileInputChange,
    openSettings: actions.openSettings,
    rebindSidePanel: actions.rebindSidePanel,
    pageHost
  };
}
