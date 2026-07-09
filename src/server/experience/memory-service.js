const path = require('path');
const {
  experienceRoot,
  safeRead,
} = require('./project-context');
const {
  loadExperienceContexts,
  loadExperienceMetas,
  updateStoredExperience,
} = require('./experience-store');
const {
  projectTaskSessions,
  removeTaskSessionMemory,
  updateTaskSessionMemory,
} = require('./task-session');

function memorySnapshot(project) {
  if (!project?.path) throw new Error('No project selected.');
  const experienceMetas = loadExperienceMetas(project);
  return {
    project: {
      name: project.name,
      path: project.path,
    },
    projectDocument: safeRead(path.join(experienceRoot(project), 'Project.md')),
    experiences: loadExperienceContexts(project, experienceMetas.map(meta => meta.id)),
    taskSessions: projectTaskSessions(project),
  };
}

module.exports = {
  memorySnapshot,
  removeTaskSessionMemory,
  updateStoredExperience,
  updateTaskSessionMemory,
};
