'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  loadProjectAgentSettings,
  saveProjectAgentSettings,
  settingsPath,
} = require('./project-settings');

test('project Agent settings persist a shared proxy inside .gocapture', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-agent-settings-'));
  const project = { path: root };

  assert.deepEqual(loadProjectAgentSettings(project), { proxy: '', activeProviderId: '' });
  assert.deepEqual(
    saveProjectAgentSettings(project, {
      proxy: 'http://127.0.0.1:7890/',
      activeProviderId: 'claude',
    }),
    { proxy: 'http://127.0.0.1:7890/', activeProviderId: 'claude' },
  );
  assert.equal(
    JSON.parse(fs.readFileSync(settingsPath(project), 'utf8')).proxy,
    'http://127.0.0.1:7890/',
  );
});

test('project Agent settings preserve the selected provider on partial updates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-agent-settings-'));
  const project = { path: root };
  saveProjectAgentSettings(project, { activeProviderId: 'claude' });

  assert.deepEqual(
    saveProjectAgentSettings(project, { proxy: 'http://127.0.0.1:7890' }),
    { proxy: 'http://127.0.0.1:7890', activeProviderId: 'claude' },
  );
});

test('project Agent settings reject unsupported proxy protocols', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-agent-settings-'));
  assert.throws(
    () => saveProjectAgentSettings({ path: root }, { proxy: 'file:///tmp/proxy' }),
    /HTTP 或 HTTPS/,
  );
});
