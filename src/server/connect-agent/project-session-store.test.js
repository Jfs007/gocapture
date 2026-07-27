'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  clearProjectAgentSession,
  loadProjectAgentSession,
  saveProjectAgentSession,
  sessionFile,
} = require('./project-session-store');

test('connect agent thread is persisted per project and provider', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-agent-session-'));
  const project = { path: root };

  assert.equal(loadProjectAgentSession(project, 'codex'), null);
  saveProjectAgentSession(project, 'codex', { threadId: 'thread_codex' });
  saveProjectAgentSession(project, 'claude', { threadId: 'thread_claude' });

  assert.equal(loadProjectAgentSession(project, 'codex').threadId, 'thread_codex');
  assert.equal(loadProjectAgentSession(project, 'claude').threadId, 'thread_claude');
  assert.equal(path.basename(sessionFile(project)), 'connect-agent-sessions.json');

  clearProjectAgentSession(project, 'codex');
  assert.equal(loadProjectAgentSession(project, 'codex'), null);
  assert.equal(loadProjectAgentSession(project, 'claude').threadId, 'thread_claude');
});

test('project agent session persists the selected thread identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-agent-thread-only-'));
  const project = { path: root };

  saveProjectAgentSession(project, 'codex', { threadId: 'thread_codex' });
  const session = loadProjectAgentSession(project, 'codex');
  assert.deepEqual(Object.keys(session).sort(), ['source', 'threadId', 'threadName', 'updatedAt']);

  const raw = JSON.parse(fs.readFileSync(sessionFile(project), 'utf8'));
  assert.deepEqual(
    Object.keys(raw.sessions.codex).sort(),
    ['source', 'threadId', 'threadName', 'updatedAt'],
  );
});
