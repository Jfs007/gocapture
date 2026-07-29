'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  AsyncMessageQueue,
  ClaudeAgentSdkClient,
  buildTaskPrompt,
  updateTaskFromEvent,
  userMessage,
} = require('./agent-sdk-client');

test('userMessage creates the Agent SDK streaming input shape', () => {
  assert.deepEqual(userMessage('修改标题'), {
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'text', text: '修改标题' }],
    },
    parent_tool_use_id: null,
  });
});

test('buildTaskPrompt sends initial instructions once and appends a task schema', () => {
  const runner = { instructionsSent: false };
  const first = buildTaskPrompt(runner, {
    prompt: '执行任务',
    initialInstructions: '项目约束',
    outputSchema: { type: 'object' },
  });
  const second = buildTaskPrompt(runner, {
    prompt: '继续任务',
    initialInstructions: '项目约束',
  });

  assert.match(first, /^项目约束/);
  assert.match(first, /AskUserQuestion/);
  assert.match(first, /执行任务/);
  assert.match(first, /"type":"object"/);
  assert.match(second, /AskUserQuestion/);
  assert.match(second, /继续任务$/);
});

test('Claude Agent SDK keeps one project runtime and completes sequential tasks', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-claude-sdk-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const file = path.join(project, 'title.txt');
  fs.writeFileSync(file, 'before');

  const fake = createFakeSdk(async ({ index, output }) => {
    output.push({
      type: 'system',
      subtype: 'init',
      session_id: 'session-project',
    });
    if (index === 0) {
      output.push({
        type: 'assistant',
        session_id: 'session-project',
        message: {
          content: [{
            type: 'tool_use',
            name: 'Write',
            input: { file_path: file, content: 'after' },
          }],
        },
      });
      await tick();
      fs.writeFileSync(file, 'after');
    }
    output.push({
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: 'session-project',
      structured_output: {
        summary: `完成 ${index + 1}`,
        selectionLocations: [],
      },
    });
  });
  const client = connectedClient(fake.queryFactory);
  const threads = [];

  const first = await client.runTask({
    taskId: 'first',
    cwd: project,
    prompt: '第一次',
    onThread: value => threads.push(value),
  });
  const second = await client.runTask({
    taskId: 'second',
    cwd: project,
    prompt: '第二次',
  });

  assert.equal(fake.calls.length, 1);
  assert.equal(first.threadId, 'session-project');
  assert.equal(first.finalResponse, '完成 1');
  assert.deepEqual(first.changedFiles, ['title.txt']);
  assert.equal(first.fileDiffs[0].phase, 'applied');
  assert.equal(second.finalResponse, '完成 2');
  assert.deepEqual(threads, [{ threadId: 'session-project', resumed: false }]);
  client.close();
});

test('Claude Agent SDK resumes a persisted session when a runtime starts', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-claude-resume-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const fake = createFakeSdk(async ({ output }) => {
    output.push({
      type: 'system',
      subtype: 'init',
      session_id: 'existing-session',
    });
    output.push({
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: 'existing-session',
      result: '{"summary":"已恢复","selectionLocations":[]}',
    });
  });
  const client = connectedClient(fake.queryFactory);
  let threadEvent;

  const result = await client.runTask({
    cwd: project,
    prompt: '继续',
    threadId: 'existing-session',
    onThread: value => { threadEvent = value; },
  });

  assert.equal(fake.calls[0].options.resume, 'existing-session');
  assert.deepEqual(threadEvent, {
    threadId: 'existing-session',
    resumed: true,
  });
  assert.equal(result.finalResponse, '已恢复');
  client.close();
});

test('cancelling an active task closes its SDK runtime without leaking the next task', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-claude-cancel-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const fake = createFakeSdk(async ({ output }) => {
    output.push({
      type: 'system',
      subtype: 'init',
      session_id: 'cancel-session',
    });
  });
  const client = connectedClient(fake.queryFactory);
  const controller = new AbortController();
  const pending = client.runTask({
    cwd: project,
    prompt: '等待',
    signal: controller.signal,
  });
  await tick();
  controller.abort();

  await assert.rejects(pending, /已取消/);
  assert.equal(fake.handles[0].closed, true);
  client.close();
});

