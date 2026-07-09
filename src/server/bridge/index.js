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

  function attachPanelToSession(client, pageSessionId) {
    if (!client || client.kind !== 'sideiframe' || !pageSessionId) return;
    if (!panelClientsBySessionId.has(pageSessionId)) {
      panelClientsBySessionId.set(pageSessionId, new Set());
    }
    panelClientsBySessionId.get(pageSessionId).add(client);
  }

  function bindPanel(input) {
    const snapshot = sessions.createPendingForTab({
      browserTabId: input.tabId ?? input.browserTabId,
      windowId: input.windowId,
      workspaceId: input.workspaceId,
      page: input.page,
    });
    return {
      ...tickets.createTicket({
        pageSessionId: snapshot.pageSessionId,
        workspaceId: snapshot.workspaceId,
      }),
      success: true,
      workspaceId: snapshot.workspaceId,
      pageSessionId: snapshot.pageSessionId,
      snapshot,
    };
  }

  function handleRuntimeRegister(client, message) {
    const snapshot = sessions.createOrResumeRuntime({
      runtimeId: message.runtimeId,
      browserTabId: message.browserTabId,
      windowId: message.windowId,
      workspaceId: message.workspaceId,
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

  function handleRuntimeCommandResult(client, message) {
    const pageSessionId = message.pageSessionId || client.pageSessionId;
    const panels = panelClientsBySessionId.get(pageSessionId);
    if (!panels) return;
    for (const panel of panels) {
      send(panel.socket, {
        type: 'session.command_result',
        pageSessionId,
        requestId: message.requestId || '',
        ok: !!message.ok,
        payload: message.payload || null,
      });
    }
  }

  function handlePanelConnect(client, message) {
    const ticket = tickets.consumeTicket(message.panelTicket);
    const pageSessionId = ticket.pageSessionId;
    const snapshot = sessions.getById(pageSessionId);
    if (!snapshot) throw new Error('Page session not found.');
    if (ticket.workspaceId && snapshot.workspaceId && ticket.workspaceId !== snapshot.workspaceId) {
      throw new Error('Workspace mismatch.');
    }
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
    let pageSessionId = '';
    let snapshot = null;
    let runtimeId = '';
    let runtimeClient = null;

    const pageBindingId = message.pageBindingId || message.workspaceId || '';
    if (pageBindingId) {
      const workspaceSnapshot = sessions.getByWorkspaceId(pageBindingId);
      if (workspaceSnapshot?.pageSessionId) {
        pageSessionId = workspaceSnapshot.pageSessionId;
        snapshot = workspaceSnapshot;
        runtimeId = runtimeIdBySessionId.get(pageSessionId) || workspaceSnapshot.runtimeId || '';
        runtimeClient = runtimeId ? runtimeClients.get(runtimeId) : null;
      }
    }

    if (!runtimeClient) {
      pageSessionId = message.pageSessionId || client.pageSessionId;
      snapshot = pageSessionId ? sessions.getById(pageSessionId) : null;
      runtimeId = pageSessionId ? runtimeIdBySessionId.get(pageSessionId) : '';
      runtimeClient = runtimeId ? runtimeClients.get(runtimeId) : null;
    }

    if (!runtimeClient) {
      send(client.socket, {
        type: 'session.command_result',
        pageSessionId,
        requestId: message.requestId,
        ok: false,
        error: snapshot?.status === 'disconnected'
          ? 'Page runtime disconnected.'
          : 'Page runtime not found for session.',
      });
      return;
    }
    if (String(message.command?.type || '').startsWith('selection.')) {
      attachPanelToSession(client, pageSessionId);
    }
    send(runtimeClient.socket, {
      type: `page.command.${message.command?.type || 'unknown'}`,
      requestId: message.requestId,
      pageSessionId,
      pageBindingId,
      targetRuntimeId: runtimeId,
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
      } else if (message.type === 'runtime.command_result') {
        handleRuntimeCommandResult(client, message);
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
      for (const clients of panelClientsBySessionId.values()) {
        clients.delete(client);
      }
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
