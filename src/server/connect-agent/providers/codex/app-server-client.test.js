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
      } else if (message.method === 'thread/name/set') {
        respond(child, message.id, {});
      } else if (message.method === 'thread/list') {
        respond(child, message.id, { data: [], nextCursor: null, backwardsCursor: null });
      } else if (message.method === 'thread/read') {
        respond(child, message.id, {
          thread: {
            id: message.params.threadId,
            name: 'Existing task',
            preview: 'Existing task preview',
            cwd: '/tmp/project',
            createdAt: 1,
            updatedAt: 2,
            status: 'idle',
          },
        });
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
          notify(child, 'turn/diff/updated', {
            threadId: 'thread_test',
            turnId: 'turn_test',
            diff: [
              '--- a/src/example.js',
              '+++ b/src/example.js',
              '@@ -1,1 +1,1 @@',
              '-const value = 1;',
              '+const value = 2;',
              '',
            ].join('\n'),
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

test('Codex App Server lists current-project and Desktop recent tasks separately', async () => {
  const child = fakeAppServer();
  child.stdin.removeAllListeners('data');
  child.stdin.on('data', chunk => {
    for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        respond(child, message.id, {});
      } else if (message.method === 'thread/list') {
        const data = message.params.cwd
          ? [{
              id: 'thread_project',
              name: 'Project task',
              preview: 'Project preview',
              cwd: '/tmp/project',
              updatedAt: 20,
            }]
          : [{
              id: 'thread_recent',
              name: 'Recent task',
              preview: 'Recent preview',
              cwd: '/tmp/other',
              updatedAt: 30,
            }, {
              id: 'thread_hidden',
              name: 'Other project task',
              cwd: '/tmp/other-project',
              updatedAt: 25,
            }];
        respond(child, message.id, { data, nextCursor: null, backwardsCursor: null });
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
    loadProjectlessThreadIds: () => new Set(['thread_recent']),
  });

  const result = await client.listBindableThreads({ cwd: '/tmp/project' });

  assert.deepEqual(result.project.map(thread => thread.id), ['thread_project']);
  assert.deepEqual(result.recent.map(thread => thread.id), ['thread_recent']);
  client.close();
});

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
  assert.equal(result.fileDiffs.length, 1);
  assert.equal(result.fileDiffs[0].file, 'src/example.js');
  assert.equal(result.fileDiffs[0].additions, 1);
  assert.equal(result.fileDiffs[0].deletions, 1);
  assert.ok(events.some(event => event.type === 'thread-started'));
  assert.ok(events.some(event => event.type === 'thread-named'));
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

test('Codex App Server does not create a hidden replacement when a bound thread cannot resume', async () => {
  const child = fakeAppServer();
  const requests = [];
  child.stdin.removeAllListeners('data');
  child.stdin.on('data', chunk => {
    for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      requests.push(message);
      if (message.method === 'initialize') {
        respond(child, message.id, {});
      } else if (message.method === 'thread/resume') {
        child.stdout.write(`${JSON.stringify({
          id: message.id,
          error: { code: -32000, message: 'thread missing' },
        })}\n`);
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
    () => client.runTask({
      cwd: '/tmp/project',
      prompt: '继续修改',
      threadId: 'thread_missing',
    }),
    /重新绑定/,
  );
  assert.equal(requests.some(request => request.method === 'thread/start'), false);
  client.close();
});

test('Codex App Server injects selection protocol only when it creates a new thread', async () => {
  const child = fakeAppServer();
  const requests = [];
  child.stdin.removeAllListeners('data');
  child.stdin.on('data', chunk => {
    for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      requests.push(message);
      if (message.method === 'initialize') {
        respond(child, message.id, {});
      } else if (message.method === 'thread/start') {
        respond(child, message.id, { thread: { id: 'thread_new' } });
      } else if (message.method === 'thread/name/set') {
        respond(child, message.id, {});
      } else if (message.method === 'turn/start') {
        respond(child, message.id, { turn: { id: 'turn_new' } });
        setImmediate(() => notify(child, 'turn/completed', {
          threadId: 'thread_new',
          turn: { id: 'turn_new', status: 'completed' },
        }));
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
    now: () => new Date(2026, 6, 27, 14, 5),
  });

  await client.runTask({
    cwd: '/tmp/winsup',
    prompt: '@selection_1 文案加粗',
    initialInstructions: '读取本地选区引用文件',
  });

  const turn = requests.find(request => request.method === 'turn/start');
  const startRequest = requests.find(request => request.method === 'thread/start');
  const nameRequest = requests.find(request => request.method === 'thread/name/set');
  assert.equal(startRequest.params.ephemeral, false);
  assert.equal(startRequest.params.threadSource, 'user');
  assert.deepEqual(nameRequest.params, {
    threadId: 'thread_new',
    name: 'GoCapture · winsup · 2026-07-27 14:05',
  });
  assert.equal(
    turn.params.input[0].text,
    '读取本地选区引用文件\n\n@selection_1 文案加粗',
  );
  client.close();
});

test('Codex App Server parses structured task summary and selection locations', async () => {
  const child = fakeAppServer();
  child.stdin.removeAllListeners('data');
  child.stdin.on('data', chunk => {
    for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        respond(child, message.id, {});
      } else if (message.method === 'thread/start') {
        respond(child, message.id, { thread: { id: 'thread_structured' } });
      } else if (message.method === 'thread/name/set') {
        respond(child, message.id, {});
      } else if (message.method === 'turn/start') {
        respond(child, message.id, { turn: { id: 'turn_structured' } });
        setImmediate(() => {
          const text = JSON.stringify({
            summary: '修改完成',
            selectionLocations: [{
              selectionId: 'selection_1',
              locations: [{
                file: 'src/StoreTable.vue',
                startLine: 20,
                endLine: 40,
                anchor: '<md-table',
              }],
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
  assert.deepEqual(result.selectionLocations, [{
    selectionId: 'selection_1',
    locations: [{
      file: 'src/StoreTable.vue',
      startLine: 20,
      endLine: 40,
      anchor: '<md-table',
    }],
  }]);
  client.close();
});

test('Codex App Server keeps locations when multiple structured messages are concatenated', async () => {
  const child = fakeAppServer();
  child.stdin.removeAllListeners('data');
  child.stdin.on('data', chunk => {
    for (const line of String(chunk).trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      if (message.method === 'initialize') {
        respond(child, message.id, {});
      } else if (message.method === 'thread/start') {
        respond(child, message.id, { thread: { id: 'thread_multiple_json' } });
      } else if (message.method === 'thread/name/set') {
        respond(child, message.id, {});
      } else if (message.method === 'turn/start') {
        respond(child, message.id, { turn: { id: 'turn_multiple_json' } });
        setImmediate(() => {
          notify(child, 'item/completed', {
            threadId: 'thread_multiple_json',
            turnId: 'turn_multiple_json',
            item: {
              type: 'agentMessage',
              text: JSON.stringify({
                summary: '位置已确认',
                selectionLocations: [{
                  selectionId: 'selection_1',
                  locations: [{
                    file: 'src/View.vue',
                    startLine: 8,
                    endLine: 12,
                    anchor: 'HELLO',
                  }],
                }],
              }),
            },
          });
          notify(child, 'item/completed', {
            threadId: 'thread_multiple_json',
            turnId: 'turn_multiple_json',
            item: {
              type: 'agentMessage',
              text: JSON.stringify({
                summary: '开发和验证完成',
                selectionLocations: [],
              }),
            },
          });
          notify(child, 'turn/completed', {
            threadId: 'thread_multiple_json',
            turn: { id: 'turn_multiple_json', status: 'completed' },
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

  assert.equal(result.finalResponse, '开发和验证完成');
  assert.equal(result.selectionLocations[0].locations[0].file, 'src/View.vue');
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
      } else if (message.method === 'thread/name/set') {
        originalWrite(`${JSON.stringify({ id: message.id, result: {} })}\n`);
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
      } else if (message.method === 'thread/name/set') {
        respond(child, message.id, {});
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
