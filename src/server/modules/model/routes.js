'use strict';

const {
  runModelLocate,
  runSelectionContextEnhancement,
} = require('../../model/model-adapters');

async function handleModelRoutes({
  req,
  res,
  url,
  projectContext,
  readBody,
  sendJson,
  sendStreamHeaders,
  writeStreamEvent,
}) {
  if (req.method === 'POST' && url.pathname === '/api/model/locate') {
    const project = projectContext.requireCurrent();
    const body = await readBody(req);
    const result = await runModelLocate(project, body, new Map());
    sendJson(res, 200, { success: true, result });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/model/locate/stream') {
    const project = projectContext.requireCurrent();
    const body = await readBody(req);
    sendStreamHeaders(res);
    const controller = new AbortController();
    let finished = false;
    req.on('close', () => {
      if (!finished) controller.abort();
    });
    try {
      const result = await runModelLocate(project, body, new Map(), {
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
        logs: Array.isArray(error.modelLogs) ? error.modelLogs : undefined,
      });
      res.end();
    }
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/model/selection-context/stream') {
    const project = projectContext.requireCurrent();
    const body = await readBody(req);
    sendStreamHeaders(res);
    const controller = new AbortController();
    let finished = false;
    req.on('close', () => {
      if (!finished) controller.abort();
    });
    try {
      if (typeof projectContext.ensureCapabilities === 'function') {
        await projectContext.ensureCapabilities({
          timeoutMs: 8000,
          onLog: log => writeStreamEvent(res, { type: 'log', log }),
        });
      }
      const result = await runSelectionContextEnhancement(project, body, new Map(), {
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
        logs: Array.isArray(error.modelLogs) ? error.modelLogs : undefined,
      });
      res.end();
    }
    return true;
  }

  return false;
}

module.exports = {
  handleModelRoutes,
};
