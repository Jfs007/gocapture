const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  HOST,
  PORT,
  VERSION,
} = require('./core/config');
const { createBridge } = require('./bridge');
const { selectDirectory } = require('./resource/dialog');
const { scanProject } = require('./core/project');
const { bindProjectContext } = require('./experience/project-context');
const { interpretProject } = require('./experience/project-interpreter');
const { loadSkillMetas } = require('./experience/skill-store');
const {
  memorySnapshot,
  removeTaskSessionMemory,
  updateStoredSkill,
  updateTaskSessionMemory,
} = require('./experience/memory-service');
const { searchProjectWithMeta } = require('./search');
const { runAgentSearch } = require('./search/agent-search');
const { resolvePageRouteTrace } = require('./route-resolvers/registry');
const {
  runModelLocate,
  runSelectionContextEnhancement,
} = require('./model/model-adapters');
const { handleUiRequest } = require('./ui/serve-ui');
const updateService = require('./update/update-service');

const ACCESS_CONTROL_ALLOW_HEADERS = 'content-type,x-magnus-internal';

function sendJson(res, status, payload) {
  const text = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': ACCESS_CONTROL_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(text);
}

function sendStreamHeaders(res) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': ACCESS_CONTROL_ALLOW_HEADERS,
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
      if (data.length > 4 * 1024 * 1024) {
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

function openFileInEditor(fullPath, line = 0, column = 0) {
  const editor = process.env.MAGNUS_EDITOR || '';
  const target = Number(line) > 0
    ? `${fullPath}:${Math.max(1, Number(line))}:${Math.max(1, Number(column) || 1)}`
    : fullPath;
  let command;
  let args;
  if (editor) {
    // 允许 MAGNUS_EDITOR 形如 "code --goto"；有行号时用 file:line:column 定位。
    const parts = editor.split(/\s+/).filter(Boolean);
    command = parts[0];
    args = [...parts.slice(1), target];
  } else if (process.platform === 'darwin') {
    // VS Code 支持 code --goto file:line:column 直接跳到行；退化到 open。
    command = 'code';
    args = Number(line) > 0 ? ['--goto', target] : ['-a', 'Visual Studio Code', fullPath];
  } else {
    command = 'code';
    args = Number(line) > 0 ? ['--goto', target] : [fullPath];
  }
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  // code CLI 不在 PATH 时回退到系统打开，避免跳转失败。
  child.on('error', () => {
    const fallbackCommand = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const fallback = spawn(fallbackCommand, [fullPath], { detached: true, stdio: 'ignore' });
    fallback.on('error', () => {});
    fallback.unref();
  });
  child.unref();
}

function createSourceServer() {
  let currentProject = null;
  const bridge = createBridge();

  async function bindSourceProject(selectedPath, options = {}) {
    const project = scanProject(selectedPath);
    const skillMetas = loadSkillMetas(project);
    const withContext = bindProjectContext(project, { skillMetas });
    if (!options.adapter) return withContext;
    const interpreted = await interpretProject(withContext, options.adapter, {
      skillMetas,
      signal: options.signal,
      onLog: options.onLog,
    });
    return interpreted.project;
  }

  function memoryProject(projectPath) {
    const requested = String(projectPath || '');
    if (!requested) {
      if (!currentProject) throw new Error('No project selected.');
      return currentProject;
    }
    if (currentProject?.path === requested) return currentProject;
    const project = scanProject(requested);
    return bindProjectContext(project, {
      skillMetas: loadSkillMetas(project),
    });
  }

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

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          success: true,
          name: 'magnus-source-server',
          version: VERSION,
          currentProject: currentProjectSummary(currentProject),
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/version') {
        sendJson(res, 200, { success: true, ...updateService.packageInfo() });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/update/check') {
        const result = await updateService.checkForUpdate();
        sendJson(res, 200, { success: true, ...result });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/update/apply') {
        const result = updateService.applyUpdate(message => console.log(`[update] ${message}`));
        sendJson(res, result.started ? 200 : 400, { success: result.started, ...result });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/panel/bind') {
        const body = await readBody(req);
        const result = bridge.bindPanel(body);
        sendJson(res, 200, { success: true, ...result });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/source/current') {
        sendJson(res, 200, { success: true, project: currentProject });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/source/select') {
        const body = await readBody(req);
        const selectedPath = body.path || await selectDirectory();
        currentProject = await bindSourceProject(selectedPath);
        sendJson(res, 200, { success: true, project: currentProject });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/source/scan') {
        const body = await readBody(req);
        currentProject = await bindSourceProject(body.path);
        sendJson(res, 200, { success: true, project: currentProject });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/source/interpret/stream') {
        const body = await readBody(req);
        const selectedPath = body.path || currentProject?.path;
        if (!selectedPath) throw new Error('No project selected.');
        if (!body.adapter) throw new Error('Project Interpreter 需要模型配置。');
        sendStreamHeaders(res);
        const controller = new AbortController();
        let finished = false;
        req.on('close', () => {
          if (!finished) controller.abort();
        });
        try {
          currentProject = await bindSourceProject(selectedPath, {
            adapter: body.adapter,
            signal: controller.signal,
            onLog: log => writeStreamEvent(res, { type: 'log', log }),
          });
          finished = true;
          writeStreamEvent(res, { type: 'result', result: { project: currentProject } });
          res.end();
        } catch (error) {
          finished = true;
          writeStreamEvent(res, { type: 'error', error: error.message || String(error) });
          res.end();
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/search') {
        const body = await readBody(req);
        const result = searchProjectWithMeta(currentProject, body);
        sendJson(res, 200, {
          success: true,
          hits: result.hits,
          routeResolver: result.routeResolver,
          apiTrace: result.apiTrace,
          i18nTrace: result.i18nTrace,
          definitionTrace: result.definitionTrace,
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/search/stream') {
        if (!currentProject) throw new Error('No project selected.');
        const body = await readBody(req);
        sendStreamHeaders(res);
        const controller = new AbortController();
        let finished = false;
        req.on('close', () => {
          if (!finished) controller.abort();
        });
        try {
          const result = await runAgentSearch(currentProject, body, {
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

      if (req.method === 'POST' && url.pathname === '/api/model/selection-context/stream') {
        if (!currentProject) throw new Error('No project selected.');
        const body = await readBody(req);
        sendStreamHeaders(res);
        const controller = new AbortController();
        let finished = false;
        req.on('close', () => {
          if (!finished) controller.abort();
        });
        try {
          const result = await runSelectionContextEnhancement(currentProject, body, new Map(), {
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

      if (req.method === 'GET' && url.pathname === '/api/memory') {
        const project = memoryProject(url.searchParams.get('projectPath'));
        sendJson(res, 200, { success: true, memory: memorySnapshot(project) });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/memory/read') {
        const body = await readBody(req);
        const project = memoryProject(body.projectPath);
        sendJson(res, 200, { success: true, memory: memorySnapshot(project) });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/memory/skill') {
        const body = await readBody(req);
        const project = memoryProject(body.projectPath);
        const skill = updateStoredSkill(project, body);
        bindProjectContext(project, { skillMetas: loadSkillMetas(project) });
        sendJson(res, 200, { success: true, skill, memory: memorySnapshot(project) });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/memory/session') {
        const body = await readBody(req);
        const project = memoryProject(body.projectPath);
        const session = updateTaskSessionMemory(project, body.id, body);
        sendJson(res, 200, { success: true, session, memory: memorySnapshot(project) });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/memory/session/remove') {
        const body = await readBody(req);
        const project = memoryProject(body.projectPath);
        const removed = removeTaskSessionMemory(project, body.id);
        sendJson(res, 200, { success: true, removed, memory: memorySnapshot(project) });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/source/open') {
        const body = await readBody(req);
        const fullPath = resolveProjectFile(currentProject, body.file);
        openFileInEditor(fullPath, body.line, body.column);
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

  const server = http.createServer(handle);
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
