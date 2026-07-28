'use strict';

const assert = require('assert');
const test = require('node:test');
const {
  DEEPSEEK_BASE_URL,
  normalizeRuntimeConfig,
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
