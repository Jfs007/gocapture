'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  createProjectExtensionSession,
  safeToolPart,
} = require('./project-extension-session');

test('project extension session exposes project Skills as executable Agent tools', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-extension-session-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, '.gocapture', 'skills', 'source-review');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), [
    '---',
    'name: source-review',
    'description: Review selected source',
    'allowed-tools: [Read, Grep]',
    '---',
    'Inspect evidence before editing.',
  ].join('\n'));

  const session = await createProjectExtensionSession({ path: root });
  t.after(() => session.close());
  assert.ok(session.definitions.some(tool => tool.name === 'skill__source-review'));
  const result = await session.invoke('skill__source-review', {});
  assert.equal(result.instructions, 'Inspect evidence before editing.');
  assert.deepEqual(result.allowedTools, ['Read', 'Grep']);
});

test('safeToolPart keeps provider-neutral dynamic tool names', () => {
  assert.equal(safeToolPart('review/source v2'), 'review_source_v2');
});
