const path = require('path');
const {
  experienceRoot,
  safeRead,
} = require('./project-context');
const {
  loadSkillContexts,
  loadSkillMetas,
  updateStoredSkill,
} = require('./skill-store');
const {
  projectTaskSessions,
  removeTaskSessionMemory,
  updateTaskSessionMemory,
} = require('./task-session');

function memorySnapshot(project) {
  if (!project?.path) throw new Error('No project selected.');
  const metas = loadSkillMetas(project);
  return {
    project: {
      name: project.name,
      path: project.path,
    },
    projectDocument: safeRead(path.join(experienceRoot(project), 'Project.md')),
    skills: loadSkillContexts(project, metas.map(meta => meta.id)),
    taskSessions: projectTaskSessions(project),
  };
}

module.exports = {
  memorySnapshot,
  removeTaskSessionMemory,
  updateStoredSkill,
  updateTaskSessionMemory,
};
