const { createId } = require('./id');
const { createPanelTicketService } = require('./panel-ticket');
const { createSessionStore } = require('./session-store');
const { decodeFrames, encodeFrame, upgradeToWebSocket } = require('./ws');

function createBridge() {
  const sessions = createSessionStore();
  const tickets = createPanelTicketService();
  const runtimeClients = new Map();
  const runtimeIdBySessionId = new Map();
  const panelClientsBySessionId = new Map();

  function send(socket, message) {
    if (!socket || socket.destroyed) return;
    socket.write(encodeFrame(JSON.stringify(message)));
  }

  function publish(pageSessionId, event) {
    const clients = panelClientsBySessionId.get(pageSessionId);
    if (!clients) return;
    for (const client of clients) {
      send(client.socket, {
        type: 'session.event',
        pageSessionId,
        event,
      });
    }
  }

  function bindPanel(input) {
    const snapshot = sessions.createPendingForTab({
      browserTabId: input.tabId ?? input.browserTabId,
      windowId: input.windowId,
      page: input.page,
    });
    return {
      ...tickets.createTicket(snapshot.pageSessionId),
      pageSessionId: snapshot.pageSessionId,
      snapshot,
    };
  }

  function handleRuntimeRegister(client, message) {
    const snapshot = sessions.createOrResumeRuntime({
      runtimeId: message.runtimeId,
      browserTabId: message.browserTabId,
      windowId: message.windowId,
      page: message.page,
    });
    client.kind = 'runtime';
    client.runtimeId = message.runtimeId;
    client.pageSessionId = snapshot.pageSessionId;
    runtimeClients.set(message.runtimeId, client);
    runtimeIdBySessionId.set(snapshot.pageSessionId, message.runtimeId);
    send(client.socket, {
      type: 'runtime.bound_session',
      pageSessionId: snapshot.pageSessionId,
      snapshot,
    });
    publish(snapshot.pageSessionId, {
      type: 'runtime.connected',
      payload: snapshot,
    });
  }

  function handleRuntimeEvent(client, message) {
    const pageSessionId = message.pageSessionId || client.pageSessionId;
    const session = sessions.applyRuntimeEvent(pageSessionId, message.event);
    if (!session) return;
    publish(pageSessionId, message.event);
  }

  function handlePanelConnect(client, message) {
    const pageSessionId = tickets.consumeTicket(message.panelTicket);
    const snapshot = sessions.getById(pageSessionId);
    if (!snapshot) throw new Error('Page session not found.');
    client.kind = 'sideiframe';
    client.pageSessionId = pageSessionId;
    if (!panelClientsBySessionId.has(pageSessionId)) {
      panelClientsBySessionId.set(pageSessionId, new Set());
    }
    panelClientsBySessionId.get(pageSessionId).add(client);
    send(client.socket, {
      type: 'sideiframe.bound_session',
      pageSessionId,
      snapshot,
    });
  }

  function handleSessionCommand(client, message) {
    const pageSessionId = message.pageSessionId || client.pageSessionId;
    const runtimeId = runtimeIdBySessionId.get(pageSessionId);
    const runtimeClient = runtimeId ? runtimeClients.get(runtimeId) : null;
    if (!runtimeClient) {
      send(client.socket, {
        type: 'session.command_result',
        pageSessionId,
        requestId: message.requestId,
        ok: false,
        error: 'Page runtime disconnected.',
      });
      return;
    }
    send(runtimeClient.socket, {
      type: `page.command.${message.command?.type || 'unknown'}`,
      requestId: message.requestId,
      pageSessionId,
      command: message.command,
    });
  }

  function handleMessage(client, raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch (error) {
      send(client.socket, { type: 'error', error: 'Invalid JSON message.' });
      return;
    }

    try {
      if (message.type === 'runtime.register') {
        handleRuntimeRegister(client, message);
      } else if (message.type === 'runtime.event') {
        handleRuntimeEvent(client, message);
      } else if (message.type === 'sideiframe.connect') {
        handlePanelConnect(client, message);
      } else if (message.type === 'session.command') {
        handleSessionCommand(client, message);
      } else {
        send(client.socket, { type: 'error', error: `Unsupported message type: ${message.type}` });
      }
    } catch (error) {
      send(client.socket, { type: 'error', error: error.message || String(error) });
    }
  }

  function handleClose(client) {
    if (client.kind === 'runtime' && client.runtimeId) {
      runtimeClients.delete(client.runtimeId);
      const snapshot = sessions.markRuntimeDisconnected(client.runtimeId);
      if (snapshot) {
        publish(snapshot.pageSessionId, {
          type: 'runtime.disconnected',
          payload: snapshot,
        });
      }
    }
    if (client.kind === 'sideiframe' && client.pageSessionId) {
      const clients = panelClientsBySessionId.get(client.pageSessionId);
      if (clients) clients.delete(client);
    }
  }

  function handleUpgrade(req, socket) {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/bridge') return false;
    if (!upgradeToWebSocket(req, socket)) return true;

    const client = {
      id: createId('ws'),
      kind: 'unknown',
      socket,
      pageSessionId: '',
      runtimeId: '',
    };
    socket.on('data', chunk => decodeFrames(socket, chunk, text => handleMessage(client, text)));
    socket.on('close', () => handleClose(client));
    socket.on('error', () => handleClose(client));
    return true;
  }

  return {
    bindPanel,
    handleUpgrade,
    sessions,
  };
}

module.exports = {
  createBridge,
};
