'use strict';

const { handleAgentHostRoutes } = require('./http-routes');
const { runAgentLoop } = require('./loop/runner');
const { runAgentLlmTask } = require('./llm-adapter');
const {
  executeAgentTool,
  listAgentToolProviders,
  listAgentTools,
  registerAgentToolProvider,
} = require('./tools/registry');
const {
  listAgentResourceProviders,
  listAgentResources,
  readAgentResource,
  registerAgentResourceProvider,
} = require('./resources/registry');
const {
  listExperiences,
  readExperiences,
  saveGeneratedExperience,
  updateProjectExperience,
  verifyExperiences,
} = require('./experiences/registry');

function createAgentHost(project) {
  return {
    project,
    tools: {
      providers: () => listAgentToolProviders(),
      list: () => listAgentTools(),
      execute: (toolCall, textCache) => executeAgentTool(project, toolCall, textCache),
    },
    resources: {
      providers: () => listAgentResourceProviders(),
      list: () => listAgentResources(project),
      read: uri => readAgentResource(project, uri),
    },
    experiences: {
      list: () => listExperiences(project),
      read: ids => readExperiences(project, ids),
      verify: ids => verifyExperiences(project, ids),
      saveGenerated: candidate => saveGeneratedExperience(project, candidate),
      update: input => updateProjectExperience(project, input),
    },
    llm: {
      run: (adapter, prompt, options) => runAgentLlmTask(adapter, prompt, project, options),
    },
    loop: {
      run: options => runAgentLoop(project, options),
    },
  };
}

module.exports = {
  createAgentHost,
  handleAgentHostRoutes,
  tools: {
    providers: listAgentToolProviders,
    list: listAgentTools,
    execute: executeAgentTool,
    registerProvider: registerAgentToolProvider,
  },
  resources: {
    providers: listAgentResourceProviders,
    list: listAgentResources,
    read: readAgentResource,
    registerProvider: registerAgentResourceProvider,
  },
  experiences: {
    list: listExperiences,
    read: readExperiences,
    verify: verifyExperiences,
    saveGenerated: saveGeneratedExperience,
    update: updateProjectExperience,
  },
  llm: {
    run: runAgentLlmTask,
  },
  loop: {
    run: runAgentLoop,
  },
};
