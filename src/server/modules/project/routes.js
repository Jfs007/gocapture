'use strict';

const { VERSION } = require('../../core/config');
const { selectDirectory } = require('../../resource/dialog');
const { resolvePageRouteTrace } = require('../../route-resolvers/registry');
const {
  openFileInEditor,
  resolveProjectFile,
} = require('../editor/open-file');

async function handleProjectRoutes({
  req,
  res,
  url,
  projectContext,
  readBody,
  sendJson,
  sendStreamHeaders,
  writeStreamEvent,
}) {
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      success: true,
      name: 'gocapture-source-server',
      version: VERSION,
      currentProject: projectContext.summary(),
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/source/current') {
    sendJson(res, 200, { success: true, project: projectContext.get() });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/source/select') {
    const body = await readBody(req);
    const selectedPath = body.path || await selectDirectory();
    const project = await projectContext.bind(selectedPath);
    sendJson(res, 200, { success: true, project });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/source/scan') {
    const body = await readBody(req);
    const project = await projectContext.bind(body.path);
    sendJson(res, 200, { success: true, project });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/route/resolve') {
    const project = projectContext.requireCurrent();
    const body = await readBody(req);
    const result = resolvePageRouteTrace(project, body, new Map());
    sendJson(res, 200, { success: true, routeResolver: result.trace });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/source/open') {
    const body = await readBody(req);
    const fullPath = resolveProjectFile(projectContext.get(), body.file);
    openFileInEditor(fullPath, body.line, body.column);
    sendJson(res, 200, { success: true, path: fullPath });
    return true;
  }

  return false;
}

module.exports = {
  handleProjectRoutes,
};
