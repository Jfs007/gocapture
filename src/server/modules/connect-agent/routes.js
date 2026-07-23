'use strict';

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
  if (req.method === 'GET' && url.pathname === '/api/connect-agents') {
    const refresh = url.searchParams.get('refresh') === '1';
    const providers = await connectAgent.list({ refresh });
    sendJson(res, 200, { success: true, providers });
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
      const result = await connectAgent.runTask(taskMatch[1], {
        ...body,
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

  await readBody(req);
  const [, providerId, action] = match;
  const provider = action === 'check'
    ? await connectAgent.inspect(providerId)
    : action === 'connect'
      ? await connectAgent.connect(providerId)
      : connectAgent.disconnect(providerId);
  sendJson(res, 200, { success: true, provider });
  return true;
}

module.exports = {
  handleConnectAgentRoutes,
};
