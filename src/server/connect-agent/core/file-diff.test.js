'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  captureProposedFileEdit,
  finalizeTaskFileDiffs,
  publicFileDiffs,
} = require('./file-diff');

test('Claude-style Edit produces a proposed diff and an applied diff', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-provider-diff-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  const file = path.join(root, 'src/example.js');
  fs.writeFileSync(file, 'const color = "red";\n');
  const task = {
    cwd: root,
    changedFiles: new Set(),
    fileBaselines: new Map(),
    fileDiffs: new Map(),
  };

  captureProposedFileEdit(task, 'Edit', {
    file_path: file,
    old_string: '"red"',
    new_string: '"blue"',
  });
  assert.equal(publicFileDiffs(task)[0].phase, 'proposed');
  assert.match(publicFileDiffs(task)[0].patch, /"blue"/);

  fs.writeFileSync(file, 'const color = "blue";\n');
  finalizeTaskFileDiffs(task, 'claude-code');
  assert.equal(publicFileDiffs(task)[0].phase, 'applied');
  assert.equal(publicFileDiffs(task)[0].additions, 1);
  assert.equal(publicFileDiffs(task)[0].deletions, 1);
});
