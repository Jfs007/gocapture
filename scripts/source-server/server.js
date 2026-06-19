const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  HOST,
  PORT,
  VERSION,
} = require('./core/config');
const { selectDirectory } = require('./resource/dialog');
const { scanProject } = require('./core/project');
const { searchProjectWithMeta } = require('./search');
const { resolvePageRouteTrace } = require('./route-resolvers/registry');
const { runModelLocate } = require('./model/model-adapters');

function sendJson(res, status, payload) {
  const text = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(text);
}

function sendStreamHeaders(res) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
}

function writeStreamEvent(res, event) {
  if (res.destroyed || res.writableEnded) return;
  res.write(`${JSON.stringify(event)}\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function currentProjectSummary(project) {
  if (!project) return null;
  return {
    name: project.name,
    path: project.path,
    kind: project.kind,
    fileCount: project.fileCount,
    stackText: project.stackText,
  };
}

function resolveProjectFile(project, filePath) {
  if (!project || !project.path) throw new Error('No project selected.');
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) throw new Error('File path is required.');
  const fullPath = path.resolve(project.path, normalized);
  const projectRoot = path.resolve(project.path);
  if (fullPath !== projectRoot && !fullPath.startsWith(`${projectRoot}${path.sep}`)) {
    throw new Error('File path is outside current project.');
  }
  if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${normalized}`);
  return fullPath;
}

function openFileInEditor(fullPath) {
  const editor = process.env.MAGNUS_EDITOR || '';
  const command = editor || (process.platform === 'darwin' ? 'open' : 'xdg-open');
  const args = editor
    ? [fullPath]
    : process.platform === 'darwin'
      ? ['-a', 'Visual Studio Code', fullPath]
      : [fullPath];
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function createSourceServer() {
  let currentProject = null;

  async function handle(req, res) {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          success: true,
          name: 'magnus-source-server',
          version: VERSION,
          currentProject: currentProjectSummary(currentProject),
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/source/current') {
        sendJson(res, 200, { success: true, project: currentProject });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/source/select') {
        const body = await readBody(req);
        const selectedPath = body.path || await selectDirectory();
        currentProject = scanProject(selectedPath);
        sendJson(res, 200, { success: true, project: currentProject });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/source/scan') {
        const body = await readBody(req);
        currentProject = scanProject(body.path);
        sendJson(res, 200, { success: true, project: currentProject });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/search') {
        const body = await readBody(req);
        const result = searchProjectWithMeta(currentProject, body);
        sendJson(res, 200, { success: true, hits: result.hits, routeResolver: result.routeResolver, apiTrace: result.apiTrace });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/route/resolve') {
        if (!currentProject) throw new Error('No project selected.');
        const body = await readBody(req);
        const result = resolvePageRouteTrace(currentProject, body, new Map());
        sendJson(res, 200, { success: true, routeResolver: result.trace });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/model/locate') {
        if (!currentProject) throw new Error('No project selected.');
        const body = await readBody(req);
        const result = await runModelLocate(currentProject, body, new Map());
        sendJson(res, 200, { success: true, result });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/model/locate/stream') {
        if (!currentProject) throw new Error('No project selected.');
        const body = await readBody(req);
        sendStreamHeaders(res);
        const controller = new AbortController();
        let finished = false;
        req.on('close', () => {
          if (!finished) controller.abort();
        });
        try {
          const result = await runModelLocate(currentProject, body, new Map(), {
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
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/source/open') {
        const body = await readBody(req);
        const fullPath = resolveProjectFile(currentProject, body.file);
        openFileInEditor(fullPath);
        sendJson(res, 200, { success: true, path: fullPath });
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

  return http.createServer(handle);
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
