'use strict';

const { handleAgentHostRoutes } = require('./http-routes');
const { loadLangChainRuntime } = require('./langchain/runtime');
const {
  DEFAULT_AGENT_CONFIG_ACTION,
  filterToolsByConfigAction,
  normalizeConfigAction,
} = require('./capabilities');
const { runAgentLlmTask, runAgentTask } = require('./llm-adapter');
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
    agent: {
      run: options => runAgentTask(project, options),
    },
    runtime: {
      langchain: () => loadLangChainRuntime(),
    },
    capabilities: {
      defaultAction: () => DEFAULT_AGENT_CONFIG_ACTION.slice(),
      normalize: options => normalizeConfigAction(options),
      filterTools: (tools, options) => filterToolsByConfigAction(tools, options),
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
  agent: {
    run: runAgentTask,
  },
  runtime: {
    langchain: loadLangChainRuntime,
  },
  capabilities: {
    DEFAULT_AGENT_CONFIG_ACTION,
    filterToolsByConfigAction,
    normalizeConfigAction,
  },
};
