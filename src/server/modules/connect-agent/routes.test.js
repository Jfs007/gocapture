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
      calls.push(['runTask', providerId, input.project.path]);
      input.onEvent({ type: 'task-started', task: { taskId: 'task_test' } });
      return { taskId: 'task_test', status: 'completed' };
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
          return { path: projectRoot || '/tmp/project' };
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
  assert.deepEqual(harness.calls, [['runTask', 'codex', '/tmp/project']]);
  assert.equal(harness.streamEvents[0].type, 'task-started');
  assert.equal(harness.streamEvents[1].type, 'result');
  assert.equal(harness.streamEvents[1].result.status, 'completed');
});
