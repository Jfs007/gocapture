'use strict';

const { ChatDeepSeek } = require('@langchain/deepseek');
const { LangChainModelAdapter } = require('./model-adapter');

const DEFAULT_BASE_URL = 'https://api.deepseek.com';

function endpointToBaseUrl(endpoint) {
  const value = String(endpoint || '').trim();
  if (!value) return DEFAULT_BASE_URL;
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/chat\/completions\/?$/, '') || '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    throw new Error(`DeepSeek endpoint 无效：${value}`);
  }
}

class DeepSeekLangChainAdapter extends LangChainModelAdapter {
  constructor() {
    super('deepseek');
  }

  normalizeConfig(raw = {}) {
    return {
      ...super.normalizeConfig(raw),
      name: String(raw.name || 'DeepSeek'),
      endpoint: String(raw.endpoint || `${DEFAULT_BASE_URL}/chat/completions`),
    };
  }

  createModel(raw = {}, options = {}) {
    const config = this.normalizeConfig(raw);
    if (!config.apiKey) throw new Error('DeepSeek API 模型缺少 apiKey。');
    if (!config.model) throw new Error('DeepSeek API 模型缺少 model。');
    const modelKwargs = options.structuredOutput
      ? { thinking: { type: 'disabled' } }
      : undefined;
    return new ChatDeepSeek({
      apiKey: config.apiKey,
      model: config.model,
      temperature: Number.isFinite(options.temperature) ? options.temperature : 0,
      timeout: config.timeoutMs,
      maxRetries: config.maxRetries,
      ...(modelKwargs ? { modelKwargs } : {}),
      configuration: {
        baseURL: endpointToBaseUrl(config.endpoint),
        ...this.clientConfiguration(config),
      },
    });
  }

  prepareResponseFormat(schema, runtime = {}) {
    if (!schema) return undefined;
    if (typeof runtime.toolStrategy !== 'function') {
      throw new Error('LangChain runtime 缺少 toolStrategy，无法配置 DeepSeek 结构化输出。');
    }
    return runtime.toolStrategy(schema);
  }
}

module.exports = {
  DeepSeekLangChainAdapter,
  endpointToBaseUrl,
};
