import type { ComputedRef, Ref } from 'vue';

interface SidePanelBridgeOptions {
  sidePanelConfig: ComputedRef<Record<string, any>>;
  currentPageHref: Ref<string>;
  selectedItems: Ref<any[]>;
  selectionFromRemote: (raw: any, index: number) => any;
  onNetworkRequest?: (payload: any) => void;
  onRuntimeEvent?: (event: any) => void;
  invalidateSelectionConfirm: () => void;
  clearSelections: (notifyRuntime?: boolean) => void;
  scheduleRouteResolve: () => void;
  setToast: (message: string) => void;
}

export function useSidePanelBridge({
  sidePanelConfig,
  currentPageHref,
  selectedItems,
  selectionFromRemote,
  onNetworkRequest,
  onRuntimeEvent,
  invalidateSelectionConfirm,
  clearSelections,
  scheduleRouteResolve,
  setToast
}: SidePanelBridgeOptions) {
  let socket: WebSocket | null = null;
  let pageSessionId = '';

  function applyRemoteSnapshot(snapshot: any) {
    if (!snapshot) return;
    if (snapshot.page?.url) currentPageHref.value = snapshot.page.url;
    const list = Array.isArray(snapshot.selections)
      ? snapshot.selections
      : (snapshot.selection ? [snapshot.selection] : []);
    selectedItems.value = list.map(selectionFromRemote);
  }

  function applyRemoteSessionEvent(message: any) {
    const event = message?.event || {};
    const payload = event.payload || {};
    if (event.type) onRuntimeEvent?.({ type: event.type, payload });
    if (event.type === 'selection.changed') {
      const list = Array.isArray(payload.selections)
        ? payload.selections
        : (payload.selection ? [payload.selection] : []);
      selectedItems.value = list.map(selectionFromRemote);
      invalidateSelectionConfirm();
      setToast(`已添加选区 ${selectedItems.value.length}`);
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
        } else if (message.type === 'session.event') {
          applyRemoteSessionEvent(message);
        }
      });
      nextSocket.addEventListener('close', () => {
        if (socket === nextSocket) socket = null;
      });
    } catch (error: any) {
      setToast(error.message || '连接 Side Panel Bridge 失败');
    }
  }

  function disconnectSidePanelBridge() {
    socket?.close();
    socket = null;
    pageSessionId = '';
  }

  function sendSidePanelCommand(type: string, payload?: unknown) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !pageSessionId) {
      setToast('页面 Runtime 未连接');
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
