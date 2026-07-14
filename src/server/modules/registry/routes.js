'use strict';

const {
  REGISTRY_FILE,
  bindPageProject,
  readRegistry,
  resolvePageProject,
} = require('./page-registry');

async function handleRegistryRoutes({
  req,
  res,
  url,
  readBody,
  sendJson,
}) {
  if (req.method === 'GET' && url.pathname === '/api/registry') {
    sendJson(res, 200, {
      success: true,
      registry: readRegistry(),
      path: REGISTRY_FILE,
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/registry/resolve') {
    const pageUrl = url.searchParams.get('url') || '';
    sendJson(res, 200, {
      success: true,
      binding: resolvePageProject({ url: pageUrl }),
      path: REGISTRY_FILE,
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/registry/bind') {
    const body = await readBody(req);
    const result = bindPageProject(body);
    sendJson(res, 200, {
      success: true,
      binding: result.binding,
      registry: result.registry,
      path: REGISTRY_FILE,
    });
    return true;
  }

  return false;
}

module.exports = {
  handleRegistryRoutes,
};
