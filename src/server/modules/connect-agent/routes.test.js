'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  handleConnectAgentRoutes,
  hasLocatedSelectionBindings,
} = require('./routes');

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
    async respondToInteraction(providerId, input) {
      calls.push([
        'respondToInteraction',
        providerId,
        input.project.path,
        input.taskId,
        input.interactionId,
        input.response,
      ]);
      return {
        taskId: input.taskId,
        interactionId: input.interactionId,
        status: 'running',
      };
    },
    async listBindableThreads(providerId, project) {
      calls.push(['listBindableThreads', providerId, project.path]);
      return {
        project: [{ id: 'thread_project', name: 'Project task' }],
        recent: [{ id: 'thread_recent', name: 'Recent task' }],
      };
    },
    async bindProjectThread(providerId, project, threadId) {
      calls.push(['bindProjectThread', providerId, project.path, threadId]);
      return { threadId, threadName: 'Selected task', source: 'project' };
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

test('connect-agent selection routes restore and explicitly delete project references', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-selection-route-'));
  const directory = path.join(root, '.gocapture', 'selections');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'selection_1.json'), JSON.stringify({
    selectionId: 'selection_1',
    locations: [{
      file: 'src/View.vue',
      startLine: 1,
      endLine: 2,
      anchor: 'HELLO',
    }],
  }));

  const loadHarness = createHarness({
    method: 'GET',
    pathname: '/api/connect-agents/selections',
    search: `?projectRoot=${encodeURIComponent(root)}`,
  });
  assert.equal(await handleConnectAgentRoutes(loadHarness.args), true);
  assert.equal(loadHarness.result().body.selections[0].selectionId, 'selection_1');

  const deleteHarness = createHarness({
    method: 'DELETE',
    pathname: '/api/connect-agents/selections',
  });
  deleteHarness.args.readBody = async () => ({
    projectRoot: root,
    selectionIds: ['selection_1'],
  });
  assert.equal(await handleConnectAgentRoutes(deleteHarness.args), true);
  assert.equal(deleteHarness.result().body.deleted, 1);
  assert.equal(fs.existsSync(path.join(directory, 'selection_1.json')), false);
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

test('connect-agent threads route lists project and recent Codex tasks', async () => {
  const harness = createHarness({
    method: 'GET',
    pathname: '/api/connect-agents/codex/threads',
    search: '?projectRoot=%2Ftmp%2Fproject',
  });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.deepEqual(harness.calls, [
    ['listBindableThreads', 'codex', '/tmp/project'],
  ]);
  assert.equal(harness.result().body.threads.project[0].id, 'thread_project');
  assert.equal(harness.result().body.threads.recent[0].id, 'thread_recent');
});

test('connect-agent bind route persists the selected Codex task', async () => {
  const harness = createHarness({
    method: 'POST',
    pathname: '/api/connect-agents/codex/bind-thread',
  });
  harness.args.readBody = async () => ({
    projectRoot: '/tmp/project',
    threadId: 'thread_recent',
  });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.deepEqual(harness.calls, [
    ['bindProjectThread', 'codex', '/tmp/project', 'thread_recent'],
  ]);
  assert.equal(harness.result().body.session.threadId, 'thread_recent');
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

test('free chat skips Locator evidence preparation', async () => {
  const harness = createHarness({
    method: 'POST',
    pathname: '/api/connect-agents/claude/tasks/stream',
  });
  harness.args.readBody = async () => ({
    projectRoot: '/tmp/project',
    conversationMode: 'chat',
    userInstruction: '讲个笑话',
    selectionBindings: [],
  });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.equal(harness.calls[0][0], 'runTask');
  assert.equal(harness.calls[0][3], undefined);
  assert.equal(
    harness.streamEvents.some(event => event.type === 'locator-evidence'),
    false,
  );
});

test('connect-agent interaction route resumes the active provider task', async () => {
  const harness = createHarness({
    method: 'POST',
    pathname: '/api/connect-agents/claude/tasks/task_1/interactions/interaction_1',
  });
  harness.args.readBody = async () => ({
    projectRoot: '/tmp/project',
    response: '晚上 8 点',
  });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.deepEqual(harness.calls, [[
    'respondToInteraction',
    'claude',
    '/tmp/project',
    'task_1',
    'interaction_1',
    '晚上 8 点',
  ]]);
  assert.equal(harness.result().body.status, 'running');
});

test('an id-only selection binding still prepares runtime locator evidence', async () => {
  const harness = createHarness({
    method: 'POST',
    pathname: '/api/connect-agents/codex/tasks/stream',
  });
  harness.args.readBody = async () => ({
    projectRoot: '/tmp/project',
    selectionBindings: [{
      uid: 'selection_runtime',
      binding: { targets: [] },
    }],
    searchPayload: {
      selections: [{
        uid: 'selection_runtime',
        element: {
          tagName: 'button',
          outerHTML: '<button>登录</button>',
          innerText: '登录',
        },
      }],
    },
  });

  assert.equal(await handleConnectAgentRoutes(harness.args), true);
  assert.equal(harness.calls[0][3].selections[0].selectionId, 'selection_runtime');
  assert.ok(harness.streamEvents.some(event => event.type === 'locator-evidence'));
});

test('only bindings with a real source target suppress runtime evidence preparation', () => {
  assert.equal(hasLocatedSelectionBindings([{ uid: 'selection_1', binding: {} }]), false);
  assert.equal(hasLocatedSelectionBindings([{
    uid: 'selection_1',
    binding: { targets: [{ file: 'src/login.vue' }] },
  }]), false);
  assert.equal(hasLocatedSelectionBindings([{
    uid: 'selection_1',
    binding: { targets: [{ file: 'src/login.vue', line: 20 }] },
  }]), true);
});
