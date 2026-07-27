'use strict';

const assert = require('assert');
const test = require('node:test');
const { AIMessage, fakeModel } = require('langchain');

const {
  loadLangChainRuntime,
  runLangChainAgent,
} = require('./runtime');
const {
  compactToolResultForModel,
  createLangChainTools,
} = require('./tool-adapter');
const {
  filterToolsByConfigAction,
  normalizeConfigAction,
} = require('../capabilities');

test('langchain runtime probe is non-throwing when optional dependencies are absent', () => {
  const runtime = loadLangChainRuntime();
  assert.equal(typeof runtime.available, 'boolean');
  assert.ok(Array.isArray(runtime.missing));
});

test('LangChain tool adapter executes an identical read-only call once', async () => {
  let executions = 0;
  const descriptors = [{
    name: 'read_file',
    description: 'Read file.',
    inputSchema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string' } } },
      required: ['files'],
    },
  }];
  const adapted = createLangChainTools({
    tools: descriptors,
    project: { path: process.cwd(), files: [] },
    executeTool: async () => {
      executions += 1;
      return { tool: 'read_file', providerId: 'test', result: { matches: [{ path: 'src/a.js' }] } };
    },
    textCache: new Map(),
    allowedTools: ['read_file'],
    readOnlyOnly: true,
  });
  await adapted.tools[0].invoke({ files: ['src/a.js'] });
  const duplicate = await adapted.tools[0].invoke({ files: ['src/a.js'] });
  assert.equal(executions, 1);
  assert.match(String(duplicate), /"duplicate":true/);
});

test('tool observations are compacted before returning to the model', () => {
  const result = compactToolResultForModel({
    matches: Array.from({ length: 20 }, (_, index) => ({ path: `src/${index}.js`, snippet: 'x'.repeat(3000) })),
  }, 5000);
  assert.equal(result.modelObservationTruncated, true);
  assert.ok(JSON.stringify(result).length <= 5000);
});

test('normalizeConfigAction accepts array and object forms', () => {
  assert.deepEqual([...normalizeConfigAction({ configAction: ['builtin', 'mcp'] })], ['builtin', 'mcp']);
  assert.deepEqual([...normalizeConfigAction({ configAction: { builtin: true, mcp: false, skill: true } })], ['builtin', 'skill']);
});

test('filterToolsByConfigAction matches source or category and leaves MCP to runtime', () => {
  const tools = [
    { name: 'read_file', source: 'builtin', category: 'project' },
    { name: 'recon_inspect', source: 'builtin', category: 'experience' },
    { name: 'skill__review', source: 'skill', category: 'skill' },
    { name: 'mcp__docs__query', source: 'mcp', category: 'mcp' },
  ];
  assert.deepEqual(
    filterToolsByConfigAction(tools, { configAction: ['experience', 'skill', 'mcp'] }).map(tool => tool.name),
    ['recon_inspect', 'skill__review']
  );
});

test('runLangChainAgent returns normalized final content', async () => {
  const result = await runLangChainAgent(
    { path: process.cwd(), files: [] },
    { langchainModel: fakeModel().respond(new AIMessage('done')), objective: 'hello' },
    { tools: [], executeTool: async () => null, textCache: new Map() }
  );
  assert.equal(result.ran, true);
  assert.equal(result.result.content, 'done');
  assert.equal(result.result.messageCount, 2);
});

test('runLangChainAgent executes GoCapture tools through LangChain', async () => {
  const calls = [];
  const model = fakeModel()
    .respondWithTools([{ id: 'call_1', name: 'echo', args: { text: 'hi' } }])
    .respond(new AIMessage('tool done'));
  const result = await runLangChainAgent(
    { path: process.cwd(), files: [] },
    { langchainModel: model, objective: 'use echo' },
    {
      tools: [{
        name: 'echo',
        description: 'Echo input text.',
        inputSchema: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
        },
      }],
      executeTool: async (project, call) => {
        calls.push(call);
        return { tool: call.tool, providerId: 'test', result: `echo:${call.input.text}` };
      },
      textCache: new Map(),
    }
  );
  assert.equal(result.ran, true);
  assert.equal(result.result.content, 'tool done');
  assert.deepEqual(calls, [{ tool: 'echo', input: { text: 'hi' } }]);
});
