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
  if (!project || !project.path) return;
  const log = typeof onLog === 'function' ? onLog : message => console.log(`[agent-host] ${message}`);
  registerConfiguredMcpProviders(project.path, { onLog: log })
    .catch(error => console.error(`[mcp] 登记异常：${error.message || error}`));
  try {
    registerConfiguredSkillProviders(project.path, { onLog: log });
  } catch (error) {
    console.error(`[skills] 登记异常：${error.message || error}`);
  }
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

  async function bind(selectedPath, options = {}) {
    const project = scanProject(selectedPath);
    const experienceMetas = loadExperienceMetas(project);
    const withContext = bindProjectContext(project, { experienceMetas });
    if (!options.adapter) {
      currentProject = withContext;
      registerProjectCapabilities(currentProject, options.onLog);
      return currentProject;
    }
    const interpreted = await interpretProject(withContext, options.adapter, {
      experienceMetas,
      signal: options.signal,
      onLog: options.onLog,
    });
    currentProject = interpreted.project;
    registerProjectCapabilities(currentProject, options.onLog);
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

  return {
    bind,
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
