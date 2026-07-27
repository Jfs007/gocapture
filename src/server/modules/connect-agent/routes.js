'use strict';

const { buildLocatorEvidencePackage } = require('../../search/locator-evidence');
const { loadProjectMessages } = require('../../connect-agent/message-store');
const {
  deleteProjectSelectionLocations,
  loadProjectSelectionLocations,
} = require('../../connect-agent/selection-reference-store');

async function handleConnectAgentRoutes({
  req,
  res,
  url,
  connectAgent,
  projectContext,
  readBody,
  sendJson,
  sendStreamHeaders,
  writeStreamEvent,
}) {
  if (url.pathname === '/api/connect-agents/selections' && req.method === 'GET') {
    const projectRoot = String(url.searchParams.get('projectRoot') || '').trim();
    const project = projectContext.resolve(projectRoot);
    sendJson(res, 200, {
      success: true,
      selections: loadProjectSelectionLocations(project),
    });
    return true;
  }

  if (url.pathname === '/api/connect-agents/selections' && req.method === 'DELETE') {
    const body = await readBody(req);
    const project = projectContext.resolve(body.projectRoot);
    const deleted = deleteProjectSelectionLocations(project, body.selectionIds);
    sendJson(res, 200, { success: true, deleted });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/connect-agents/messages') {
    const projectRoot = String(url.searchParams.get('projectRoot') || '').trim();
    const providerId = String(url.searchParams.get('providerId') || 'codex').trim();
    const project = projectContext.resolve(projectRoot);
    const messages = loadProjectMessages(project, providerId, {
      limit: url.searchParams.get('limit'),
    });
    sendJson(res, 200, { success: true, messages });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/connect-agents') {
    const refresh = url.searchParams.get('refresh') === '1';
    const projectRoot = String(url.searchParams.get('projectRoot') || '').trim();
    const project = projectRoot ? projectContext.resolve(projectRoot) : null;
    const providers = (await connectAgent.list({ refresh })).map(provider => {
      const session = project ? connectAgent.projectSession(provider.id, project) : null;
      return {
        ...provider,
        ...(project
          ? {
              projectThreadId: session?.threadId || '',
              projectThreadName: session?.threadName || '',
              projectThreadSource: session?.source || '',
            }
          : {}),
      };
    });
    sendJson(res, 200, { success: true, providers });
    return true;
  }

  const threadsMatch = url.pathname.match(/^\/api\/connect-agents\/([^/]+)\/threads$/);
  if (threadsMatch && req.method === 'GET') {
    const projectRoot = String(url.searchParams.get('projectRoot') || '').trim();
    const project = projectContext.resolve(projectRoot);
    const threads = await connectAgent.listBindableThreads(threadsMatch[1], project);
    sendJson(res, 200, { success: true, threads });
    return true;
  }

  const bindThreadMatch = url.pathname.match(/^\/api\/connect-agents\/([^/]+)\/bind-thread$/);
  if (bindThreadMatch && req.method === 'POST') {
    const body = await readBody(req);
    const project = projectContext.resolve(body.projectRoot);
    const session = await connectAgent.bindProjectThread(
      bindThreadMatch[1],
      project,
      body.threadId,
    );
    sendJson(res, 200, { success: true, session });
    return true;
  }

  const taskMatch = url.pathname.match(/^\/api\/connect-agents\/([^/]+)\/tasks\/stream$/);
  if (taskMatch && req.method === 'POST') {
    const body = await readBody(req);
    const project = projectContext.resolve(body.projectRoot);
    const abortController = new AbortController();
    res.on?.('close', () => {
      if (!res.writableEnded) abortController.abort();
    });
    sendStreamHeaders(res);
    try {
      const taskInput = { ...body };
      if (!hasLocatedSelectionBindings(body.selectionBindings)) {
        const searchBody = body.searchPayload || body;
        const prepared = buildLocatorEvidencePackage(project, searchBody, {
          includeProjectStructure: false,
          onLog: log => writeStreamEvent(res, { type: 'log', message: log }),
        });
        taskInput.locatorEvidence = prepared.evidence;
        writeStreamEvent(res, {
          type: 'locator-evidence',
          evidence: {
            route: prepared.evidence.route,
            selectionCount: prepared.evidence.selections.length,
          },
        });
      }
      const result = await connectAgent.runTask(taskMatch[1], {
        ...taskInput,
        project,
        signal: abortController.signal,
        onEvent: event => writeStreamEvent(res, event),
      });
      writeStreamEvent(res, { type: 'result', result });
    } catch (error) {
      writeStreamEvent(res, {
        type: 'error',
        error: error.message || String(error),
        task: error.task || null,
      });
    } finally {
      if (!res.writableEnded) res.end();
    }
    return true;
  }

  const match = url.pathname.match(/^\/api\/connect-agents\/([^/]+)\/(check|connect|disconnect)$/);
  if (!match || req.method !== 'POST') return false;

  const body = await readBody(req);
  const [, providerId, action] = match;
  const provider = action === 'check'
    ? await connectAgent.inspect(providerId)
    : action === 'connect'
      ? await connectAgent.connect(providerId, body || {})
      : connectAgent.disconnect(providerId);
  sendJson(res, 200, { success: true, provider });
  return true;
}

function hasLocatedSelectionBindings(selectionBindings) {
  return (Array.isArray(selectionBindings) ? selectionBindings : []).some(item => {
    const binding = item?.binding || item || {};
    return (Array.isArray(binding.targets) ? binding.targets : [])
      .some(target => String(target?.file || '').trim() && (
        Number(target?.startLine || target?.line || 0) > 0
        || String(target?.anchor || target?.targetSnippet || target?.codeSnippet || '').trim()
      ));
  });
}

module.exports = {
  hasLocatedSelectionBindings,
  handleConnectAgentRoutes,
};
