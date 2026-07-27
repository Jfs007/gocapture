'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  appendProjectMessage,
  loadProjectMessages,
  messageFile,
} = require('./message-store');

test('project messages append to the provider JSONL timeline', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-message-store-'));
  const project = { path: root };

  const first = appendProjectMessage(project, 'codex', {
    taskId: 'task_1',
    role: 'user',
    kind: 'request',
    text: '修改标题',
  });
  const second = appendProjectMessage(project, 'codex', {
    taskId: 'task_1',
    threadId: 'thread_1',
    role: 'agent',
    kind: 'result',
    text: '已完成',
  });

  assert.match(messageFile(project, 'codex'), /\.gocapture\/message\/codex\.jsonl$/);
  assert.equal(loadProjectMessages(project, 'codex').length, 2);
  assert.equal(loadProjectMessages(project, 'codex')[0].id, first.id);
  assert.equal(loadProjectMessages(project, 'codex')[1].id, second.id);
});

test('project message loading keeps the latest requested records', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-message-limit-'));
  const project = { path: root };
  for (let index = 1; index <= 4; index += 1) {
    appendProjectMessage(project, 'codex', {
      taskId: `task_${index}`,
      role: 'system',
      text: `event ${index}`,
    });
  }

  assert.deepEqual(
    loadProjectMessages(project, 'codex', { limit: 2 }).map(item => item.text),
    ['event 3', 'event 4'],
  );
});
