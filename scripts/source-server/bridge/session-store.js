const { createId } = require('./id');

function now() {
  return Date.now();
}

function normalizePage(page) {
  return {
    url: page?.url || '',
    title: page?.title || '',
    routeVersion: Number(page?.routeVersion || 0),
  };
}

function createSessionStore() {
  const sessions = new Map();
  const sessionIdByTabKey = new Map();
  const sessionIdByWorkspaceId = new Map();
  const sessionIdByRuntimeId = new Map();

  function tabKey(input) {
    if (input?.browserTabId == null) return '';
    return `${input.windowId || 0}:${input.browserTabId}`;
  }

  function snapshot(session) {
    if (!session) return null;
    return {
      pageSessionId: session.pageSessionId,
      runtimeId: session.runtimeId,
      workspaceId: session.workspaceId || '',
      browserTabId: session.browserTabId,
      windowId: session.windowId,
      page: session.page,
      selection: session.selection || null,
      selections: session.selections || [],
      pickerEnabled: !!session.pickerEnabled,
      networkEvents: session.networkEvents || [],
      pageContext: session.pageContext || null,
      taskIds: session.taskIds || [],
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  function createOrResumeRuntime(input) {
    const page = normalizePage(input.page);
    const workspaceId = input.workspaceId || '';
    const key = tabKey(input);
    const existingId = workspaceId
      ? sessionIdByWorkspaceId.get(workspaceId)
      : (key ? sessionIdByTabKey.get(key) : '');
    let session = existingId ? sessions.get(existingId) : null;

    if (!session) {
      session = {
        pageSessionId: createId('page'),
        runtimeId: input.runtimeId,
        workspaceId,
        browserTabId: input.browserTabId,
        windowId: input.windowId,
        page,
        selection: null,
        selections: [],
        pickerEnabled: false,
        networkEvents: [],
        pageContext: null,
        taskIds: [],
        status: 'connected',
        createdAt: now(),
        updatedAt: now(),
      };
      sessions.set(session.pageSessionId, session);
    } else {
      session.runtimeId = input.runtimeId;
      session.workspaceId = workspaceId || session.workspaceId || '';
      session.browserTabId = input.browserTabId ?? session.browserTabId;
      session.windowId = input.windowId ?? session.windowId;
      session.page = page;
      session.selection = null;
      session.selections = [];
      session.pickerEnabled = false;
      session.networkEvents = [];
      session.pageContext = null;
      session.status = 'connected';
      session.updatedAt = now();
    }

    if (workspaceId) sessionIdByWorkspaceId.set(workspaceId, session.pageSessionId);
    if (key) sessionIdByTabKey.set(key, session.pageSessionId);
    if (input.runtimeId) sessionIdByRuntimeId.set(input.runtimeId, session.pageSessionId);
    return snapshot(session);
  }

  function createPendingForTab(input) {
    const workspaceId = input.workspaceId || '';
    const key = tabKey(input);
    const existingId = workspaceId
      ? sessionIdByWorkspaceId.get(workspaceId)
      : (key ? sessionIdByTabKey.get(key) : '');
    const existing = existingId ? sessions.get(existingId) : null;
    if (existing) return snapshot(existing);

    const session = {
      pageSessionId: createId('page'),
      runtimeId: '',
      workspaceId,
      browserTabId: input.browserTabId,
      windowId: input.windowId,
      page: normalizePage(input.page),
      selection: null,
      selections: [],
      pickerEnabled: false,
      networkEvents: [],
      pageContext: null,
      taskIds: [],
      status: 'disconnected',
      createdAt: now(),
      updatedAt: now(),
    };
    sessions.set(session.pageSessionId, session);
    if (workspaceId) sessionIdByWorkspaceId.set(workspaceId, session.pageSessionId);
    if (key) sessionIdByTabKey.set(key, session.pageSessionId);
    return snapshot(session);
  }

  function getById(pageSessionId) {
    return snapshot(sessions.get(pageSessionId));
  }

  function getMutableById(pageSessionId) {
    return sessions.get(pageSessionId) || null;
  }

  function getByRuntimeId(runtimeId) {
    const pageSessionId = sessionIdByRuntimeId.get(runtimeId);
    return pageSessionId ? snapshot(sessions.get(pageSessionId)) : null;
  }

  function getByTab(input) {
    const pageSessionId = sessionIdByTabKey.get(tabKey(input));
    return pageSessionId ? snapshot(sessions.get(pageSessionId)) : null;
  }

  function getByWorkspaceId(workspaceId) {
    const pageSessionId = sessionIdByWorkspaceId.get(workspaceId);
    return pageSessionId ? snapshot(sessions.get(pageSessionId)) : null;
  }

  function applyRuntimeEvent(pageSessionId, event) {
    const session = sessions.get(pageSessionId);
    if (!session) return null;
    const type = event?.type || '';
    const payload = event?.payload || {};
    if (type === 'selection.changed') {
      session.selection = payload.selection || payload || null;
      session.selections = Array.isArray(payload.selections)
        ? payload.selections
        : (session.selection ? [session.selection] : []);
    } else if (type === 'page.route_changed') {
      session.page = normalizePage({
        ...session.page,
        url: payload.url || session.page.url,
        title: payload.title || session.page.title,
        routeVersion: Number(session.page.routeVersion || 0) + 1,
      });
      session.selection = null;
      session.selections = [];
    } else if (type === 'network.request') {
      session.networkEvents = [payload, ...session.networkEvents].slice(0, 80);
    } else if (type === 'picker.state') {
      session.pickerEnabled = !!payload.enabled;
    } else if (type === 'page.context') {
      session.pageContext = payload || null;
    }
    session.updatedAt = now();
    return snapshot(session);
  }

  function markRuntimeDisconnected(runtimeId) {
    const pageSessionId = sessionIdByRuntimeId.get(runtimeId);
    const session = pageSessionId ? sessions.get(pageSessionId) : null;
    if (!session) return null;
    session.status = 'disconnected';
    session.updatedAt = now();
    return snapshot(session);
  }

  return {
    applyRuntimeEvent,
    createOrResumeRuntime,
    createPendingForTab,
    getById,
    getByRuntimeId,
    getByTab,
    getByWorkspaceId,
    getMutableById,
    markRuntimeDisconnected,
    snapshot,
  };
}

module.exports = {
  createSessionStore,
};
