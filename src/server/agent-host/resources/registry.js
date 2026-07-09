'use strict';

const { projectResourceProvider } = require('./project-resources');

const resourceProviders = [
  projectResourceProvider,
];

function assertResourceProvider(provider) {
  if (!provider || typeof provider !== 'object') throw new Error('Resource provider must be an object.');
  if (!provider.id) throw new Error('Resource provider requires id.');
  if (typeof provider.listResources !== 'function') throw new Error(`Resource provider ${provider.id} requires listResources().`);
  if (typeof provider.readResource !== 'function') throw new Error(`Resource provider ${provider.id} requires readResource().`);
}

function registerAgentResourceProvider(provider) {
  assertResourceProvider(provider);
  const index = resourceProviders.findIndex(item => item.id === provider.id);
  if (index >= 0) {
    resourceProviders[index] = provider;
  } else {
    resourceProviders.push(provider);
  }
  return provider;
}

function listAgentResourceProviders() {
  return resourceProviders.map(provider => ({
    id: provider.id,
    title: provider.title || provider.id,
    source: provider.source || 'unknown',
    kind: provider.kind || 'resource-provider',
    description: provider.description || '',
    resourceCount: provider.listResources({}).length,
  }));
}

function listAgentResources(project) {
  return resourceProviders.flatMap(provider => provider.listResources(project).map(resource => ({
    ...resource,
    providerId: provider.id,
    source: provider.source || 'unknown',
  })));
}

function readAgentResource(project, uri) {
  const value = String(uri || '');
  for (const provider of resourceProviders) {
    const resource = provider.readResource(project, value);
    if (resource) {
      return {
        ...resource,
        providerId: provider.id,
      };
    }
  }
  throw new Error(`Unknown agent resource: ${value || '-'}`);
}

module.exports = {
  listAgentResourceProviders,
  listAgentResources,
  readAgentResource,
  registerAgentResourceProvider,
};
