'use strict';

const { scanProject } = require('../../core/project');
const { bindProjectContext } = require('../../experience/project-context');
const { interpretProject } = require('../../experience/project-interpreter');
const { loadExperienceMetas } = require('../../experience/experience-store');

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
      return currentProject;
    }
    const interpreted = await interpretProject(withContext, options.adapter, {
      experienceMetas,
      signal: options.signal,
      onLog: options.onLog,
    });
    currentProject = interpreted.project;
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
