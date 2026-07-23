'use strict';

const assert = require('assert');
const test = require('node:test');
const { ChatDeepSeek } = require('@langchain/deepseek');
const { DeepSeekLangChainAdapter, endpointToBaseUrl } = require('./providers/deepseek-adapter');
const {
  createLangChainModel,
  listModelAdapters,
  resolveModelAdapter,
} = require('./providers/registry');

const config = {
  provider: 'deepseek',
  apiKey: 'test-key',
  model: 'deepseek-chat',
  endpoint: 'https://api.deepseek.com/chat/completions',
};

test('DeepSeek adapter creates the official LangChain model', () => {
  const model = createLangChainModel(config);
  assert.ok(model instanceof ChatDeepSeek);
  assert.equal(model._llmType(), 'deepseek');
  assert.equal(model.clientConfig.baseURL, 'https://api.deepseek.com');
});

test('official LangChain model translates tool choice any to required', () => {
  const model = new DeepSeekLangChainAdapter().createModel(config);
  assert.equal(model.invocationParams({ tool_choice: 'any', tools: [] }).tool_choice, 'required');
});

test('DeepSeek adapter uses LangChain tool strategy for structured output', () => {
  const schema = { type: 'object', properties: { status: { type: 'string' } } };
  const expected = { strategy: 'tool', schema };
  const actual = new DeepSeekLangChainAdapter().prepareResponseFormat(schema, {
    toolStrategy: input => ({ strategy: 'tool', schema: input }),
  });
  assert.deepEqual(actual, expected);
});

test('DeepSeek adapter disables thinking only for structured tool output', () => {
  const adapter = new DeepSeekLangChainAdapter();
  const structuredModel = adapter.createModel(config, { structuredOutput: true });
  const regularModel = adapter.createModel(config);

  assert.deepEqual(structuredModel.invocationParams({ tools: [], tool_choice: 'any' }).thinking, {
    type: 'disabled',
  });
  assert.equal(regularModel.invocationParams({ tools: [], tool_choice: 'auto' }).thinking, undefined);
});

test('model adapter registry selects only explicitly registered adapters', () => {
  assert.deepEqual(listModelAdapters(), ['deepseek']);
  assert.equal(resolveModelAdapter({ provider: 'deepseek' }).id, 'deepseek');
  assert.throws(() => resolveModelAdapter({ provider: 'unknown' }), /不支持的模型供应商/);
  assert.equal(endpointToBaseUrl('https://proxy.example/v1/chat/completions'), 'https://proxy.example/v1');
});
