'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  buildProjectKnowledge,
  writeProjectKnowledge,
  readProjectKnowledge,
} = require('./project-knowledge');

function fixtureProject(files, stack = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-project-knowledge-'));
  const projectFiles = [];
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    projectFiles.push({ path: file, size: Buffer.byteLength(content), mtimeMs: Date.now() });
  }
  return { name: 'fixture', path: root, kind: 'unknown', stack, files: projectFiles };
}

const IVIEW_PROFILE = { name: 'iView', classPrefixes: [{ prefix: 'ivu-', action: 'skip' }], signatureHints: [] };

test('measures custom prefixes, excludes baked framework prefixes and generic', () => {
  const vue = Array.from({ length: 10 }, (_, i) => `<div class="dc-box ivu-input text-right foo${i}"></div>`).join('\n');
  const project = fixtureProject({ 'src/b-components/a.vue': vue }, ['View UI']);

  const knowledge = buildProjectKnowledge(project, { frameworkProfiles: [IVIEW_PROFILE] });
  const prefixes = knowledge.customClassPrefixes.map(p => p.prefix);
  assert.ok(prefixes.includes('dc-'), 'measured custom prefix dc-');
  assert.ok(!prefixes.includes('ivu-'), 'baked framework prefix excluded');
  assert.ok(!prefixes.includes('text-'), 'generic prefix excluded');
  assert.deepStrictEqual(knowledge.frameworks, ['View UI']);
  assert.deepStrictEqual(knowledge.frameworkProfiles, [IVIEW_PROFILE]);
});

test('detects business dirs and round-trips through disk with profiles', () => {
  const project = fixtureProject({
    'src/b-components/a.vue': '<div class="dc-x dc-x dc-x dc-x dc-x dc-x dc-x dc-x dc-x"></div>',
    'src/view/b.vue': '<div></div>',
  }, ['View UI']);

  const written = writeProjectKnowledge(project, { frameworkProfiles: [IVIEW_PROFILE] });
  assert.strictEqual(written.writable, true);
  assert.ok(fs.existsSync(written.path));

  const readBack = readProjectKnowledge(project);
  assert.ok(readBack);
  assert.deepStrictEqual(readBack.businessDirs, ['src/b-components', 'src/view']);
  assert.deepStrictEqual(readBack.frameworkProfiles, [IVIEW_PROFILE]);
  assert.strictEqual(readBack.version, 2);
});

test('read returns null when file absent; build tolerates no profiles', () => {
  const project = fixtureProject({ 'src/a.vue': '<div></div>' });
  assert.strictEqual(readProjectKnowledge(project), null);
  const knowledge = buildProjectKnowledge(project);
  assert.deepStrictEqual(knowledge.frameworkProfiles, []);
});
