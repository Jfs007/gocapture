'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { deriveUiProfiles, uiCandidates, normalizeProfile } = require('./ui-profile-deriver');

function fixtureProject(pkg) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-ui-deriver-'));
  if (pkg) fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
  return { name: 'fixture', path: root, files: [] };
}

test('uiCandidates picks UI libs from deps and ignores tooling', () => {
  const project = fixtureProject({ dependencies: { iview: '^3.0.0', axios: '^1', webpack: '^5' }, devDependencies: { '@vue/test-utils': '^1' } });
  const names = uiCandidates(project).map(c => c.name);
  assert.ok(names.includes('iview'));
  assert.ok(!names.includes('axios'));
  assert.ok(!names.includes('webpack'));
});

test('normalizeProfile keeps valid prefixes/signatures and drops empties', () => {
  assert.strictEqual(normalizeProfile({ name: '', classPrefixes: [] }), null);
  const p = normalizeProfile({ name: 'iView', classPrefixes: [{ prefix: 'ivu-' }, { prefix: 'bad space' }], signatureHints: [{ searchAs: 'label="X"' }, {}] });
  assert.strictEqual(p.classPrefixes.length, 1);
  assert.strictEqual(p.classPrefixes[0].action, 'skip');
  assert.strictEqual(p.signatureHints.length, 1);
});

test('deriveUiProfiles consumes LangChain structured output', async () => {
  const project = fixtureProject({ dependencies: { iview: '^3.0.0' } });
  const runAgent = async () => ({
    rawText: '',
    structuredResponse: {
      profiles: [{
        name: 'iView',
        version: '3',
        classPrefixes: [{ prefix: 'ivu-', action: 'skip', reason: 'documented prefix' }],
        signatureHints: [{ domPattern: 'label.ivu-form-item-label', sourceConstruct: '<Form-item label>', searchAs: 'label="X"' }],
      }],
    },
  });
  const profiles = await deriveUiProfiles(project, { adapter: {}, runAgent });
  assert.strictEqual(profiles.length, 1);
  assert.strictEqual(profiles[0].name, 'iView');
  assert.strictEqual(profiles[0].classPrefixes[0].prefix, 'ivu-');
});

test('deriveUiProfiles returns [] when no UI deps (agent not called)', async () => {
  const project = fixtureProject({ dependencies: { axios: '^1' } });
  let called = false;
  const profiles = await deriveUiProfiles(project, { adapter: {}, runAgent: async () => { called = true; return { rawText: '[]' }; } });
  assert.deepStrictEqual(profiles, []);
  assert.strictEqual(called, false);
});

test('deriveUiProfiles degrades to [] on agent failure', async () => {
  const project = fixtureProject({ dependencies: { iview: '^3.0.0' } });
  const runAgent = async () => { throw new Error('mcp unavailable'); };
  const profiles = await deriveUiProfiles(project, { adapter: {}, runAgent });
  assert.deepStrictEqual(profiles, []);
});
