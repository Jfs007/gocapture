'use strict';

const assert = require('assert');
const test = require('node:test');
const { AgentAdapter } = require('./agent-adapter');
const { AgentRegistry } = require('./agent-registry');
const { normalizeAgentEvent } = require('./agent-event');
const {
  ANTHROPIC_COMPATIBLE_BRANDS,
  MODEL_PROTOCOLS,
  assertModelBackendCompatible,
  listModelBackends,
} = require('./model-backends');

test('AgentAdapter exposes normalized capabilities', () => {
  const adapter = new AgentAdapter({
    id: 'sample',
    name: 'Sample',
    capabilities: { requiresThreadBinding: true },
    modelProtocols: [MODEL_PROTOCOLS.OPENAI_RESPONSES],
    modelBackends: ['inherit', 'custom-responses'],
  });
  const status = adapter.publicStatus({ connected: false });
  assert.equal(status.supportsThreadBinding, true);
  assert.equal(status.requiresThreadBinding, true);
  assert.deepEqual(status.modelProtocols, ['openai-responses']);
});

test('AgentRegistry rejects duplicate adapters', () => {
  const adapter = new AgentAdapter({ id: 'sample', name: 'Sample' });
  const registry = new AgentRegistry([adapter]);
  assert.equal(registry.require('sample'), adapter);
  assert.throws(() => registry.register(adapter), /已注册/);
});

test('model compatibility is based on wire protocol and allow-list', () => {
  const manifest = {
    name: 'Claude Code',
    modelProtocols: [MODEL_PROTOCOLS.ANTHROPIC_MESSAGES],
    modelBackends: ['inherit', 'deepseek', 'custom-anthropic'],
  };
  assert.equal(assertModelBackendCompatible(manifest, 'deepseek').protocol, 'anthropic-messages');
  assert.throws(
    () => assertModelBackendCompatible(manifest, 'custom-responses'),
    /不支持模型后端/,
  );
});

test('model brand backends share one Anthropic Messages compatibility contract', () => {
  const ids = ANTHROPIC_COMPATIBLE_BRANDS.map(([id]) => id);
  const backends = listModelBackends(ids);
  assert.deepEqual(backends.map(item => item.id), ids);
  assert.ok(backends.every(item =>
    item.protocol === MODEL_PROTOCOLS.ANTHROPIC_MESSAGES
    && item.selectionGroup === 'anthropic-compatible'
    && item.requiresBaseUrl
    && item.requiresModel
  ));
  assert.ok(backends.every(item => Array.isArray(item.modelPresets)));
  assert.ok(backends.every(item => Array.isArray(item.endpointPresets)));
  assert.ok(backends.find(item => item.id === 'deepseek').modelPresets.includes('deepseek-v4-flash'));
  assert.equal(
    backends.find(item => item.id === 'qwen').endpointPresets[1].value,
    'https://coding.dashscope.aliyuncs.com/apps/anthropic',
  );
});

test('provider events are normalized without discarding raw payloads', () => {
  const adapter = new AgentAdapter({ id: 'sample', name: 'Sample' });
  const event = normalizeAgentEvent(adapter, {
    type: 'turn-started',
    message: 'running',
    task: { taskId: 'task_1' },
    event: { method: 'turn/started' },
  });
  assert.equal(event.type, 'agent-event');
  assert.equal(event.rawType, 'turn-started');
  assert.equal(event.phase, 'running');
  assert.equal(event.event.method, 'turn/started');
});
