'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { AgentAdapter } = require('./core/agent-adapter');
const { AgentRegistry } = require('./core/agent-registry');
const { createConnectAgentService } = require('./index');

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
