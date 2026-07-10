'use strict';

const { bindProjectContext } = require('../experience/project-context');
const { runAgentLoop } = require('./loop/runner');
const {
  memorySnapshot,
  removeTaskSessionMemory,
  updateTaskSessionMemory,
} = require('../experience/memory-service');
const { listExperiences, updateProjectExperience } = require('./experiences/registry');
const {
  listAgentResourceProviders,
  listAgentResources,
  readAgentResource,
} = require('./resources/registry');
const {
  executeAgentTool,
  listAgentToolProviders,
  listAgentTools,
} = require('./tools/registry');
const { getMcpStatus, registerConfiguredMcpProviders, stopMcpProvider } = require('./mcp/bootstrap');
const { userConfigPath } = require('./mcp/config');

async function handleAgentHostRoutes(context) {
  const {
    req,
    res,
    url,
    readBody,
    sendJson,
    sendStreamHeaders,
    writeStreamEvent,
    resolveProject,
  } = context;

  if (req.method === 'GET' && url.pathname === '/api/agent/tools') {
    sendJson(res, 200, {
      success: true,
      providers: listAgentToolProviders(),
      tools: listAgentTools(),
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/agent/tool-providers') {
    sendJson(res, 200, { success: true, providers: listAgentToolProviders() });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/agent/mcp/status') {
    const projectPath = url.searchParams.get('projectPath') || '';
    sendJson(res, 200, {
      success: true,
      config: {
        user: userConfigPath(),
        project: projectPath ? `${projectPath.replace(/\/$/, '')}/.mcp.json` : '<projectRoot>/.mcp.json',
      },
      ...getMcpStatus(),
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/mcp/reload') {
    const body = await readBody(req);
    const project = resolveProject(body.projectPath);
    const registered = await registerConfiguredMcpProviders(project.path, {
      onLog: () => {},
      connectTimeoutMs: Number(body.connectTimeoutMs || 30000),
    });
    sendJson(res, 200, { success: true, registered: registered.map(item => ({ name: item.name, toolCount: item.toolCount, tools: item.tools })), ...getMcpStatus() });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/mcp/stop') {
    const body = await readBody(req);
    const result = stopMcpProvider(body.name || body.server || body.providerId);
    sendJson(res, 200, { success: true, result, ...getMcpStatus() });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/tool/run') {
    const body = await readBody(req);
    const project = resolveProject(body.projectPath);
    const output = await executeAgentTool(project, body.toolCall || body);
    sendJson(res, 200, { success: true, output });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/run/stream') {
    const body = await readBody(req);
    const project = resolveProject(body.projectPath);
    if (!body.adapter) throw new Error('Agent run requires adapter.');
    sendStreamHeaders(res);
    const controller = new AbortController();
    let finished = false;
    req.on('close', () => {
      if (!finished) controller.abort();
    });
    try {
      const result = await runAgentLoop(project, {
        ...body,
        signal: controller.signal,
        onEvent: event => writeStreamEvent(res, event),
      });
      finished = true;
      writeStreamEvent(res, { type: 'result', result });
      res.end();
    } catch (error) {
      finished = true;
      writeStreamEvent(res, { type: 'error', error: error.message || String(error) });
      res.end();
    }
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/agent/resources') {
    const project = resolveProject(url.searchParams.get('projectPath'));
    sendJson(res, 200, {
      success: true,
      providers: listAgentResourceProviders(),
      resources: listAgentResources(project),
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/agent/resource-providers') {
    sendJson(res, 200, { success: true, providers: listAgentResourceProviders() });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/agent/resource/read') {
    const body = await readBody(req);
    const project = resolveProject(body.projectPath);
    const resource = readAgentResource(project, body.uri);
    sendJson(res, 200, { success: true, resource });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/memory') {
    const project = resolveProject(url.searchParams.get('projectPath'));
    sendJson(res, 200, { success: true, memory: memorySnapshot(project) });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/memory/read') {
    const body = await readBody(req);
    const project = resolveProject(body.projectPath);
    sendJson(res, 200, { success: true, memory: memorySnapshot(project) });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/experience') {
    const project = resolveProject(url.searchParams.get('projectPath'));
    sendJson(res, 200, { success: true, memory: memorySnapshot(project) });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/experience') {
    const body = await readBody(req);
    const project = resolveProject(body.projectPath);
    const experience = updateProjectExperience(project, body);
    bindProjectContext(project, { experienceMetas: listExperiences(project) });
    sendJson(res, 200, { success: true, experience, memory: memorySnapshot(project) });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/memory/session') {
    const body = await readBody(req);
    const project = resolveProject(body.projectPath);
    const session = updateTaskSessionMemory(project, body.id, body);
    sendJson(res, 200, { success: true, session, memory: memorySnapshot(project) });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/memory/session/remove') {
    const body = await readBody(req);
    const project = resolveProject(body.projectPath);
    const removed = removeTaskSessionMemory(project, body.id);
    sendJson(res, 200, { success: true, removed, memory: memorySnapshot(project) });
    return true;
  }

  return false;
}

module.exports = {
  handleAgentHostRoutes,
};
