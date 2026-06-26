import type { ComputedRef, Ref } from 'vue';
import { useAppUiStore } from '../../stores/app-ui.store';

interface SidePanelBridgeOptions {
  sidePanelConfig: ComputedRef<Record<string, any>>;
  currentPageHref: Ref<string>;
  onNetworkRequest?: (payload: any) => void;
  onRuntimeEvent?: (event: any) => void;
  clearSelections: (notifyRuntime?: boolean) => void;
  scheduleRouteResolve: () => void;
}

export function useSidePanelBridge({
  sidePanelConfig,
  currentPageHref,
  onNetworkRequest,
  onRuntimeEvent,
  clearSelections,
  scheduleRouteResolve
}: SidePanelBridgeOptions) {
  const appUiStore = useAppUiStore();
  let socket: WebSocket | null = null;
  let pageSessionId = '';

  function selectionList(source: any) {
    return Array.isArray(source?.selections)
      ? source.selections
      : (source?.selection ? [source.selection] : []);
  }

  function applyRemoteSnapshot(snapshot: any) {
    if (!snapshot) return;
    if (snapshot.page?.url) {
      currentPageHref.value = snapshot.page.url;
      onRuntimeEvent?.({ type: 'runtime.connected', payload: { page: snapshot.page } });
    }
    if (snapshot.pageContext) {
      onRuntimeEvent?.({ type: 'page.context', payload: snapshot.pageContext });
    }
    onRuntimeEvent?.({ type: 'selection.changed', payload: { selections: selectionList(snapshot) } });
  }

  function applyRemoteSessionEvent(message: any) {
    const event = message?.event || {};
    const payload = event.payload || {};
    if (event.type) onRuntimeEvent?.({ type: event.type, payload });
    if (event.type === 'selection.changed') {
      appUiStore.setToast(`已添加选区 ${selectionList(payload).length}`);
      return;
    }
    if (event.type === 'page.route_changed') {
      currentPageHref.value = payload.url || currentPageHref.value;
      clearSelections(false);
      scheduleRouteResolve();
      return;
    }
    if (event.type === 'runtime.connected' && payload.page?.url) {
      currentPageHref.value = payload.page.url;
      return;
    }
    if (event.type === 'network.request') {
      onNetworkRequest?.(payload);
    }
  }

  function connectSidePanelBridge() {
    const config = sidePanelConfig.value || {};
    if (!config.panelTicket || !config.bridgeUrl) return;
    try {
      const nextSocket = new WebSocket(config.bridgeUrl);
      socket = nextSocket;
      nextSocket.addEventListener('open', () => {
        nextSocket.send(JSON.stringify({
          type: 'sideiframe.connect',
          panelTicket: config.panelTicket
        }));
      });
      nextSocket.addEventListener('message', event => {
        let message = null;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          return;
        }
        if (message.type === 'sideiframe.bound_session') {
          pageSessionId = message.pageSessionId || '';
          applyRemoteSnapshot(message.snapshot);
          sendSidePanelCommand('context.get');
          sendSidePanelCommand('picker.start');
        } else if (message.type === 'session.event') {
          applyRemoteSessionEvent(message);
        }
      });
      nextSocket.addEventListener('close', () => {
        if (socket === nextSocket) socket = null;
      });
    } catch (error: any) {
      appUiStore.setToast(error.message || '连接 Side Panel Bridge 失败');
    }
  }

  function disconnectSidePanelBridge() {
    socket?.close();
    socket = null;
    pageSessionId = '';
  }

  function sendSidePanelCommand(type: string, payload?: unknown) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !pageSessionId) {
      appUiStore.setToast('页面 Runtime 未连接');
      return;
    }
    socket.send(JSON.stringify({
      type: 'session.command',
      requestId: `cmd-${Date.now()}`,
      pageSessionId,
      command: {
        type,
        payload: payload || {}
      }
    }));
  }

  function startRemotePicker() {
    sendSidePanelCommand('picker.start');
  }

  return {
    connectSidePanelBridge,
    disconnectSidePanelBridge,
    sendSidePanelCommand,
    startRemotePicker
  };
}
