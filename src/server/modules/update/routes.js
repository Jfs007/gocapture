'use strict';

const updateService = require('../../update/update-service');

async function handleUpdateRoutes({ req, res, url, sendJson }) {
  if (req.method === 'GET' && url.pathname === '/api/version') {
    sendJson(res, 200, { success: true, ...updateService.packageInfo() });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/update/check') {
    const result = await updateService.checkForUpdate();
    sendJson(res, 200, { success: true, ...result });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/update/status') {
    sendJson(res, 200, { success: true, ...updateService.updateStatus() });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/update/apply') {
    const result = updateService.applyUpdate(message => console.log(`[update] ${message}`));
    sendJson(res, result.started ? 200 : 400, { success: result.started, ...result });
    return true;
  }

  return false;
}

module.exports = {
  handleUpdateRoutes,
};
