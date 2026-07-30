'use strict';

const { scanProject } = require('../../core/project');
const { registerConfiguredMcpProviders } = require('../../agent-host/mcp/bootstrap');

// 绑定项目后记录该项目可用的 MCP 配置。
// MCP server 不注册成全局 provider；关联 Agent 每轮运行时按当前项目加载 MCP tools。
function registerProjectCapabilities(project, onLog) {
  if (!project || !project.path) return Promise.resolve([]);
  const log = typeof onLog === 'function' ? onLog : message => console.log(`[mcp] ${message}`);
  return registerConfiguredMcpProviders(project.path, { onLog: log })
    .catch(error => console.error(`[mcp] 登记异常：${error.message || error}`));
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
    currentProject = scanProject(selectedPath);
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
    return scanProject(requested);
  }

  function summary() {
    return projectSummary(currentProject);
  }

  async function ensureCapabilities(options = {}) {
    const timeoutMs = Number(options.timeoutMs || 8000);
    const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
    if (!currentProject) return;
    onLog(`Agent 能力检查：等待项目能力登记完成（最多 ${timeoutMs}ms）`);
    const result = await waitFor(capabilitiesReady, timeoutMs, 'agent-capabilities');
    if (result?.timeout) {
      onLog('Agent 能力检查：项目能力登记仍在后台进行，本轮使用已登记工具继续');
    } else {
      onLog('Agent 能力检查：项目能力登记已完成；MCP 将在 LangChain Agent 运行时加载');
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
