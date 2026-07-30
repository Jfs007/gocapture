'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ACCEPT_SELECTION_EVIDENCE,
  AgentToolSession,
  EXPAND_SELECTION_CONTEXT,
} = require('./agent-tool-session');

test('agent tool session exposes expansion only for referenced selections', () => {
  const empty = new AgentToolSession({ taskId: 'empty' });
  assert.deepEqual(empty.definitions(), []);

  const session = new AgentToolSession({
    taskId: 'task_1',
    allowedSelectionIds: ['selection_1'],
  });
  assert.deepEqual(
    session.definitions().map(tool => tool.name),
    [EXPAND_SELECTION_CONTEXT],
  );
});

test('evidence gate requires an Agent decision before source tools or extensions', async () => {
  const events = [];
  const session = new AgentToolSession({
    taskId: 'task_gate',
    allowedSelectionIds: ['selection_1'],
    evidenceGateSelectionIds: ['selection_1'],
    extensions: {
      definitions: [{
        name: 'skill__review',
        description: 'Review',
        inputSchema: { type: 'object', properties: {} },
      }],
      has: name => name === 'skill__review',
      invoke: async () => ({ ok: true }),
    },
    onEvent: event => events.push(event),
  });

  assert.deepEqual(session.definitions().map(tool => tool.name), [
    ACCEPT_SELECTION_EVIDENCE,
    EXPAND_SELECTION_CONTEXT,
    'skill__review',
  ]);
  assert.match(session.nativeToolDenial('Read'), /Evidence Gate/);
  await assert.rejects(session.request('skill__review', {}), /Evidence Gate/);

  assert.deepEqual(await session.request(ACCEPT_SELECTION_EVIDENCE, {
    selectionId: 'selection_1',
    reason: 'DOM structure and unique text are sufficient',
  }), {
    accepted: true,
    selectionId: 'selection_1',
    pendingSelectionIds: [],
  });
  assert.equal(session.nativeToolDenial('Read'), '');
  assert.deepEqual(await session.request('skill__review', {}), { ok: true });
  assert.equal(events[0].type, 'agent-evidence-accepted');
});

test('agent tool session waits for browser expansion result', async () => {
  const events = [];
  const session = new AgentToolSession({
    taskId: 'task_1',
    allowedSelectionIds: ['selection_1'],
    onEvent: event => events.push(event),
  });
  const pending = session.request(EXPAND_SELECTION_CONTEXT, {
    selectionId: 'selection_1',
    reason: 'missing parent DOM',
  });
  const required = events.find(event => event.type === 'agent-tool-required');
  assert.equal(required.capability.input.selectionId, 'selection_1');

  session.respond(required.capability.callId, {
    success: true,
    selectionId: 'selection_1',
    targetSelection: { element: { text: 'original' } },
    expandedContext: {
      markerEmbedded: true,
      selection: { element: { text: 'expanded' } },
    },
  });
  assert.deepEqual(await pending, {
    success: true,
    selectionId: 'selection_1',
    targetSelection: { element: { text: 'original' } },
    expandedContext: {
      markerEmbedded: true,
      selection: { element: { text: 'expanded' } },
    },
  });
  assert.equal(events.at(-1).type, 'agent-tool-resolved');
});

test('agent tool session rejects unrelated selections and caps expansion calls', async () => {
  const session = new AgentToolSession({
    taskId: 'task_1',
    allowedSelectionIds: ['selection_1'],
    maxCalls: 1,
  });
  await assert.rejects(
    session.request(EXPAND_SELECTION_CONTEXT, {
      selectionId: 'selection_other',
      reason: 'test',
    }),
    /本轮明确引用/,
  );
  const pending = session.request(EXPAND_SELECTION_CONTEXT, {
    selectionId: 'selection_1',
    reason: 'first',
  });
  await assert.rejects(
    session.request(EXPAND_SELECTION_CONTEXT, {
      selectionId: 'selection_1',
      reason: 'second',
    }),
    /本轮上限/,
  );
  session.close();
  await assert.rejects(pending, /会话已结束/);
});

test('agent tool session executes project extensions without browser round-trip', async () => {
  const events = [];
  const extensions = {
    definitions: [{
      name: 'skill__review',
      description: 'Load review instructions',
      inputSchema: { type: 'object', properties: {} },
    }],
    has: name => name === 'skill__review',
    invoke: async () => ({ instructions: 'Review first.' }),
  };
  const session = new AgentToolSession({
    taskId: 'task_1',
    extensions,
    onEvent: event => events.push(event),
  });
  assert.deepEqual(session.definitions().map(tool => tool.name), ['skill__review']);
  assert.deepEqual(await session.request('skill__review', {}), {
    instructions: 'Review first.',
  });
  assert.deepEqual(events.map(event => event.type), [
    'agent-extension-started',
    'agent-extension-completed',
  ]);
});
