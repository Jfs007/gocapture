const http = require('http');
const {
  HOST,
  PORT,
} = require('./core/config');
const { createBridge } = require('./bridge');
const { createConnectAgentService } = require('./connect-agent');
const { handleAgentHostRoutes } = require('./agent-host/http-routes');
const { readBody } = require('./http/body');
const {
  sendJson,
  sendStreamHeaders,
  writeStreamEvent,
} = require('./http/response');
const { handleBridgeRoutes } = require('./modules/bridge/routes');
const { handleConnectAgentRoutes } = require('./modules/connect-agent/routes');
const { handleModelRoutes } = require('./modules/model/routes');
const { handleProjectRoutes } = require('./modules/project/routes');
const { createProjectContext } = require('./modules/project/project-context');
const { handleRegistryRoutes } = require('./modules/registry/routes');
const { handleSearchRoutes } = require('./modules/search/routes');
const { handleUpdateRoutes } = require('./modules/update/routes');
const { handleUiRequest } = require('./ui/serve-ui');

function createSourceServer() {
  const bridge = createBridge();
  const connectAgent = createConnectAgentService();
  const projectContext = createProjectContext();

  async function handle(req, res) {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    try {
      if (req.method === 'GET' && handleUiRequest(req, res, url, { host: HOST, port: PORT })) {
        return;
      }

      if (await handleUpdateRoutes({
        req,
        res,
        url,
        sendJson,
      })) {
        return;
      }

      if (await handleAgentHostRoutes({
        req,
        res,
        url,
        readBody,
        sendJson,
        sendStreamHeaders,
        writeStreamEvent,
        resolveProject: projectContext.resolve,
      })) {
        return;
      }

      if (await handleBridgeRoutes({
        req,
        res,
        url,
        bridge,
        readBody,
        sendJson,
      })) {
        return;
      }

      if (await handleConnectAgentRoutes({
        req,
        res,
        url,
        connectAgent,
        projectContext,
        readBody,
        sendJson,
        sendStreamHeaders,
        writeStreamEvent,
      })) {
        return;
      }

      if (await handleRegistryRoutes({
        req,
        res,
        url,
        readBody,
        sendJson,
      })) {
        return;
      }

      if (await handleProjectRoutes({
        req,
        res,
        url,
        projectContext,
        readBody,
        sendJson,
        sendStreamHeaders,
        writeStreamEvent,
      })) {
        return;
      }

      if (await handleSearchRoutes({
        req,
        res,
        url,
        projectContext,
        readBody,
        sendJson,
        sendStreamHeaders,
        writeStreamEvent,
      })) {
        return;
      }

      if (await handleModelRoutes({
        req,
        res,
        url,
        projectContext,
        readBody,
        sendJson,
        sendStreamHeaders,
        writeStreamEvent,
      })) {
        return;
      }

      sendJson(res, 404, { success: false, error: 'Not found.' });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: error.message || String(error),
        logs: Array.isArray(error.modelLogs) ? error.modelLogs : undefined,
      });
    }
  }

  const server = http.createServer(handle);
  server.on('close', () => connectAgent.close());
  server.on('upgrade', (req, socket) => {
    if (!bridge.handleUpgrade(req, socket)) {
      socket.destroy();
    }
  });
  return server;
}

function startSourceServer() {
  const server = createSourceServer();
  server.on('error', error => {
    console.error(`[source-server] failed to listen on http://${HOST}:${PORT}`);
    console.error(`[source-server] ${error.message || error}`);
    process.exit(1);
  });
  server.listen(PORT, HOST, () => {
    console.log(`[source-server] listening on http://${HOST}:${PORT}`);
    console.log('[source-server] POST /api/source/select opens a native directory picker.');
  });
  return server;
}

module.exports = {
  createSourceServer,
  readBody,
  sendJson,
  startSourceServer,
};
