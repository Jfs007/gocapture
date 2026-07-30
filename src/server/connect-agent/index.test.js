'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { AgentAdapter } = require('./core/agent-adapter');
const { AgentRegistry } = require('./core/agent-registry');
const { createConnectAgentService } = require('./index');
const { loadProjectMessages } = require('./message-store');
const { loadProjectSelectionLocations } = require('./selection-reference-store');

class FakeAgent extends AgentAdapter {
  constructor({ requiresThreadBinding = false } = {}) {
    super({
      id: 'fake',
      name: 'Fake Agent',
      capabilities: { requiresThreadBinding },
    });
    this.proxy = '';
  }

  configureProject(settings) {
    this.proxy = settings.proxy;
  }

  status() {
    return this.publicStatus({
      connected: true,
      installed: true,
      authenticated: true,
      state: 'connected',
    });
  }

  async inspect() {
    return this.status();
  }

  async connect() {
    return this.status();
  }

  disconnect() {
    return this.status();
  }

  async runTask(input) {
    return {
      taskId: input.taskId,
      threadId: 'thread_1',
      turnId: 'turn_1',
      status: 'completed',
      finalResponse: '{"summary":"done","selectionLocations":[]}',
      changedFiles: [],
      selectionLocations: [],
    };
  }
}

test('connect service is driven by adapter capabilities instead of provider ids', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-agent-registry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.gocapture'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.gocapture', 'connect-agent.json'),
    JSON.stringify({ proxy: 'http://127.0.0.1:7890' }),
  );
  const adapter = new FakeAgent();
  let taskInput;
  adapter.runTask = async input => {
    taskInput = input;
    return {
      taskId: input.taskId,
      threadId: 'thread_1',
      turnId: 'turn_1',
      status: 'completed',
      finalResponse: '{"summary":"done","selectionLocations":[]}',
      changedFiles: [],
      selectionLocations: [],
    };
  };
  const service = createConnectAgentService({
    registry: new AgentRegistry([adapter]),
  });
  const project = { path: root };

  const result = await service.runTask('fake', {
    project,
    userInstruction: 'change',
    selectionBindings: [],
  });

  assert.equal(result.status, 'completed');
  assert.equal(adapter.proxy, 'http://127.0.0.1:7890');
  assert.deepEqual(taskInput.allowedSelectionIds, []);
});

test('connect service limits Agent local tools to selections referenced by this task', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-agent-tools-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const adapter = new FakeAgent();
  let taskInput;
  adapter.runTask = async input => {
    taskInput = input;
    return {
      taskId: input.taskId,
      threadId: 'thread_1',
      turnId: 'turn_1',
      status: 'completed',
      finalResponse: '{"summary":"done","selectionLocations":[]}',
      changedFiles: [],
      selectionLocations: [],
    };
  };
  const service = createConnectAgentService({
    registry: new AgentRegistry([adapter]),
  });

  await service.runTask('fake', {
    project: { path: root },
    userInstruction: '@selection_active 修改',
    selectionBindings: [{
      uid: 'selection_active',
      binding: { targets: [] },
    }, {
      uid: '',
      binding: { targets: [] },
    }],
  });

  assert.deepEqual(taskInput.allowedSelectionIds, ['selection_active']);
});

test('any adapter can require a bound thread through its manifest', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-required-thread-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const service = createConnectAgentService({
    registry: new AgentRegistry([new FakeAgent({ requiresThreadBinding: true })]),
  });

  await assert.rejects(
    service.runTask('fake', {
      project: { path: root },
      userInstruction: 'change',
      selectionBindings: [],
    }),
    /尚未绑定 Fake Agent 任务/,
  );
});

test('connect service persists the task diff and refreshes the selected source', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-task-diff-service-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/View.vue'), '.title { color: red; }\n');

  class EditingAgent extends FakeAgent {
    async runTask(input) {
      fs.writeFileSync(path.join(input.cwd, 'src/View.vue'), '.title { color: blue; }\n');
      return {
        ...(await super.runTask(input)),
        changedFiles: ['src/View.vue'],
      };
    }
  }

  const service = createConnectAgentService({
    registry: new AgentRegistry([new EditingAgent()]),
  });
  const project = { path: root };
  const result = await service.runTask('fake', {
    project,
    userInstruction: '@selection_title 改为蓝色',
    selectionBindings: [{
      uid: 'selection_title',
      binding: {
        targets: [{
          file: 'src/View.vue',
          line: 1,
          anchor: '.title',
          targetSnippet: '.title { color: red; }',
        }],
      },
    }],
  });

  assert.equal(result.selectionDiffs.length, 1);
  assert.equal(result.selectionDiffs[0].after.source, '.title { color: blue; }');
  assert.equal(result.selectionLocations.length, 1);
  assert.equal(result.selectionLocations[0].locations[0].source, '.title { color: blue; }');
  assert.equal(
    loadProjectSelectionLocations(project)[0].locations[0].source,
    '.title { color: blue; }',
  );
  const resultMessage = loadProjectMessages(project, 'fake')
    .find(message => message.kind === 'result');
  assert.equal(resultMessage.metadata.selectionDiffs[0].additions, 1);
  assert.equal(resultMessage.metadata.selectionDiffs[0].deletions, 1);
});

test('connect service maps provider diff after a first-time selection is located', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-first-selection-diff-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/View.js'), 'const title = "before";\n');

  class LocatingAgent extends FakeAgent {
    async runTask(input) {
      fs.writeFileSync(path.join(input.cwd, 'src/View.js'), 'const title = "after";\n');
      return {
        ...(await super.runTask(input)),
        changedFiles: ['src/View.js'],
        fileDiffs: [{
          file: 'src/View.js',
          patch: [
            '--- a/src/View.js',
            '+++ b/src/View.js',
            '@@ -1,1 +1,1 @@',
            '-const title = "before";',
            '+const title = "after";',
            '',
          ].join('\n'),
          additions: 1,
          deletions: 1,
          source: 'fake-provider',
        }],
        selectionLocations: [{
          selectionId: 'selection_first',
          locations: [{
            file: 'src/View.js',
            startLine: 1,
            endLine: 1,
            anchor: 'const title',
          }],
        }],
      };
    }
  }

  const service = createConnectAgentService({
    registry: new AgentRegistry([new LocatingAgent()]),
  });
  const result = await service.runTask('fake', {
    project: { path: root },
    userInstruction: '@selection_first 修改标题',
    locatorEvidence: {
      selections: [{ selectionId: 'selection_first' }],
    },
    selectionBindings: [],
  });

  assert.equal(result.selectionDiffs.length, 1);
  assert.equal(result.selectionDiffs[0].selectionId, 'selection_first');
  assert.equal(result.selectionDiffs[0].file, 'src/View.js');
  assert.equal(result.selectionDiffs[0].additions, 1);
  assert.match(result.selectionDiffs[0].patch, /const title = "after"/);
});
