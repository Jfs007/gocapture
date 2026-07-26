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
  saveProjectSelectionContexts,
  sessionFile,
} = require('./project-session-store');

test('connect agent thread is persisted per project and provider', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-agent-session-'));
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

test('selection meanings and source evidence are persisted with the project agent session', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-agent-selection-'));
  const project = { path: root };

  saveProjectAgentSession(project, 'codex', { threadId: 'thread_codex' });
  saveProjectSelectionContexts(project, 'codex', {
    threadId: 'thread_codex',
    meanings: [{
      selectionId: 'selection_1',
      meaning: '经营数据页面的店铺统计表格',
    }],
    selectionBindings: [{
      uid: 'selection_1',
      binding: {
        targets: [{
          file: 'src/StoreTable.vue',
          role: 'render',
          targetSnippet: '<md-table />',
          codeSnippet: '<md-table />',
        }],
      },
    }],
  });

  const session = loadProjectAgentSession(project, 'codex');
  assert.equal(
    session.selections.selection_1.meaning,
    '经营数据页面的店铺统计表格',
  );
  assert.equal(
    session.selections.selection_1.source.targets[0].file,
    'src/StoreTable.vue',
  );
  assert.equal(
    session.selections.selection_1.source.targets[0].targetSnippet,
    '<md-table />',
  );

  saveProjectAgentSession(project, 'codex', { threadId: 'thread_codex' });
  assert.equal(
    loadProjectAgentSession(project, 'codex').selections.selection_1.meaning,
    '经营数据页面的店铺统计表格',
  );
});
