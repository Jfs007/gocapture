'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveRequestProject } = require('./routes');

test('search request resolves its own project root instead of the global current project', () => {
  const calls = [];
  const projectContext = {
    resolve(projectPath) {
      calls.push(projectPath);
      return { path: projectPath };
    },
    requireCurrent() {
      return { path: '/projects/global-current' };
    },
  };

  const project = resolveRequestProject(projectContext, {
    projectRoot: '/projects/request-bound',
  });

  assert.equal(project.path, '/projects/request-bound');
  assert.deepEqual(calls, ['/projects/request-bound']);
});

test('legacy search request without a project root uses the current project', () => {
  const projectContext = {
    resolve() {
      throw new Error('resolve should not run');
    },
    requireCurrent() {
      return { path: '/projects/global-current' };
    },
  };

  assert.equal(resolveRequestProject(projectContext, {}).path, '/projects/global-current');
});
