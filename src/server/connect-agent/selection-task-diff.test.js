'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  captureSelectionTaskSnapshot,
  finalizeSelectionTaskDiff,
  mapLocationThroughDiff,
} = require('./selection-task-diff');
const {
  loadProjectSelectionLocations,
  updateProjectSelectionLocations,
} = require('./selection-reference-store');
const { diffLines } = require('diff');

test('selection task diff refreshes source after an in-place Agent edit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-task-diff-'));
  const project = { path: root };
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/View.vue'), [
    '<template>',
    '  <button class="submit">登录</button>',
    '</template>',
    '<style>',
    '.submit { color: red; }',
    '</style>',
  ].join('\n'));
  updateProjectSelectionLocations(project, [{
    selectionId: 'selection_login',
    locations: [{
      file: 'src/View.vue',
      startLine: 5,
      endLine: 5,
      anchor: '.submit',
    }],
  }]);

  const snapshot = captureSelectionTaskSnapshot(project, ['selection_login']);
  fs.writeFileSync(path.join(root, 'src/View.vue'), [
    '<template>',
    '  <button class="submit">登录</button>',
    '</template>',
    '<style>',
    '.submit { color: blue; }',
    '</style>',
  ].join('\n'));

  const changes = finalizeSelectionTaskDiff(
    project,
    snapshot,
    ['src/View.vue'],
    'task_1',
  );
  const stored = loadProjectSelectionLocations(project)[0];

  assert.equal(changes.length, 1);
  assert.equal(changes[0].before.source, '.submit { color: red; }');
  assert.equal(changes[0].after.source, '.submit { color: blue; }');
  assert.equal(changes[0].additions, 1);
  assert.equal(changes[0].deletions, 1);
  assert.match(changes[0].patch, /-\.submit \{ color: red; \}/);
  assert.match(changes[0].patch, /\+\.submit \{ color: blue; \}/);
  assert.equal(stored.locations[0].source, '.submit { color: blue; }');
  assert.equal(stored.locations[0].anchor, '.submit { color: blue; }');
});

test('selection task diff maps a selection after lines are inserted before it', () => {
  const before = ['one', 'target', 'three'].join('\n');
  const after = ['zero', 'one', 'target', 'three'].join('\n');
  const mapped = mapLocationThroughDiff(
    { file: 'src/a.txt', startLine: 2, endLine: 2 },
    diffLines(before, after),
  );

  assert.deepEqual(mapped, {
    file: 'src/a.txt',
    startLine: 3,
    endLine: 3,
  });
});

test('selection task diff reviews edits elsewhere in the selected source file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-task-diff-'));
  const project = { path: root };
  fs.writeFileSync(path.join(root, 'View.vue'), [
    '<h1 class="title">欢迎登录</h1>',
    '<style>',
    '.title { color: red; }',
    '</style>',
  ].join('\n'));
  updateProjectSelectionLocations(project, [{
    selectionId: 'selection_title',
    locations: [{
      file: 'View.vue',
      startLine: 1,
      endLine: 1,
      anchor: '欢迎登录',
    }],
  }]);
  const snapshot = captureSelectionTaskSnapshot(project, ['selection_title']);
  fs.writeFileSync(path.join(root, 'View.vue'), [
    '<h1 class="title">欢迎登录</h1>',
    '<style>',
    '.title { color: blue; }',
    '</style>',
  ].join('\n'));

  const changes = finalizeSelectionTaskDiff(project, snapshot, ['View.vue']);

  assert.equal(changes.length, 1);
  assert.equal(changes[0].before.source, '<h1 class="title">欢迎登录</h1>');
  assert.equal(changes[0].after.source, '<h1 class="title">欢迎登录</h1>');
  assert.match(changes[0].patch, /-\.title \{ color: red; \}/);
  assert.match(changes[0].patch, /\+\.title \{ color: blue; \}/);
});

test('selection task diff ignores files outside the active selection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-task-diff-'));
  const project = { path: root };
  fs.writeFileSync(path.join(root, 'View.vue'), '<div>before</div>');
  updateProjectSelectionLocations(project, [{
    selectionId: 'selection_1',
    locations: [{
      file: 'View.vue',
      startLine: 1,
      endLine: 1,
      anchor: 'before',
    }],
  }]);
  const snapshot = captureSelectionTaskSnapshot(project, ['selection_1']);
  fs.writeFileSync(path.join(root, 'View.vue'), '<div>after</div>');

  const changes = finalizeSelectionTaskDiff(project, snapshot, ['Other.vue']);

  assert.deepEqual(changes, []);
  assert.equal(loadProjectSelectionLocations(project)[0].locations[0].source, '<div>before</div>');
});
