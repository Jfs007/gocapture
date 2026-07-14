'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

function loadRegistryWithHome(home) {
  process.env.MAGNUS_HOME = home;
  const file = require.resolve('./page-registry');
  delete require.cache[file];
  return require('./page-registry');
}

test('page registry stores url entry to project binding under user magnus home', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-registry-'));
  const registry = loadRegistryWithHome(home);
  registry.bindPageProject({
    url: 'https://winsup.itaored.com/ai-product/quick-put-goods?debug=1',
    projectRoot: '/project/winsup',
  });

  const resolved = registry.resolvePageProject({
    url: 'https://winsup.itaored.com/ai-product/quick-put-goods?t=2',
  });

  assert.equal(resolved.projectRoot, '/project/winsup');
  assert.equal(resolved.urlPattern, 'https://winsup.itaored.com/');
  assert.equal(fs.existsSync(path.join(home, 'registry.json')), true);
});

test('page registry resolves longest matching url pattern', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-registry-'));
  const registry = loadRegistryWithHome(home);
  registry.bindPageProject({
    urlPattern: 'https://example.com/',
    projectRoot: '/project/root',
  });
  registry.bindPageProject({
    urlPattern: 'https://example.com/admin/',
    projectRoot: '/project/admin',
  });

  const resolved = registry.resolvePageProject({
    url: 'https://example.com/admin/users',
  });

  assert.equal(resolved.projectRoot, '/project/admin');
});

test('page registry keeps localhost ports isolated', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-registry-'));
  const registry = loadRegistryWithHome(home);
  registry.bindPageProject({
    url: 'http://localhost:9002/',
    projectRoot: '/project/a',
  });
  registry.bindPageProject({
    url: 'http://localhost:9003/',
    projectRoot: '/project/b',
  });

  assert.equal(registry.resolvePageProject({ url: 'http://localhost:9002/page' }).projectRoot, '/project/a');
  assert.equal(registry.resolvePageProject({ url: 'http://localhost:9003/page' }).projectRoot, '/project/b');
});
