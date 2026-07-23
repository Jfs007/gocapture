const path = require('path');
const {
  experienceRoot,
  safeRead,
} = require('./project-context');
const {
  componentExperienceCatalog,
  updateComponentExperience,
} = require('./component-experience');

function memorySnapshot(project) {
  if (!project?.path) throw new Error('No project selected.');
  return {
    project: {
      name: project.name,
      path: project.path,
    },
    projectDocument: safeRead(path.join(experienceRoot(project), 'Project.md')),
    experiences: componentExperienceCatalog(project),
  };
}

module.exports = {
  memorySnapshot,
  updateComponentExperience,
};
