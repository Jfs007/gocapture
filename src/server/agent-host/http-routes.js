'use strict';

const { runAgentTask } = require('./llm-adapter');
const {
  memorySnapshot,
  updateComponentExperience,
} = require('../experience/memory-service');
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
const { filterToolsByConfigAction } = require('./capabilities');
const { getMcpStatus, registerConfiguredMcpProviders, stopMcpProvider } = require('./mcp/bootstrap');
const { userConfigPath } = require('./mcp/config');
const { loadLangChainRuntime } = require('./langchain/runtime');

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

  if (req.method === 'GET' && url.pathname === '/api/agent/runtime') {
    const langchain = loadLangChainRuntime();
    sendJson(res, 200, {
      success: true,
      runtimes: {
        langchain: {
          available: langchain.available,
          missing: langchain.missing,
        },
      },
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
    sendJson(res, 200, { success: true, registered, ...getMcpStatus() });
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
      const tools = filterToolsByConfigAction(listAgentTools(), {
        configAction: body.configAction || ['builtin', 'experience', 'skill', 'mcp'],
        allowedTools: body.allowedTools,
        readOnlyOnly: body.readOnlyOnly,
      });
      const result = await runAgentTask(project, {
        ...body,
        objective: body.objective || body.prompt || '',
        configAction: body.configAction || ['builtin', 'experience', 'skill', 'mcp'],
        signal: controller.signal,
        onEvent: event => writeStreamEvent(res, event),
      }, {
        tools,
        executeTool: executeAgentTool,
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
    const experience = updateComponentExperience(project, body);
    sendJson(res, 200, { success: true, experience, memory: memorySnapshot(project) });
    return true;
  }

  return false;
}

module.exports = {
  handleAgentHostRoutes,
};
