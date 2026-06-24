import type { BridgeClient, RuntimeEventListener } from './bridge-client';
import type { SidePanelBridgeConfig } from '../../domain/bridge/bridge-event.types';

export function createSidePanelBridge(config: () => SidePanelBridgeConfig, setToast: (text: string) => void): BridgeClient {
  let socket: WebSocket | null = null;
  let pageSessionId = '';
  const listeners = new Set<RuntimeEventListener>();

  function emit(event: { type: string; payload: unknown }) {
    for (const listener of listeners) {
      void listener(event as never);
    }
  }

  return {
    connect() {
      const bridgeConfig = config();
      if (!bridgeConfig.panelTicket || !bridgeConfig.bridgeUrl) return;
      const nextSocket = new WebSocket(bridgeConfig.bridgeUrl);
      socket = nextSocket;
      nextSocket.addEventListener('open', () => {
        nextSocket.send(JSON.stringify({
          type: 'sideiframe.connect',
          panelTicket: bridgeConfig.panelTicket
        }));
      });
      nextSocket.addEventListener('message', event => {
        let message: any = null;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          return;
        }
        if (message.type === 'sideiframe.bound_session') {
          pageSessionId = message.pageSessionId || '';
          if (message.snapshot?.selection || message.snapshot?.selections) {
            emit({
              type: 'selection.changed',
              payload: {
                selections: message.snapshot.selections,
                selection: message.snapshot.selection
              }
            });
          }
          return;
        }
        if (message.type === 'session.event' && message.event?.type) {
          emit({
            type: message.event.type,
            payload: message.event.payload || {}
          });
        }
      });
      nextSocket.addEventListener('close', () => {
        if (socket === nextSocket) socket = null;
      });
    },
    disconnect() {
      socket?.close();
      socket = null;
      pageSessionId = '';
    },
    sendCommand(type, payload = {}) {
      if (!socket || socket.readyState !== WebSocket.OPEN || !pageSessionId) {
        setToast('页面 Runtime 未连接');
        return;
      }
      socket.send(JSON.stringify({
        type: 'session.command',
        requestId: `cmd-${Date.now()}`,
        pageSessionId,
        command: { type, payload }
      }));
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
