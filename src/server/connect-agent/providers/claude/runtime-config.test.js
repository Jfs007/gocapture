'use strict';

const assert = require('assert');
const test = require('node:test');
const {
  DEEPSEEK_BASE_URL,
  normalizeRuntimeConfig,
  normalizeRuntimeState,
  runtimeConfigToEnv,
  validateRuntimeConfig,
} = require('./runtime-config');

test('normalizeRuntimeConfig supplies DeepSeek Claude Code defaults', () => {
  assert.deepStrictEqual(normalizeRuntimeConfig({ backendId: 'deepseek' }), {
    backendId: 'deepseek',
    protocol: 'anthropic-messages',
    baseUrl: DEEPSEEK_BASE_URL,
    model: 'deepseek-v4-pro[1m]',
    fastModel: 'deepseek-v4-flash',
    effort: 'max',
  });
});

test('runtimeConfigToEnv maps DeepSeek config into the Claude child process only', () => {
  const env = runtimeConfigToEnv(
    {
      backendId: 'deepseek',
      model: 'deepseek-v4-pro[1m]',
      fastModel: 'deepseek-v4-flash',
      effort: 'max',
    },
    { mode: 'apikey', backendId: 'deepseek', apiKey: 'sk-ds' },
    { PATH: '/bin', ANTHROPIC_API_KEY: 'stale' },
  );

  assert.strictEqual(env.PATH, '/bin');
  assert.strictEqual(env.ANTHROPIC_BASE_URL, DEEPSEEK_BASE_URL);
  assert.strictEqual(env.ANTHROPIC_AUTH_TOKEN, 'sk-ds');
  assert.strictEqual(env.ANTHROPIC_API_KEY, undefined);
  assert.strictEqual(env.ANTHROPIC_MODEL, 'deepseek-v4-pro[1m]');
  assert.strictEqual(env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'deepseek-v4-flash');
  assert.strictEqual(env.CLAUDE_CODE_SUBAGENT_MODEL, 'deepseek-v4-flash');
  assert.strictEqual(env.CLAUDE_CODE_EFFORT_LEVEL, 'max');
});

test('runtimeConfigToEnv does not leak a DeepSeek key into inherited or Anthropic mode', () => {
  const auth = { mode: 'apikey', backendId: 'deepseek', apiKey: 'sk-ds' };
  const base = { ANTHROPIC_API_KEY: 'sk-ds', ANTHROPIC_AUTH_TOKEN: 'sk-ds' };

  const inherited = runtimeConfigToEnv({ backendId: 'inherit' }, auth, base);
  assert.strictEqual(inherited.ANTHROPIC_API_KEY, undefined);
  assert.strictEqual(inherited.ANTHROPIC_AUTH_TOKEN, undefined);

  const anthropic = runtimeConfigToEnv({ backendId: 'anthropic' }, auth, base);
  assert.strictEqual(anthropic.ANTHROPIC_API_KEY, undefined);
  assert.strictEqual(anthropic.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.strictEqual(anthropic.ANTHROPIC_BASE_URL, undefined);
});

test('validateRuntimeConfig rejects the OpenAI endpoint for Claude Code', () => {
  assert.match(
    validateRuntimeConfig({
      backendId: 'deepseek',
      baseUrl: 'https://api.deepseek.com/chat/completions',
    }),
    /Anthropic Endpoint/,
  );
  assert.strictEqual(validateRuntimeConfig({
    backendId: 'deepseek',
    baseUrl: 'https://api.deepseek.com/anthropic',
  }), '');
});

test('Anthropic-compatible brands use the same runtime contract', () => {
  assert.deepStrictEqual(normalizeRuntimeConfig({
    backendId: 'gemini',
    baseUrl: 'https://llm-gateway.example.com/anthropic',
    model: 'gemini-model',
  }), {
    backendId: 'gemini',
    protocol: 'anthropic-messages',
    baseUrl: 'https://llm-gateway.example.com/anthropic',
    model: 'gemini-model',
    fastModel: '',
    effort: '',
  });
  assert.equal(
    normalizeRuntimeConfig({ backendId: 'qwen', model: 'qwen-model' }).baseUrl,
    'https://dashscope.aliyuncs.com/apps/anthropic',
  );
  assert.match(
    validateRuntimeConfig({ backendId: 'gemini', model: 'gemini-model' }),
    /兼容 Endpoint/,
  );
  assert.match(
    validateRuntimeConfig({
      backendId: 'qwen',
      baseUrl: 'https://llm-gateway.example.com/anthropic',
    }),
    /模型名称/,
  );
  assert.strictEqual(validateRuntimeConfig({
    backendId: 'qwen',
    baseUrl: 'https://llm-gateway.example.com/anthropic',
    model: 'qwen-model',
  }), '');
});

test('runtimeConfigToEnv maps any Anthropic-compatible brand without provider branches', () => {
  const env = runtimeConfigToEnv(
    {
      backendId: 'mistral',
      baseUrl: 'https://llm-gateway.example.com/anthropic',
      model: 'mistral-model',
    },
    { mode: 'apikey', backendId: 'mistral', apiKey: 'sk-gateway' },
    { PATH: '/bin' },
  );

  assert.strictEqual(env.ANTHROPIC_BASE_URL, 'https://llm-gateway.example.com/anthropic');
  assert.strictEqual(env.ANTHROPIC_AUTH_TOKEN, 'sk-gateway');
  assert.strictEqual(env.ANTHROPIC_MODEL, 'mistral-model');
});

test('runtime state migrates a legacy config and retains one profile per brand', () => {
  const migrated = normalizeRuntimeState({
    backendId: 'deepseek',
    model: 'deepseek-v4-flash',
  });
  assert.strictEqual(migrated.version, 2);
  assert.strictEqual(migrated.activeBackendId, 'deepseek');
  assert.strictEqual(migrated.profiles.deepseek.model, 'deepseek-v4-flash');

  const state = normalizeRuntimeState({
    version: 2,
    activeBackendId: 'qwen',
    profiles: {
      deepseek: {
        backendId: 'deepseek',
        model: 'deepseek-v4-pro',
      },
      qwen: {
        backendId: 'qwen',
        baseUrl: 'https://gateway.example.com/anthropic',
        model: 'qwen3.7-max',
      },
    },
  });
  assert.strictEqual(state.profiles.deepseek.model, 'deepseek-v4-pro');
  assert.strictEqual(state.profiles.qwen.model, 'qwen3.7-max');
});
