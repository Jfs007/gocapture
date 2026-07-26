'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const test = require('node:test');
const { CodexAppServerClient } = require('./app-server-client');

function fakeAppServer() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.killed = false;
  child.kill = signal => {
    child.killed = true;
    child.emit('exit', 0, signal);
  };
  child.stdin.on('data', chunk => {
    for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        respond(child, message.id, {});
      } else if (message.method === 'thread/resume') {
        respond(child, message.id, { thread: { id: message.params.threadId } });
      } else if (message.method === 'thread/start') {
        respond(child, message.id, { thread: { id: 'thread_test' } });
      } else if (message.method === 'turn/start') {
        respond(child, message.id, { turn: { id: 'turn_test', status: 'inProgress' } });
        setImmediate(() => {
          notify(child, 'turn/started', {
            threadId: 'thread_test',
            turn: { id: 'turn_test', status: 'inProgress' },
          });
          notify(child, 'item/agentMessage/delta', {
            threadId: 'thread_test',
            turnId: 'turn_test',
            itemId: 'message_test',
            delta: '修改完成',
          });
          notify(child, 'item/completed', {
            threadId: 'thread_test',
            turnId: 'turn_test',
            completedAtMs: Date.now(),
            item: { id: 'change_test', type: 'fileChange', changes: [{ path: 'src/example.js' }] },
          });
          notify(child, 'turn/completed', {
            threadId: 'thread_test',
            turn: { id: 'turn_test', status: 'completed' },
          });
        });
      }
    }
  });
  return child;
}

function respond(child, id, result) {
  child.stdout.write(`${JSON.stringify({ id, result })}\n`);
}

function notify(child, method, params) {
  child.stdout.write(`${JSON.stringify({ method, params })}\n`);
}

test('Codex App Server task streams thread, turn, events and final result', async () => {
  const child = fakeAppServer();
  const client = new CodexAppServerClient({
    inspectCli: async () => ({
      installed: true,
      authenticated: true,
      executable: 'codex',
      version: '0.132.0',
      message: 'Codex 已就绪',
    }),
    spawnAppServer: () => child,
  });
  const events = [];

  const result = await client.runTask({
    taskId: 'task_test',
    cwd: '/tmp/project',
    prompt: '完成测试任务',
    onEvent: event => events.push(event),
  });

  assert.equal(result.taskId, 'task_test');
  assert.equal(result.threadId, 'thread_test');
  assert.equal(result.turnId, 'turn_test');
  assert.equal(result.status, 'completed');
  assert.equal(result.finalResponse, '修改完成');
  assert.deepEqual(result.changedFiles, ['src/example.js']);
  assert.ok(events.some(event => event.type === 'thread-started'));
  assert.ok(events.some(event => event.type === 'turn-started'));
  assert.ok(events.some(event => event.type === 'codex-event'));
  assert.ok(events.some(event => event.type === 'task-completed'));
  client.close();
});

test('Codex App Server resumes a project thread before starting the next turn', async () => {
  const child = fakeAppServer();
  const requests = [];
  child.stdin.on('data', chunk => {
    requests.push(...String(chunk).trim().split('\n').filter(Boolean).map(JSON.parse));
  });
  const client = new CodexAppServerClient({
    inspectCli: async () => ({
      installed: true,
      authenticated: true,
      executable: 'codex',
      version: '0.132.0',
    }),
    spawnAppServer: () => child,
  });
  const events = [];
  const savedThreads = [];

  const result = await client.runTask({
    cwd: '/tmp/project',
    prompt: '继续修改',
    threadId: 'thread_test',
    onThread: thread => savedThreads.push(thread),
    onEvent: event => events.push(event),
  });

  assert.equal(result.threadId, 'thread_test');
  const resumeRequest = requests.find(request => request.method === 'thread/resume');
  assert.ok(resumeRequest);
  assert.equal(resumeRequest.params.threadId, 'thread_test');
  assert.equal('excludeTurns' in resumeRequest.params, false);
  assert.equal(requests.some(request => request.method === 'thread/start'), false);
  assert.ok(events.some(event => event.type === 'thread-resumed'));
  assert.deepEqual(savedThreads, [{ threadId: 'thread_test', resumed: true }]);
  client.close();
});

