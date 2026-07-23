'use strict';

const { ProxyAgent } = require('undici');

const DEFAULT_TIMEOUT_MS = 120000;
const proxyDispatchers = new Map();

function proxyFetch(proxyUrl) {
  const url = String(proxyUrl || '').trim();
  if (!url) return undefined;
  if (!proxyDispatchers.has(url)) proxyDispatchers.set(url, new ProxyAgent(url));
  const dispatcher = proxyDispatchers.get(url);
  return (input, init = {}) => fetch(input, { ...init, dispatcher });
}

class LangChainModelAdapter {
  constructor(id) {
    if (!id) throw new Error('LangChain model adapter requires an id.');
    this.id = id;
  }

  normalizeConfig(raw = {}) {
    if (raw.type && raw.type !== 'api') {
      throw new Error('非 API 模型已下线，请配置 API 模型。');
    }
    return {
      id: String(raw.id || ''),
      name: String(raw.name || this.id),
      provider: this.id,
      type: 'api',
      endpoint: String(raw.endpoint || ''),
      apiKey: String(raw.apiKey || ''),
      model: String(raw.model || ''),
      proxyUrl: String(raw.proxyUrl || ''),
      timeoutMs: Math.max(5000, Math.min(Number(raw.timeoutMs || DEFAULT_TIMEOUT_MS), 300000)),
      maxRetries: Math.max(0, Math.min(Number(raw.maxRetries ?? 2), 10)),
    };
  }

  clientConfiguration(config) {
    const customFetch = proxyFetch(config.proxyUrl);
    return customFetch ? { fetch: customFetch } : {};
  }

  createModel() {
    throw new Error(`${this.id} does not implement createModel().`);
  }

  prepareResponseFormat(schema) {
    return schema;
  }
}

module.exports = {
  LangChainModelAdapter,
  proxyFetch,
};
