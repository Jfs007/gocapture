'use strict';

const { searchProjectWithMeta } = require('../../search');
const { runAgentSearch } = require('../../search/agent-search');

async function handleSearchRoutes({
  req,
  res,
  url,
  projectContext,
  readBody,
  sendJson,
  sendStreamHeaders,
  writeStreamEvent,
}) {
  if (req.method === 'POST' && url.pathname === '/api/search') {
    const body = await readBody(req);
    const result = searchProjectWithMeta(projectContext.get(), body);
    sendJson(res, 200, {
      success: true,
      hits: result.hits,
      routeResolver: result.routeResolver,
      apiTrace: result.apiTrace,
      i18nTrace: result.i18nTrace,
      definitionTrace: result.definitionTrace,
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/search/stream') {
    const project = projectContext.requireCurrent();
    const body = await readBody(req);
    sendStreamHeaders(res);
    const controller = new AbortController();
    let finished = false;
    req.on('close', () => {
      if (!finished) controller.abort();
    });
    try {
      const result = await runAgentSearch(project, body, {
        signal: controller.signal,
        onLog: log => writeStreamEvent(res, { type: 'log', log }),
      });
      finished = true;
      writeStreamEvent(res, { type: 'result', result });
      res.end();
    } catch (error) {
      finished = true;
      writeStreamEvent(res, {
        type: 'error',
        error: error.message || String(error),
      });
      res.end();
    }
    return true;
  }

  return false;
}

module.exports = {
  handleSearchRoutes,
};
