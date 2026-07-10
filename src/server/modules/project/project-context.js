'use strict';

const { scanProject } = require('../../core/project');
const { bindProjectContext } = require('../../experience/project-context');
const { interpretProject } = require('../../experience/project-interpreter');
const { loadExperienceMetas } = require('../../experience/experience-store');
const { registerConfiguredMcpProviders } = require('../../agent-host/mcp/bootstrap');
const { registerConfiguredSkillProviders } = require('../../agent-host/skills/bootstrap');

// 绑定项目后，把该项目的 MCP server（.mcp.json）与 Skills（.magnus/skills/*/SKILL.md）登记成工具 provider。
// MCP 异步 fire-and-forget（server 慢/挂不阻塞项目选择，内部按 server 容错）；Skills 是本地文件、同步即可。
function registerProjectCapabilities(project, onLog) {
  if (!project || !project.path) return Promise.resolve([]);
  const log = typeof onLog === 'function' ? onLog : message => console.log(`[agent-host] ${message}`);
  const mcpReady = registerConfiguredMcpProviders(project.path, { onLog: log })
    .catch(error => console.error(`[mcp] 登记异常：${error.message || error}`));
  try {
    registerConfiguredSkillProviders(project.path, { onLog: log });
  } catch (error) {
    console.error(`[skills] 登记异常：${error.message || error}`);
  }
  return mcpReady;
}

function waitFor(promise, timeoutMs, label) {
  if (!promise || typeof promise.then !== 'function') return Promise.resolve();
  let timer;
  return Promise.race([
    promise,
    new Promise(resolve => {
      timer = setTimeout(() => resolve({ timeout: true, label }), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function projectSummary(project) {
  if (!project) return null;
  return {
    name: project.name,
    path: project.path,
    kind: project.kind,
    fileCount: project.fileCount,
    stackText: project.stackText,
  };
}

function createProjectContext() {
  let currentProject = null;
  let capabilitiesReady = Promise.resolve([]);

  async function bind(selectedPath, options = {}) {
    const project = scanProject(selectedPath);
    const experienceMetas = loadExperienceMetas(project);
    const withContext = bindProjectContext(project, { experienceMetas });
    if (!options.adapter) {
      currentProject = withContext;
      capabilitiesReady = registerProjectCapabilities(currentProject, options.onLog);
      return currentProject;
    }
    const interpreted = await interpretProject(withContext, options.adapter, {
      experienceMetas,
      signal: options.signal,
      onLog: options.onLog,
    });
    currentProject = interpreted.project;
    capabilitiesReady = registerProjectCapabilities(currentProject, options.onLog);
    return currentProject;
  }

  function get() {
    return currentProject;
  }

  function requireCurrent() {
    if (!currentProject) throw new Error('No project selected.');
    return currentProject;
  }

  function resolve(projectPath) {
    const requested = String(projectPath || '');
    if (!requested) return requireCurrent();
    if (currentProject?.path === requested) return currentProject;
    const project = scanProject(requested);
    return bindProjectContext(project, {
      experienceMetas: loadExperienceMetas(project),
    });
  }

  function summary() {
    return projectSummary(currentProject);
  }

  async function ensureCapabilities(options = {}) {
    const timeoutMs = Number(options.timeoutMs || 8000);
    const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
    if (!currentProject) return;
    onLog(`Agent 能力检查：等待 MCP/Skills 注册完成（最多 ${timeoutMs}ms）`);
    const result = await waitFor(capabilitiesReady, timeoutMs, 'agent-capabilities');
    if (result?.timeout) {
      onLog('Agent 能力检查：MCP 注册仍在后台进行，本轮使用已登记工具继续');
    } else {
      onLog('Agent 能力检查：MCP/Skills 注册已完成');
    }
  }

  return {
    bind,
    ensureCapabilities,
    get,
    requireCurrent,
    resolve,
    summary,
  };
}

module.exports = {
  createProjectContext,
  projectSummary,
};
