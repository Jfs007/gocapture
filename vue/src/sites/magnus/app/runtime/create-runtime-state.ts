import { computed } from 'vue';
import { sourceServerJson } from '../services/source-service';
import { normalizeRequestInfo } from '../utils/request';
import { usePageRequests } from '../infrastructure/page-requests.adapter';
import { useRouteResolver } from '../infrastructure/route-resolver.adapter';
import { useSidePanelBridge } from '../infrastructure/side-panel.adapter';
import { useSourceProject } from '../infrastructure/source-project.adapter';
import { useSearchFacade } from '../state/search.facade';
import { useComposerStore } from '../../stores/composer.store';
import { createComposerFacade } from '../state/composer.facade';
import { setupSelectionRuntime } from './setup/selection';
import { setupPromptRuntime } from './setup/prompt';
import { setupModelRuntime } from './setup/model';
import { setupChatRuntime } from './setup/chat';
import type { MagnusRuntimeContext, MagnusRuntimeState } from './context';

const PROJECT_STORAGE_PREFIX = 'magnus:source-project:';

export function createMagnusRuntimeState(runtime: MagnusRuntimeContext): MagnusRuntimeState {
  const { api, currentPageHref, sidePanelConfig, routePagePath, pageHost } = runtime;
  const projectStorageKey = computed(() => `${PROJECT_STORAGE_PREFIX}${pageHost.value}`);
  const composerStore = useComposerStore();
  const composer: any = createComposerFacade(composerStore);
  const requests = usePageRequests();
  let search: any = null;
  let bridge: any = null;
  let model: any = null;

  const selection: any = setupSelectionRuntime({
    sendCommand: (type, payload) => bridge?.sendSidePanelCommand(type, payload)
  });

  const source = useSourceProject({ projectStorageKey });

  const route = useRouteResolver({
    project: source.project,
    currentPageHref,
    pageUrlPath: routePagePath,
    sourceServerJson
  });

  search = useSearchFacade();

  bridge = useSidePanelBridge({
    sidePanelConfig,
    currentPageHref,
    onRuntimeEvent: api.bootstrap?.handleRuntimeEvent,
    onNetworkRequest: (payload: unknown) => {
      requests.rememberRequest(normalizeRequestInfo(payload || {}, currentPageHref.value));
    },
    clearSelections: (notifyRuntime?: boolean) => selection.clearSelections(notifyRuntime),
    scheduleRouteResolve: route.scheduleRouteResolve
  });

  const prompt = setupPromptRuntime();
  model = setupModelRuntime();
  const message = setupChatRuntime();

  return {
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
