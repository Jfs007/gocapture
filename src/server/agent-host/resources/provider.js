'use strict';

function createResourceProvider(definition) {
  if (!definition || typeof definition !== 'object') throw new Error('Resource provider definition must be an object.');
  if (!definition.id) throw new Error('Resource provider requires id.');
  if (typeof definition.listResources !== 'function') throw new Error(`Resource provider ${definition.id} requires listResources().`);
  if (typeof definition.readResource !== 'function') throw new Error(`Resource provider ${definition.id} requires readResource().`);
  return Object.freeze({
    id: definition.id,
    title: definition.title || definition.id,
    source: definition.source || 'builtin',
    kind: definition.kind || 'resource-provider',
    description: definition.description || '',
    listResources: definition.listResources,
    readResource: definition.readResource,
  });
}

module.exports = {
  createResourceProvider,
};
