'use strict';

const { DeepSeekLangChainAdapter } = require('./deepseek-adapter');

const adapters = new Map();

function registerModelAdapter(adapter) {
  if (!adapter?.id || typeof adapter.createModel !== 'function') {
    throw new Error('Invalid LangChain model adapter.');
  }
  adapters.set(adapter.id, adapter);
  return adapter;
}

function resolveModelAdapter(config = {}) {
  const id = String(config.provider || '').trim();
  const adapter = adapters.get(id);
  if (!adapter) {
    throw new Error(`不支持的模型供应商：${id || '未指定'}。请注册对应 LangChain ModelAdapter。`);
  }
  return adapter;
}

function normalizeModelConfig(config = {}) {
  return resolveModelAdapter(config).normalizeConfig(config);
}

function createLangChainModel(config = {}, options = {}) {
  return resolveModelAdapter(config).createModel(config, options);
}

function prepareModelResponseFormat(config = {}, schema, runtime = {}) {
  return resolveModelAdapter(config).prepareResponseFormat(schema, runtime);
}

function listModelAdapters() {
  return Array.from(adapters.keys());
}

registerModelAdapter(new DeepSeekLangChainAdapter());

module.exports = {
  createLangChainModel,
  listModelAdapters,
  normalizeModelConfig,
  prepareModelResponseFormat,
  registerModelAdapter,
  resolveModelAdapter,
};
