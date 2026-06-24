import { computed } from 'vue';
import { sourceServerJson } from '../services/source-service';
import { normalizeRequestInfo } from '../core/element-context';
import { usePageRequests } from '../hooks/use-page-requests';
import { useRouteResolver } from '../hooks/use-route-resolver';
import { useSidePanelBridge } from '../hooks/use-side-panel-bridge';
import { useSourceProject } from '../hooks/use-source-project';
import { useToast } from '../hooks/use-toast';
import { useComposerModule } from '../hooks/modules/use-composer-module';
import { useMessageModule } from '../hooks/modules/use-message-module';
import { useModelModule } from '../hooks/modules/use-model-module';
import { usePromptModule } from '../hooks/modules/use-prompt-module';
import { useSearchState } from '../hooks/modules/use-search-state';
import { useSelectionModule } from '../hooks/modules/use-selection-module';

const PROJECT_STORAGE_PREFIX = 'magnus:source-project:';

export function createMagnusModules({
  api,
  currentPageHref,
  sidePanelConfig,
  routePagePath,
  pageHost
}) {
  const projectStorageKey = computed(() => `${PROJECT_STORAGE_PREFIX}${pageHost.value}`);
  const modelAssistLoading = computed(() => model?.modelAssistLoading.value || false);
  let search = null;
  let selection = null;
  let composer = null;
  let bridge = null;
  let model = null;

  const toast = useToast();
  const requests = usePageRequests();

  const source = useSourceProject({
    projectStorageKey,
    resetProjectContext: () => search?.resetProjectContext(selection, composer),
    setToast: toast.setToast
  });

  const route = useRouteResolver({
    project: source.project,
    currentPageHref,
    pageUrlPath: routePagePath,
    sourceServerJson
  });

  search = useSearchState({
    routeResolverTrace: route.routeResolverTrace,
    recentRequests: requests.recentRequests,
    modelAssistLoading,
    filesConfirmed: computed(() => selection?.filesConfirmed.value || false),
    resetModelAssist: () => model?.resetModelAssist?.(),
    invalidatePrompt: () => composer?.invalidatePrompt?.()
  });

  selection = useSelectionModule({
    sendCommand: (type, payload) => bridge?.sendSidePanelCommand(type, payload),
    getPromptIntent: () => composer?.promptIntent.value || '',
    resetCandidateState: () => search.clearCandidateState(selection.filesConfirmed),
    resetComposer: () => composer.resetPromptComposer(),
    setToast: toast.setToast
  });

  composer = useComposerModule({
    project: source.project,
    selectedItems: selection.selectedItems,
    candidateLoading: search.candidateLoading,
    modelAssistLoading,
    showCandidatePicker: search.showCandidatePicker,
    selectedCandidateHits: search.selectedCandidateHits
  });

  bridge = useSidePanelBridge({
    sidePanelConfig,
    currentPageHref,
    selectedItems: selection.selectedItems,
    selectionFromRemote: selection.selectionFromRemote,
    onRuntimeEvent: api.bootstrap?.handleRuntimeEvent,
    onNetworkRequest: payload => {
      requests.rememberRequest(normalizeRequestInfo(payload || {}, currentPageHref.value));
    },
    invalidateSelectionConfirm: selection.invalidateSelectionConfirm,
    clearSelections: selection.clearSelections,
    scheduleRouteResolve: route.scheduleRouteResolve,
    setToast: toast.setToast
  });

  const prompt = usePromptModule({
    source,
    route,
    search,
    selection,
    composer,
    requests,
    currentPageHref,
    pageUrlPath: routePagePath,
    setToast: toast.setToast
  });

  model = useModelModule({
    source,
    route,
    search,
    prompt,
    setToast: toast.setToast
  });

  const message = useMessageModule({
    source,
    search,
    selection,
    composer,
    model,
    prompt
  });

  return {
    toast,
    requests,
    source,
    route,
    search,
    selection,
    composer,
    bridge,
    prompt,
    model,
    message
  };
}
