'use strict';

const assert = require('assert');
const test = require('node:test');
const { normalizeAuthState } = require('./auth-store');

test('auth state migrates legacy credentials without exposing brands to each other', () => {
  const migrated = normalizeAuthState({
    mode: 'apikey',
    backendId: 'deepseek',
    apiKey: 'sk-deepseek',
  });
  assert.strictEqual(migrated.activeBackendId, 'deepseek');
  assert.strictEqual(migrated.profiles.deepseek.apiKey, 'sk-deepseek');

  const state = normalizeAuthState({
    version: 2,
    activeBackendId: 'qwen',
    profiles: {
      deepseek: { mode: 'apikey', apiKey: 'sk-deepseek' },
      qwen: { mode: 'apikey', apiKey: 'sk-qwen' },
    },
  });
  assert.strictEqual(state.profiles.deepseek.backendId, 'deepseek');
  assert.strictEqual(state.profiles.qwen.backendId, 'qwen');
  assert.strictEqual(state.profiles.deepseek.apiKey, 'sk-deepseek');
  assert.strictEqual(state.profiles.qwen.apiKey, 'sk-qwen');
});
