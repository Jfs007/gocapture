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
  componentExperienceCatalog,
  loadComponentExperiences,
  saveComponentExperiences,
  updateComponentExperience,
} = require('../experience/component-experience');

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
      list: () => componentExperienceCatalog(project),
      read: paths => loadComponentExperiences(project)
        .filter(record => new Set(paths || []).has(record.componentPath)),
      save: records => saveComponentExperiences(project, records),
      update: input => updateComponentExperience(project, input),
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
    list: componentExperienceCatalog,
    read: loadComponentExperiences,
    save: saveComponentExperiences,
    update: updateComponentExperience,
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
