import { computed } from 'vue';
import { sourceServerJson } from '../services/source-service';
import { normalizeRequestInfo } from '../../core/element-context';
import { usePageRequests } from '../modules/page-requests';
import { useRouteResolver } from '../modules/route-resolver';
import { useSidePanelBridge } from '../modules/side-panel-bridge';
import { useSourceProject } from '../modules/source-project';
import { useToast } from '../modules/toast';
import { useComposerModule } from '../modules/composer-module';
import { useMessageModule } from '../modules/message-module';
import { useModelModule } from '../modules/model-module';
import { usePromptModule } from '../modules/prompt-module';
import { useSearchState } from '../modules/search-state';
import { useSelectionModule } from '../modules/selection-module';
import type { MagnusModules, MagnusRuntimeContext } from './context';

const PROJECT_STORAGE_PREFIX = 'magnus:source-project:';

export function createMagnusModules(runtime: MagnusRuntimeContext): MagnusModules {
  const { api, currentPageHref, sidePanelConfig, routePagePath, pageHost } = runtime;
  const projectStorageKey = computed(() => `${PROJECT_STORAGE_PREFIX}${pageHost.value}`);
  const modelAssistLoading = computed(() => model?.modelAssistLoading.value || false);
  let search: any = null;
  let selection: any = null;
  let composer: any = null;
  let bridge: any = null;
  let model: any = null;

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
    sendCommand: (type: string, payload: unknown) => bridge?.sendSidePanelCommand(type, payload),
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
    onNetworkRequest: (payload: unknown) => {
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
    toast
  }, runtime);

  model = useModelModule({
    source,
    route,
    search,
    prompt,
    toast
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
