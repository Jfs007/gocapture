import { computed } from 'vue';
import { sourceServerJson } from '../services/source-service';
import { normalizeRequestInfo } from '../utils/request';
import { usePageRequests } from '../infrastructure/page-requests.adapter';
import { useRouteResolver } from '../infrastructure/route-resolver.adapter';
import { useSidePanelBridge } from '../infrastructure/side-panel.adapter';
import { useSourceProject } from '../infrastructure/source-project.adapter';
import { useSidePanelUiPersistence } from '../infrastructure/side-panel-ui-persistence';
import { useSearchFacade } from '../state/search.facade';
import { useComposerStore } from '../../stores/composer.store';
import { createComposerFacade } from '../state/composer.facade';
import { setupSelectionRuntime } from './setup/selection';
import { setupPromptRuntime } from './setup/prompt';
import { setupModelRuntime } from './setup/model';
import { setupChatRuntime } from './setup/chat';
import type { MagnusRuntimeContext, MagnusRuntimeState } from './context';

const LEGACY_PROJECT_STORAGE_PREFIX = 'magnus:source-project:';

export function createMagnusRuntimeState(runtime: MagnusRuntimeContext): MagnusRuntimeState {
  const { api, currentPageHref, sidePanelConfig, routePagePath, pageHost } = runtime;
  const projectStorageKey = computed(() => `${LEGACY_PROJECT_STORAGE_PREFIX}${pageHost.value}`);
  const composerStore = useComposerStore();
  const composer: any = createComposerFacade(composerStore);
  const requests = usePageRequests();
  useSidePanelUiPersistence(currentPageHref);
  let search: any = null;
  let bridge: any = null;
  let model: any = null;

  const selection: any = setupSelectionRuntime({
    sendCommand: (type, payload, options) => bridge?.sendSidePanelCommand(type, payload, options)
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
    onCommandResult: (message: any) => {
      const payload = message?.payload || {};
      if (!payload?.reason && !payload?.uid) return;
      const status = message?.ok ? '成功' : '失败';
      const detail = payload.reason
        ? `；原因=${payload.reason}`
        : '';
      const target = payload.tag
        ? `；目标=${payload.tag}${payload.className ? `.${String(payload.className).replace(/\s+/g, '.')}` : ''}`
        : '';
      const debug = [
        payload.requestedPageBindingId ? `请求绑定=${payload.requestedPageBindingId}` : '',
        payload.runtimePageBindingId ? `运行时绑定=${payload.runtimePageBindingId}` : '',
        payload.commandPageSessionId ? `命令session=${payload.commandPageSessionId}` : '',
        payload.runtimePageSessionId ? `运行时session=${payload.runtimePageSessionId}` : '',
        payload.targetRuntimeId ? `目标runtime=${payload.targetRuntimeId}` : '',
        payload.runtimeId ? `运行时runtime=${payload.runtimeId}` : '',
        payload.pageUrl ? `页面=${payload.pageUrl}` : '',
        typeof payload.selectionCount === 'number' ? `运行时选区数=${payload.selectionCount}` : '',
        Array.isArray(payload.knownSelectionIds) ? `运行时已知选区=${payload.knownSelectionIds.join(',') || '-'}` : ''
      ].filter(Boolean).join('；');
      search.appendProcessLog?.(`页面命令回执：${status}${detail}${target}${debug ? `；${debug}` : ''}`);
    },
    onNetworkRequest: (payload: unknown) => {
      requests.rememberRequest(normalizeRequestInfo(payload || {}, currentPageHref.value));
    },
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
