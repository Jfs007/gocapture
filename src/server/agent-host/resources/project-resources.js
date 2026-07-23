'use strict';

const path = require('path');
const { experienceRoot, safeRead } = require('../../experience/project-context');
const { createResourceProvider } = require('./provider');

const RESOURCE_DEFINITIONS = [
  {
    uri: 'magnus://project/context',
    name: 'Project.md',
    description: 'Interpreted project overview, technical stack, UI framework hints, and saved experiences.',
    mimeType: 'text/markdown',
    category: 'project',
    readable: true,
  },
  {
    uri: 'magnus://project/files',
    name: 'Project Files',
    description: 'Indexed source file inventory for the currently bound project.',
    mimeType: 'application/json',
    category: 'project',
    readable: true,
  },
];

function listProjectResources(project) {
  if (!project?.path) return RESOURCE_DEFINITIONS;
  return RESOURCE_DEFINITIONS.map(item => ({
    ...item,
    projectPath: project.path,
  }));
}

function readProjectResource(project, uri) {
  const value = String(uri || '');
  if (!project?.path) throw new Error('No project selected.');
  if (value === 'magnus://project/context') {
    return {
      uri: value,
      mimeType: 'text/markdown',
      content: safeRead(path.join(experienceRoot(project), 'Project.md')),
    };
  }
  if (value === 'magnus://project/files') {
    return {
      uri: value,
      mimeType: 'application/json',
      content: JSON.stringify((project.files || []).map(file => ({
        path: file.path,
        size: file.size || 0,
        mtimeMs: file.mtimeMs || 0,
      })), null, 2),
    };
  }
  return null;
}

const projectResourceProvider = createResourceProvider({
  id: 'builtin.project-resources',
  title: 'Project Resources',
  source: 'builtin',
  description: 'Default project context and source inventory resources.',
  listResources: listProjectResources,
  readResource: readProjectResource,
});

module.exports = {
  projectResourceProvider,
};
