'use strict';

const adapters = [];

function registerRelationAdapter(adapter) {
  if (!adapter?.id || typeof adapter.extract !== 'function') {
    throw new Error('Relation adapter requires id and extract().');
  }
  const index = adapters.findIndex(item => item.id === adapter.id);
  if (index >= 0) adapters.splice(index, 1, adapter);
  else adapters.push(adapter);
}

function extractSourceRelations(context) {
  return adapters.flatMap(adapter => {
    if (typeof adapter.supports === 'function' && !adapter.supports(context)) return [];
    return adapter.extract(context) || [];
  });
}

function listRelationAdapters() {
  return adapters.slice();
}

module.exports = {
  extractSourceRelations,
  listRelationAdapters,
  registerRelationAdapter,
};