test('Codex App Server parses structured task summary and selection meanings', async () => {
  const child = fakeAppServer();
  child.stdin.removeAllListeners('data');
  child.stdin.on('data', chunk => {
    for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        respond(child, message.id, {});
      } else if (message.method === 'thread/start') {
        respond(child, message.id, { thread: { id: 'thread_structured' } });
      } else if (message.method === 'turn/start') {
        respond(child, message.id, { turn: { id: 'turn_structured' } });
        setImmediate(() => {
          const text = JSON.stringify({
            summary: '修改完成',
            selectionMeanings: [{
              selectionId: 'selection_1',
              meaning: '经营数据页面的店铺统计表格',
            }],
          });
          notify(child, 'item/completed', {
            threadId: 'thread_structured',
            turnId: 'turn_structured',
            item: { type: 'agentMessage', text },
          });
          notify(child, 'turn/completed', {
            threadId: 'thread_structured',
            turn: { id: 'turn_structured', status: 'completed' },
          });
        });
      }
    }
  });
  const client = new CodexAppServerClient({
    inspectCli: async () => ({
      installed: true,
      authenticated: true,
      executable: 'codex',
      version: '0.132.0',
    }),
    spawnAppServer: () => child,
  });

  const result = await client.runTask({
    cwd: '/tmp/project',
    prompt: '修改',
    outputSchema: { type: 'object' },
  });

  assert.equal(result.finalResponse, '修改完成');
  assert.deepEqual(result.selectionMeanings, [{
    selectionId: 'selection_1',
    meaning: '经营数据页面的店铺统计表格',
  }]);
  client.close();
});

test('Codex App Server task stops on a non-retryable error notification', async () => {
  const child = fakeAppServer();
  const originalWrite = child.stdout.write.bind(child.stdout);
  child.stdin.removeAllListeners('data');
  child.stdin.on('data', chunk => {
    for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        originalWrite(`${JSON.stringify({ id: message.id, result: {} })}\n`);
      } else if (message.method === 'thread/start') {
        originalWrite(`${JSON.stringify({ id: message.id, result: { thread: { id: 'thread_error' } } })}\n`);
      } else if (message.method === 'turn/start') {
        originalWrite(`${JSON.stringify({ id: message.id, result: { turn: { id: 'turn_error' } } })}\n`);
        setImmediate(() => {
          notify(child, 'error', {
            threadId: 'thread_error',
            turnId: 'turn_error',
            willRetry: false,
            error: { message: 'usage limit' },
          });
        });
      }
    }
  });
  const client = new CodexAppServerClient({
    inspectCli: async () => ({
      installed: true,
      authenticated: true,
      executable: 'codex',
      version: '0.132.0',
    }),
    spawnAppServer: () => child,
  });

  await assert.rejects(
    client.runTask({ cwd: '/tmp/project', prompt: 'test' }),
    /usage limit/,
  );
  client.close();
});

test('Codex App Server rejects an already-cancelled task without starting the server', async () => {
  const controller = new AbortController();
  controller.abort();
  let spawnCount = 0;
  const client = new CodexAppServerClient({
    inspectCli: async () => ({
      installed: true,
      authenticated: true,
      executable: 'codex',
      version: '0.132.0',
    }),
    spawnAppServer: () => {
      spawnCount += 1;
      return fakeAppServer();
    },
  });

  await assert.rejects(
    client.runTask({
      cwd: '/tmp/project',
      prompt: 'test',
      signal: controller.signal,
    }),
    /Codex 开发任务已取消/,
  );
  assert.equal(spawnCount, 0);
  assert.equal(client.tasks.size, 0);
});

test('Codex App Server handles cancellation after a turn starts without an unhandled rejection', async () => {
  const child = fakeAppServer();
  const controller = new AbortController();
  const requests = [];
  child.stdin.removeAllListeners('data');
  child.stdin.on('data', chunk => {
    for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      requests.push(message);
      if (message.method === 'initialize') {
        respond(child, message.id, {});
      } else if (message.method === 'thread/start') {
        respond(child, message.id, { thread: { id: 'thread_cancel' } });
      } else if (message.method === 'turn/start') {
        respond(child, message.id, { turn: { id: 'turn_cancel' } });
        setImmediate(() => controller.abort());
      } else if (message.method === 'turn/interrupt') {
        respond(child, message.id, {});
      }
    }
  });
  const client = new CodexAppServerClient({
    inspectCli: async () => ({
      installed: true,
      authenticated: true,
      executable: 'codex',
      version: '0.132.0',
    }),
    spawnAppServer: () => child,
  });

  await assert.rejects(
    client.runTask({
      cwd: '/tmp/project',
      prompt: 'test',
      signal: controller.signal,
    }),
    error => {
      assert.match(error.message, /Codex 开发任务已取消/);
      assert.equal(error.task.status, 'cancelled');
      return true;
    },
  );
  assert.ok(requests.some(request => request.method === 'turn/interrupt'));
  assert.equal(client.tasks.size, 0);
  client.close();
});
