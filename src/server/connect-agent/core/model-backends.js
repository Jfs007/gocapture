'use strict';

const MODEL_PROTOCOLS = Object.freeze({
  INHERIT: 'inherit',
  ANTHROPIC_MESSAGES: 'anthropic-messages',
  OPENAI_RESPONSES: 'openai-responses',
});

const ANTHROPIC_COMPATIBLE_BRANDS = Object.freeze([
  ['openai', 'OpenAI'],
  ['gemini', 'Gemini'],
  ['deepseek', 'DeepSeek'],
  ['qwen', '通义千问'],
  ['kimi', 'Kimi'],
  ['doubao', '豆包'],
  ['zhipu', '智谱 GLM'],
  ['mistral', 'Mistral'],
]);

const MODEL_PRESETS = Object.freeze({
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-5.2', 'gpt-5.1', 'gpt-5-mini'],
  gemini: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'],
  deepseek: ['deepseek-v4-pro[1m]', 'deepseek-v4-pro', 'deepseek-v4-flash'],
  qwen: ['qwen3.7-max', 'qwen3.5-plus', 'qwen3.5-flash'],
  kimi: ['kimi-k2.5', 'kimi-k2-thinking', 'kimi-k2-turbo-preview'],
  doubao: ['doubao-seed-2-0-pro', 'doubao-seed-2-0-lite-260215', 'ark-code-latest'],
  zhipu: ['glm-5.2', 'glm-5.1', 'glm-4.7-flash'],
  mistral: ['devstral-2', 'mistral-large-latest', 'mistral-small-latest'],
});

const ENDPOINT_PRESETS = Object.freeze({
  deepseek: [
    endpointPreset('DeepSeek 官方 Anthropic 兼容接口', 'https://api.deepseek.com/anthropic'),
  ],
  qwen: [
    endpointPreset('阿里云百炼按量付费', 'https://dashscope.aliyuncs.com/apps/anthropic'),
    endpointPreset('阿里云百炼 Coding Plan', 'https://coding.dashscope.aliyuncs.com/apps/anthropic'),
    endpointPreset('阿里云百炼 Token Plan', 'https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic'),
  ],
  doubao: [
    endpointPreset('火山方舟 Coding Plan', 'https://ark.cn-beijing.volces.com/api/coding'),
  ],
  zhipu: [
    endpointPreset('智谱 Anthropic 兼容接口', 'https://open.bigmodel.cn/api/anthropic'),
  ],
});

const compatibleBackends = Object.fromEntries(
  ANTHROPIC_COMPATIBLE_BRANDS.map(([id, name]) => [
    id,
    backend({
      id,
      name,
      brandId: id,
      selectionGroup: 'anthropic-compatible',
      protocol: MODEL_PROTOCOLS.ANTHROPIC_MESSAGES,
      requiresBaseUrl: true,
      requiresModel: true,
      modelPresets: MODEL_PRESETS[id] || [],
      endpointPresets: ENDPOINT_PRESETS[id] || [],
      ...((ENDPOINT_PRESETS[id] || []).length
        ? { defaultBaseUrl: ENDPOINT_PRESETS[id][0].value }
        : {}),
      ...(id === 'deepseek'
        ? {
            defaultModel: 'deepseek-v4-pro[1m]',
            defaultFastModel: 'deepseek-v4-flash',
            defaultEffort: 'max',
          }
        : {}),
    }),
  ]),
);

const BACKENDS = Object.freeze({
  inherit: backend({
    id: 'inherit',
    name: '沿用 Agent 配置',
    selectionGroup: 'system',
    protocol: MODEL_PROTOCOLS.INHERIT,
    configurable: false,
  }),
  anthropic: backend({
    id: 'anthropic',
    name: 'Anthropic',
    brandId: 'claude',
    selectionGroup: 'native',
    protocol: MODEL_PROTOCOLS.ANTHROPIC_MESSAGES,
    defaultBaseUrl: '',
    modelPresets: MODEL_PRESETS.anthropic,
  }),
  ...compatibleBackends,
  'custom-anthropic': backend({
    id: 'custom-anthropic',
    name: '自定义兼容服务',
    brandId: 'generic',
    selectionGroup: 'anthropic-compatible',
    protocol: MODEL_PROTOCOLS.ANTHROPIC_MESSAGES,
    requiresBaseUrl: true,
    requiresModel: true,
    modelPresets: [],
  }),
  'custom-responses': backend({
    id: 'custom-responses',
    name: '自定义 OpenAI Responses-compatible',
    brandId: 'generic',
    selectionGroup: 'responses-compatible',
    protocol: MODEL_PROTOCOLS.OPENAI_RESPONSES,
  }),
});

function backend(raw) {
  return Object.freeze({
    configurable: true,
    defaultBaseUrl: '',
    defaultModel: '',
    defaultFastModel: '',
    defaultEffort: '',
    brandId: '',
    selectionGroup: 'custom',
    requiresBaseUrl: false,
    requiresModel: false,
    modelPresets: [],
    endpointPresets: [],
    ...raw,
  });
}

function endpointPreset(label, value) {
  return Object.freeze({ label, value });
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
  ANTHROPIC_COMPATIBLE_BRANDS,
  BACKENDS,
  ENDPOINT_PRESETS,
  MODEL_PRESETS,
  MODEL_PROTOCOLS,
  assertModelBackendCompatible,
  getModelBackend,
  listModelBackends,
};