test('AskUserQuestion waits for a GoCapture response before the task continues', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-claude-hitl-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  let toolResult;
  const fake = createFakeSdk(async ({ options, output }) => {
    toolResult = await options.canUseTool('AskUserQuestion', {
      questions: [{
        question: '明天几点提醒？',
        header: '提醒时间',
        options: [
          { label: '上午 9 点', description: '上午提醒' },
          { label: '晚上 8 点', description: '晚上提醒' },
        ],
        multiSelect: false,
      }],
    }, {
      signal: new AbortController().signal,
      toolUseID: 'tool_question',
      requestId: 'request_question',
    });
    output.push({
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: 'hitl-session',
      result: '{"summary":"提醒时间已确认","selectionLocations":[]}',
    });
  });
  const client = connectedClient(fake.queryFactory);
  const events = [];
  const pending = client.runTask({
    taskId: 'hitl-task',
    cwd: project,
    prompt: '明天提醒我',
    onEvent: event => events.push(event),
  });

  await waitFor(() => events.find(event => event.type === 'interaction-required'));
  const required = events.find(event => event.type === 'interaction-required');
  assert.equal(required.task.status, 'waiting-input');
  assert.equal(required.interaction.questions[0].question, '明天几点提醒？');

  await client.respondToInteraction({
    taskId: 'hitl-task',
    interactionId: required.interaction.interactionId,
    response: '晚上 8 点',
  });
  const result = await pending;

  assert.equal(toolResult.behavior, 'allow');
  assert.deepEqual(toolResult.updatedInput.answers, {
    '明天几点提醒？': '晚上 8 点',
  });
  assert.equal(result.status, 'completed');
  client.close();
});

test('updateTaskFromEvent records native SDK tool calls and structured output', () => {
  const task = {
    cwd: '/tmp/project',
    status: 'starting',
    sessionId: '',
    finalResponse: '',
    changedFiles: new Set(),
    fileBaselines: new Map(),
    fileDiffs: new Map(),
  };
  const message = updateTaskFromEvent(task, {
    type: 'assistant',
    session_id: 'sdk-session',
    message: {
      content: [
        { type: 'text', text: '处理中' },
        { type: 'tool_use', name: 'Read', input: { file_path: '/tmp/project/a.js' } },
      ],
    },
  });
  updateTaskFromEvent(task, {
    type: 'result',
    subtype: 'success',
    structured_output: { summary: '完成', selectionLocations: [] },
  });

  assert.equal(task.sessionId, 'sdk-session');
  assert.match(message, /Claude 使用：生成回复/);
  assert.match(message, /Read \/tmp\/project\/a.js/);
  assert.equal(task.finalResponse, '{"summary":"完成","selectionLocations":[]}');
});

function connectedClient(queryFactory) {
  const client = new ClaudeAgentSdkClient({
    queryFactory,
    sdkVersion: 'test',
    runtimeConfig: { backendId: 'inherit' },
    auth: { mode: 'subscription', backendId: 'inherit' },
    loadRuntimeConfig: () => ({ backendId: 'inherit' }),
    loadRuntimeProfiles: () => ({ inherit: { backendId: 'inherit' } }),
    loadAuthForBackend: () => ({ mode: 'subscription', backendId: 'inherit' }),
    listAuthBackendIds: () => ['inherit'],
  });
  client.state = 'connected';
  return client;
}

function createFakeSdk(onMessage) {
  const calls = [];
  const handles = [];
  const queryFactory = ({ prompt, options }) => {
    calls.push({ prompt, options });
    const output = new AsyncMessageQueue();
    const handle = {
      closed: false,
      close() {
        this.closed = true;
        output.end();
      },
      async interrupt() {},
      next: () => output.next(),
      [Symbol.asyncIterator]() {
        return this;
      },
    };
    handles.push(handle);
    void (async () => {
      let index = 0;
      for await (const message of prompt) {
        await onMessage({ index, message, options, output, handle });
        index += 1;
      }
    })();
    return handle;
  };
  return { calls, handles, queryFactory };
}

function tick() {
  return new Promise(resolve => setImmediate(resolve));
}

async function waitFor(predicate, attempts = 30) {
  for (let index = 0; index < attempts; index += 1) {
    const value = predicate();
    if (value) return value;
    await tick();
  }
  throw new Error('condition was not met');
}
