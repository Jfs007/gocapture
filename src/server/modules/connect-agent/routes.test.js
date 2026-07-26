'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { handleConnectAgentRoutes } = require('./routes');

function createHarness({ method, pathname, search = '' }) {
  const calls = [];
  let response = null;
  const connectAgent = {
    async list(options) {
      calls.push(['list', options]);
      return [{ id: 'codex', state: 'disconnected' }];
    },
    async inspect(providerId) {
      calls.push(['inspect', providerId]);
      return { id: providerId, state: 'disconnected' };
    },
    async connect(providerId) {
      calls.push(['connect', providerId]);
      return { id: providerId, state: 'connected' };
    },
    disconnect(providerId) {
      calls.push(['disconnect', providerId]);
      return { id: providerId, state: 'disconnected' };
    },
    async runTask(providerId, input) {
      calls.push(['runTask', providerId, input.project.path, input.locatorEvidence]);
      input.onEvent({ type: 'task-started', task: { taskId: 'task_test' } });
      return { taskId: 'task_test', status: 'completed' };
    },
    projectSession(providerId, project) {
      calls.push(['projectSession', providerId, project.path]);
      return { threadId: 'thread_project' };
    },
  };
  const streamEvents = [];
  return {
    calls,
    result: () => response,
    streamEvents,
    args: {
      req: { method },
      res: {
        writableEnded: false,
        on() {},
        end() {
          this.writableEnded = true;
        },
      },
      url: new URL(`${pathname}${search}`, 'http://127.0.0.1'),
      connectAgent,
      readBody: async () => ({}),
      projectContext: {
        resolve(projectRoot) {
          return {
            path: projectRoot || '/tmp/project',
            files: [],
            kind: 'unknown',
          };
        },
      },
      sendJson: (_res, status, body) => {
        response = { status, body };
      },
      sendStreamHeaders: () => {},
      writeStreamEvent: (_res, event) => streamEvents.push(event),
    },
  };
}

test('connect-agent list route can refresh provider checks', async () => {
  const harness = createHarness({
    method: 'GET',
    pathname: '/api/connect-agents',
    search: '?refresh=1',
  });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.deepEqual(harness.calls, [['list', { refresh: true }]]);
  assert.equal(harness.result().body.providers[0].id, 'codex');
});

test('connect-agent list includes the current project thread binding', async () => {
  const harness = createHarness({
    method: 'GET',
    pathname: '/api/connect-agents',
    search: '?projectRoot=%2Ftmp%2Fproject',
  });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.equal(harness.result().body.providers[0].projectThreadId, 'thread_project');
  assert.deepEqual(harness.calls, [
    ['list', { refresh: false }],
    ['projectSession', 'codex', '/tmp/project'],
  ]);
});

test('connect-agent messages route loads the project timeline', async () => {
  const harness = createHarness({
    method: 'GET',
    pathname: '/api/connect-agents/messages',
    search: '?projectRoot=%2Ftmp%2Fproject&providerId=codex',
  });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.deepEqual(harness.result().body.messages, []);
});

test('connect-agent connect route delegates to the selected provider', async () => {
  const harness = createHarness({
    method: 'POST',
    pathname: '/api/connect-agents/codex/connect',
  });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.deepEqual(harness.calls, [['connect', 'codex']]);
  assert.equal(harness.result().body.provider.state, 'connected');
});

test('connect-agent task route streams lifecycle and result', async () => {
  const harness = createHarness({
    method: 'POST',
    pathname: '/api/connect-agents/codex/tasks/stream',
  });
  harness.args.readBody = async () => ({ projectRoot: '/tmp/project' });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.equal(harness.calls[0][0], 'runTask');
  assert.equal(harness.calls[0][1], 'codex');
  assert.equal(harness.calls[0][2], '/tmp/project');
  assert.equal(harness.calls[0][3].projectStructure, undefined);
  assert.ok(harness.streamEvents.some(event => event.type === 'locator-evidence'));
  assert.ok(harness.streamEvents.some(event => event.type === 'task-started'));
  const resultEvent = harness.streamEvents.find(event => event.type === 'result');
  assert.equal(resultEvent.result.status, 'completed');
});
