'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  assertModelBackendCompatible,
  getModelBackend,
} = require('../../core/model-backends');

const CONFIG_PATH = path.join(os.homedir(), '.gocapture', 'connect-agent', 'claude-runtime.json');
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/anthropic';
const CLAUDE_MODEL_BACKENDS = Object.freeze([
  'inherit',
  'anthropic',
  'deepseek',
  'custom-anthropic',
]);

function normalizeRuntimeConfig(raw) {
  const requestedBackend = String(raw?.backendId || raw?.provider || 'inherit').trim();
  const backendId = CLAUDE_MODEL_BACKENDS.includes(requestedBackend)
    ? requestedBackend
    : 'inherit';
  const backend = getModelBackend(backendId);
  return {
    backendId,
    protocol: backend?.protocol || 'inherit',
    baseUrl: String(raw?.baseUrl || backend?.defaultBaseUrl || '').trim(),
    model: String(raw?.model || backend?.defaultModel || '').trim(),
    fastModel: String(raw?.fastModel || backend?.defaultFastModel || '').trim(),
    effort: ['high', 'max'].includes(raw?.effort)
      ? raw.effort
      : (backendId === 'deepseek' ? 'max' : ''),
  };
}

function validateRuntimeConfig(config, manifest = null) {
  const normalized = normalizeRuntimeConfig(config);
  if (manifest) {
    try {
      assertModelBackendCompatible(manifest, normalized.backendId);
    } catch (error) {
      return error.message;
    }
  }
  if (normalized.backendId === 'inherit' || normalized.backendId === 'anthropic') return '';
  let endpoint;
  try {
    endpoint = new URL(normalized.baseUrl);
  } catch (error) {
    return '模型 Endpoint 不是有效 URL';
  }
  if (normalized.backendId === 'deepseek'
    && endpoint.hostname === 'api.deepseek.com'
    && endpoint.pathname.replace(/\/+$/, '') !== '/anthropic') {
    return 'Claude Code 需要 DeepSeek Anthropic Endpoint：https://api.deepseek.com/anthropic';
  }
  return '';
}

function loadRuntimeConfig() {
  try {
    return normalizeRuntimeConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
  } catch (error) {
    return normalizeRuntimeConfig({});
  }
}

function saveRuntimeConfig(config) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(normalizeRuntimeConfig(config), null, 2), {
      mode: 0o600,
    });
    return true;
  } catch (error) {
    return false;
  }
}

function runtimeConfigToEnv(config, auth, baseEnv = process.env) {
  const normalized = normalizeRuntimeConfig(config);
  const env = { ...baseEnv };
  const authBackendId = String(auth?.backendId || auth?.provider || '').trim();
  if (normalized.backendId === 'inherit') {
    if (authBackendId && authBackendId !== 'inherit') {
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;
    }
    return env;
  }

  const modelKeys = [
    'ANTHROPIC_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'CLAUDE_CODE_SUBAGENT_MODEL',
    'CLAUDE_CODE_EFFORT_LEVEL',
  ];
  delete env.ANTHROPIC_BASE_URL;
  if (authBackendId && authBackendId !== normalized.backendId) {
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
  }
  for (const key of modelKeys) delete env[key];

  if (normalized.backendId !== 'anthropic' && normalized.baseUrl) {
    env.ANTHROPIC_BASE_URL = normalized.baseUrl;
  }
  if (normalized.backendId !== 'inherit') {
    if (auth?.mode === 'apikey' && auth.apiKey
      && (!authBackendId || authBackendId === normalized.backendId)) {
      env.ANTHROPIC_AUTH_TOKEN = auth.apiKey;
      delete env.ANTHROPIC_API_KEY;
    }
  }
  if (normalized.model) {
    env.ANTHROPIC_MODEL = normalized.model;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = normalized.model;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = normalized.model;
  }
  if (normalized.fastModel) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = normalized.fastModel;
    env.CLAUDE_CODE_SUBAGENT_MODEL = normalized.fastModel;
  }
  if (normalized.effort) env.CLAUDE_CODE_EFFORT_LEVEL = normalized.effort;
  return env;
}

module.exports = {
  CLAUDE_MODEL_BACKENDS,
  CONFIG_PATH,
  DEEPSEEK_BASE_URL,
  loadRuntimeConfig,
  normalizeRuntimeConfig,
  runtimeConfigToEnv,
  saveRuntimeConfig,
  validateRuntimeConfig,
};
