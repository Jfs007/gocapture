'use strict';

const assert = require('assert');
const test = require('node:test');
const { normalizeAuthState } = require('./auth-store');

test('auth state accepts only the current profile format', () => {
  const obsolete = normalizeAuthState({
    mode: 'apikey',
    backendId: 'deepseek',
    apiKey: 'sk-deepseek',
  });
  assert.strictEqual(obsolete.activeBackendId, '');
  assert.deepStrictEqual(obsolete.profiles, {});

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
