'use strict';

const { searchProjectWithMeta } = require('../../search/keyword');
const { runAgentSearch } = require('../../search/agent-search');

function resolveRequestProject(projectContext, body) {
  const requestedPath = String(body?.projectRoot || body?.projectPath || '').trim();
  if (requestedPath && typeof projectContext.resolve === 'function') {
    return projectContext.resolve(requestedPath);
  }
  return projectContext.requireCurrent();
}

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
    const project = resolveRequestProject(projectContext, body);
    if (!body.adapter) {
      // 未配置定位模型：DOM Agent 需要模型，降级为纯关键词检索（不抛错）。
      const result = searchProjectWithMeta(project, body);
      sendJson(res, 200, { success: true, ...result, agent: { enabled: false } });
      return true;
    }
    const result = await runAgentSearch(project, body);
    sendJson(res, 200, { success: true, ...result });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/search/stream') {
    const body = await readBody(req);
    const project = resolveRequestProject(projectContext, body);
    sendStreamHeaders(res);
    const controller = new AbortController();
    let finished = false;
    req.on('close', () => {
      if (!finished) controller.abort();
    });
    try {
      const requestedProject = String(body?.projectRoot || body?.projectPath || '').trim();
      writeStreamEvent(res, {
        type: 'log',
        log: `检索项目解析：请求=${requestedProject || '(未指定，使用当前项目)'}；实际=${project.path}`,
      });
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
  resolveRequestProject,
};
