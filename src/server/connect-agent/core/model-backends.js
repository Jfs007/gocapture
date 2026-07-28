'use strict';

const MODEL_PROTOCOLS = Object.freeze({
  INHERIT: 'inherit',
  ANTHROPIC_MESSAGES: 'anthropic-messages',
  OPENAI_RESPONSES: 'openai-responses',
});

const BACKENDS = Object.freeze({
  inherit: backend({
    id: 'inherit',
    name: '沿用 Agent 配置',
    protocol: MODEL_PROTOCOLS.INHERIT,
    configurable: false,
  }),
  anthropic: backend({
    id: 'anthropic',
    name: 'Anthropic',
    protocol: MODEL_PROTOCOLS.ANTHROPIC_MESSAGES,
    defaultBaseUrl: '',
  }),
  deepseek: backend({
    id: 'deepseek',
    name: 'DeepSeek',
    protocol: MODEL_PROTOCOLS.ANTHROPIC_MESSAGES,
    defaultBaseUrl: 'https://api.deepseek.com/anthropic',
    defaultModel: 'deepseek-v4-pro[1m]',
    defaultFastModel: 'deepseek-v4-flash',
  }),
  'custom-anthropic': backend({
    id: 'custom-anthropic',
    name: '自定义 Anthropic-compatible',
    protocol: MODEL_PROTOCOLS.ANTHROPIC_MESSAGES,
  }),
  'custom-responses': backend({
    id: 'custom-responses',
    name: '自定义 OpenAI Responses-compatible',
    protocol: MODEL_PROTOCOLS.OPENAI_RESPONSES,
  }),
});

function backend(raw) {
  return Object.freeze({
    configurable: true,
    defaultBaseUrl: '',
    defaultModel: '',
    defaultFastModel: '',
    ...raw,
  });
}

function getModelBackend(id) {
  return BACKENDS[String(id || '').trim()] || null;
}

function listModelBackends(ids = Object.keys(BACKENDS)) {
  return (Array.isArray(ids) ? ids : [])
    .map(getModelBackend)
    .filter(Boolean)
    .map(item => ({ ...item }));
}

function assertModelBackendCompatible(manifest, backendId) {
  const selected = getModelBackend(backendId);
  if (!selected) throw new Error(`未知模型后端：${backendId || '-'}`);
  const allowedBackends = new Set(manifest?.modelBackends || []);
  if (allowedBackends.size && !allowedBackends.has(selected.id)) {
    throw new Error(`${manifest.name} 不支持模型后端 ${selected.name}`);
  }
  if (selected.protocol === MODEL_PROTOCOLS.INHERIT) return selected;
  const protocols = new Set(manifest?.modelProtocols || []);
  if (!protocols.has(selected.protocol)) {
    throw new Error(
      `${manifest.name} 需要 ${[...protocols].join(' / ') || '自身配置'} 协议，`
      + `${selected.name} 提供 ${selected.protocol}，两者不兼容`,
    );
  }
  return selected;
}

module.exports = {
  BACKENDS,
  MODEL_PROTOCOLS,
  assertModelBackendCompatible,
  getModelBackend,
  listModelBackends,
};
