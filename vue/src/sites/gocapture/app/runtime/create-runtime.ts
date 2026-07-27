import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createGoCaptureRuntimeState } from './create-runtime-state';
import { createGoCaptureActions } from './actions';
import { provideGoCaptureRuntime } from './provide';
import { registerRuntimeApi } from './api';
import { installLocationWatcher, pageHostText, pageUrlPath, readCurrentHref } from '../infrastructure/page-location';
import { useRouteStore } from '../../stores/route.store';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import { loadProjectSelectionReferences } from '../services/selection-reference.service';
import type { GoCaptureRuntimeContext } from './context';

export function createGoCaptureRuntime(api: Record<string, any>) {
  const currentPageHref = ref(readCurrentHref(api));
  const sidePanelConfig = computed(() => api.sidePanelConfig || {});
  const routePagePath = computed(() => pageUrlPath(currentPageHref.value));
  const pageHost = computed(() => pageHostText(currentPageHref.value));
  const routeStore = useRouteStore();
  const appUiStore = useAppUiStore();
  const connectAgentStore = useConnectAgentStore();
  let cleanupLocationWatcher: null | (() => void) = null;

  const runtime: GoCaptureRuntimeContext = {
    api,
    currentPageHref,
    sidePanelConfig,
    routePagePath,
    pageHost
  };
  const state = createGoCaptureRuntimeState(runtime);
  const { source, route, search, bridge } = state;
  let selectionRestoreRequest = 0;

  const actions = createGoCaptureActions(state);
  provideGoCaptureRuntime(api, state, actions);

  watch([source.project, currentPageHref], () => {
    const projectRoot = source.project.value?.path || '';
    routeStore.setPage(currentPageHref.value, routePagePath.value);
    search.i18nTrace.value = null;
    search.definitionTrace.value = null;
    route.scheduleRouteResolve();
    void connectAgentStore.refreshProviders(false, projectRoot)
      .then(() => connectAgentStore.loadTimeline(projectRoot));
    if (projectRoot) {
      const request = ++selectionRestoreRequest;
      void loadProjectSelectionReferences(projectRoot).then(references => {
        if (request !== selectionRestoreRequest) return;
        if (source.project.value?.path !== projectRoot) return;
        state.selection.restoreLocationReferences(references, projectRoot);
      });
    }
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
    const projectRoot = source.project.value?.path || '';
    void connectAgentStore.refreshProviders(false, projectRoot)
      .then(() => connectAgentStore.loadTimeline(projectRoot));
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
