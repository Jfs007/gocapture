'use strict';

async function handleBridgeRoutes({ req, res, url, bridge, readBody, sendJson }) {
  if (req.method === 'POST' && url.pathname === '/api/panel/bind') {
    const body = await readBody(req);
    const result = bridge.bindPanel(body);
    sendJson(res, 200, { success: true, ...result });
    return true;
  }

  return false;
}

module.exports = {
  handleBridgeRoutes,
};
