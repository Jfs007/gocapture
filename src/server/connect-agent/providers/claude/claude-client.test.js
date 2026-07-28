'use strict';

const assert = require('assert');
const test = require('node:test');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const { ClaudeCodeClient, updateTaskFromEvent } = require('./claude-client');
const { authToEnv } = require('./auth-store');

const NO_AUTH = {
  loadAuth: () => ({ mode: '', apiKey: '', oauthToken: '' }),
  saveAuth: () => true,
  loadRuntimeConfig: () => ({ backendId: 'inherit' }),
  saveRuntimeConfig: () => true,
  spawnProbe: (...args) => okProbe(...args), // 延后引用，避开 const 的 TDZ
};

function fakeChild(lines) {
  const stdout = new Readable({ read() {} });
  const child = new EventEmitter();
  child.stdout = stdout;
  child.stderr = new EventEmitter();
  child.stdin = { write() {}, end() {} };
  child.killed = false;
  child.kill = () => { child.killed = true; };
  setImmediate(() => {
    for (const line of lines) stdout.push(`${JSON.stringify(line)}\n`);
    stdout.push(null);
  });
  return child;
}

function resultProbe(result, is_error = false) {
  return () => {
    const stdout = new Readable({ read() {} });
    const child = new EventEmitter();
    child.stdout = stdout;
    child.stderr = new EventEmitter();
    child.killed = false;
    child.kill = () => { child.killed = true; };
    setImmediate(() => {
      stdout.push(`${JSON.stringify({ type: 'result', subtype: 'success', is_error, result })}\n`);
      stdout.push(null);
      setImmediate(() => child.emit('exit', 0));
    });
    return child;
  };
}
const okProbe = resultProbe('OK');

const READY_CLI = async () => ({ installed: true, authenticated: true, version: '1.0.0', executable: 'claude', message: 'ok' });

const STREAM = [
  { type: 'system', subtype: 'init', session_id: 'sess-1', model: 'claude' },
  { type: 'assistant', session_id: 'sess-1', message: { content: [
    { type: 'text', text: '我来改这个文件' },
    { type: 'tool_use', name: 'Edit', input: { file_path: 'src/a.js' } },
  ] } },
  { type: 'result', subtype: 'success', session_id: 'sess-1', is_error: false, result: '已完成：加粗了标签' },
];

test('ClaudeCodeClient.runTask maps stream-json → events, tracks session + changed files', async () => {
  const calls = [];
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    ...NO_AUTH,
    spawnTask: (exe, opts) => { calls.push(opts); return fakeChild(STREAM); },
  });
  await client.connect();
  const events = [];
  const result = await client.runTask({
    taskId: 't1',
    cwd: '/proj',
    prompt: '把标签加粗',
    onEvent: event => events.push(event),
  });

  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(result.finalResponse, '已完成：加粗了标签');
  assert.strictEqual(result.sessionId, 'sess-1');
  assert.deepStrictEqual(result.changedFiles, ['src/a.js']);
  assert.ok(events.some(e => e.type === 'task-started'));
  assert.ok(events.some(e => e.type === 'task-completed'));
  assert.ok(events.some(e => e.type === 'agent-event'));
  assert.strictEqual(client.status().activeTaskCount, 0); // 结束后清理
});

test('ClaudeCodeClient resumes the session for a later task in the same project', async () => {
  const calls = [];
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    ...NO_AUTH,
    spawnTask: (exe, opts) => { calls.push(opts); return fakeChild(STREAM); },
  });
  await client.connect();
  await client.runTask({ taskId: 't1', cwd: '/proj', prompt: '第一次', onEvent() {} });
  await client.runTask({ taskId: 't2', cwd: '/proj', prompt: '第二次', onEvent() {} });

  assert.strictEqual(calls[0].resumeSessionId, ''); // 首次无续接
  assert.strictEqual(calls[1].resumeSessionId, 'sess-1'); // 同项目续接上一次会话
});

test('ClaudeCodeClient accepts and reports a persisted project session', async () => {
  const calls = [];
  const sessions = [];
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    ...NO_AUTH,
    spawnTask: (exe, opts) => { calls.push(opts); return fakeChild(STREAM); },
  });
  await client.connect();
  await client.runTask({
    taskId: 'persisted',
    cwd: '/proj',
    prompt: '继续',
    threadId: 'sess-1',
    onThread: session => sessions.push(session),
    onEvent() {},
  });

  assert.strictEqual(calls[0].resumeSessionId, 'sess-1');
  assert.deepStrictEqual(sessions, [{ threadId: 'sess-1', resumed: true }]);
});

test('ClaudeCodeClient keeps the persisted session when resumed stream reports another id', async () => {
  const sessions = [];
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    ...NO_AUTH,
    spawnTask: () => fakeChild([
      { type: 'system', subtype: 'init', session_id: 'invocation-session' },
      { type: 'result', subtype: 'success', session_id: 'invocation-session', is_error: false, result: '完成' },
    ]),
  });
  await client.connect();
  const result = await client.runTask({
    taskId: 'resumed',
    cwd: '/proj',
    prompt: '继续',
    threadId: 'stable-project-session',
    onThread: session => sessions.push(session),
    onEvent() {},
  });

  assert.strictEqual(result.sessionId, 'stable-project-session');
  assert.deepStrictEqual(sessions, [{ threadId: 'stable-project-session', resumed: true }]);
});

test('ClaudeCodeClient does not persist a session id emitted only by an immediate error result', async () => {
  const sessions = [];
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    ...NO_AUTH,
    spawnTask: () => fakeChild([
      {
        type: 'result',
        subtype: 'error_during_execution',
        session_id: 'invalid-invocation-session',
        is_error: true,
        result: 'No conversation found',
      },
    ]),
  });
  await client.connect();

  await assert.rejects(
    () => client.runTask({
      taskId: 'bad-resume',
      cwd: '/proj',
      prompt: '继续',
      onThread: session => sessions.push(session),
      onEvent() {},
    }),
    /No conversation found/,
  );
  assert.deepStrictEqual(sessions, []);
  assert.strictEqual(client.sessions.has('/proj'), false);
});

test('ClaudeCodeClient rejects a task whose result is an error', async () => {
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    ...NO_AUTH,
    spawnTask: () => fakeChild([
      { type: 'system', subtype: 'init', session_id: 's' },
      { type: 'result', subtype: 'error_during_execution', session_id: 's', is_error: true, result: '炸了' },
    ]),
  });
  await client.connect();
  await assert.rejects(
    () => client.runTask({ taskId: 'e1', cwd: '/proj', prompt: 'x', onEvent() {} }),
    /炸了/,
  );
});

test('status() reports the connection contract shape', () => {
  const client = new ClaudeCodeClient({ inspectCli: READY_CLI, ...NO_AUTH });
  const status = client.status();
  assert.strictEqual(status.id, 'claude');
  assert.strictEqual(status.category, 'connection');
  assert.ok('connected' in status && 'installed' in status && 'activeTaskCount' in status);
  assert.deepStrictEqual(status.authModes, ['subscription', 'apikey']);
});

test('connect() validates auth via a real probe and rejects on 403-like failure', async () => {
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    ...NO_AUTH,
    // 探针回一条"鉴权失败当文本"的结果（Claude 的真实行为）
    spawnProbe: resultProbe('Failed to authenticate. API Error: 403 Request not allowed'),
  });
  await assert.rejects(() => client.connect(), /403|授权/);
  assert.strictEqual(client.status().connected, false);
});

test('authToEnv maps apikey / subscription correctly', () => {
  const key = authToEnv({ mode: 'apikey', apiKey: 'sk-ant-x' }, { FOO: '1' });
  assert.strictEqual(key.ANTHROPIC_API_KEY, 'sk-ant-x');
  // 订阅：清掉残留 key，避免被劫持成 403；有令牌则用 OAuth token
  const sub = authToEnv({ mode: 'subscription', oauthToken: 'tok' }, { ANTHROPIC_API_KEY: 'stale', FOO: '1' });
  assert.strictEqual(sub.ANTHROPIC_API_KEY, undefined);
  assert.strictEqual(sub.CLAUDE_CODE_OAUTH_TOKEN, 'tok');
});

test('authToEnv injects proxy env vars when proxy is set', () => {
  const env = authToEnv({ mode: 'subscription', oauthToken: 't', proxy: 'http://127.0.0.1:7890' }, { FOO: '1' });
  assert.strictEqual(env.https_proxy, 'http://127.0.0.1:7890');
  assert.strictEqual(env.HTTPS_PROXY, 'http://127.0.0.1:7890');
  assert.strictEqual(env.all_proxy, 'http://127.0.0.1:7890');
});

test('connect() surfaces region-block (403) with a proxy hint', async () => {
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    ...NO_AUTH,
    spawnProbe: resultProbe('Failed to authenticate. API Error: 403 Request not allowed'),
  });
  await assert.rejects(() => client.connect(), /请求受限|代理/);
});

test('connect({auth}) persists auth and status reflects it', async () => {
  let saved = null;
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    loadAuth: () => ({ mode: '', apiKey: '', oauthToken: '' }),
    saveAuth: (auth) => { saved = auth; return true; },
    loadRuntimeConfig: () => ({ backendId: 'inherit' }),
    saveRuntimeConfig: () => true,
    spawnProbe: okProbe,
  });
  await client.connect({ auth: { mode: 'apikey', apiKey: 'sk-ant-abc' } });
  assert.strictEqual(saved.mode, 'apikey');
  assert.strictEqual(saved.apiKey, 'sk-ant-abc');
  assert.strictEqual(client.status().authMode, 'apikey');
  assert.strictEqual(client.status().authConfigured, true);
});

test('connect({runtimeConfig}) persists an isolated DeepSeek runtime', async () => {
  let savedRuntime = null;
  const taskCalls = [];
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    loadAuth: () => ({ mode: '', provider: '', apiKey: '', oauthToken: '' }),
    saveAuth: () => true,
    loadRuntimeConfig: () => ({ backendId: 'inherit' }),
    saveRuntimeConfig: (config) => { savedRuntime = config; return true; },
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ type: 'message' }),
    }),
    spawnProbe: okProbe,
    spawnTask: (exe, options) => {
      taskCalls.push(options);
      return fakeChild(STREAM);
    },
  });

  await client.connect({
    auth: { mode: 'apikey', backendId: 'deepseek', apiKey: 'sk-ds' },
    runtimeConfig: { backendId: 'deepseek' },
  });
  await client.runTask({ taskId: 'deepseek', cwd: '/proj', prompt: '修改', onEvent() {} });

  assert.strictEqual(savedRuntime.backendId, 'deepseek');
  assert.strictEqual(client.status().runtimeConfig.backendId, 'deepseek');
  assert.strictEqual(client.status().authBackendId, 'deepseek');
  assert.strictEqual(taskCalls[0].model, 'deepseek-v4-pro[1m]');
  assert.strictEqual(taskCalls[0].env.ANTHROPIC_BASE_URL, 'https://api.deepseek.com/anthropic');
  assert.strictEqual(taskCalls[0].env.ANTHROPIC_AUTH_TOKEN, 'sk-ds');
});

test('connect() does not persist or retain a runtime config that fails validation', async () => {
  let saveCount = 0;
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    loadAuth: () => ({ mode: '', provider: '', apiKey: '', oauthToken: '' }),
    saveAuth: () => { saveCount += 1; return true; },
    loadRuntimeConfig: () => ({ backendId: 'inherit' }),
    saveRuntimeConfig: () => { saveCount += 1; return true; },
    fetch: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Authentication Fails, api key is invalid' } }),
    }),
  });

  await assert.rejects(
    () => client.connect({
      auth: { mode: 'apikey', backendId: 'deepseek', apiKey: 'bad' },
      runtimeConfig: { backendId: 'deepseek' },
    }),
    /DeepSeek 授权失败/,
  );

  assert.strictEqual(saveCount, 0);
  assert.strictEqual(client.status().runtimeConfig.backendId, 'inherit');
  assert.strictEqual(client.status().authConfigured, false);
});

test('DeepSeek validation returns an API authentication error without spawning Claude', async () => {
  let spawned = false;
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
    loadAuth: () => ({ mode: '', provider: '', apiKey: '', oauthToken: '' }),
    saveAuth: () => true,
    loadRuntimeConfig: () => ({ backendId: 'inherit' }),
    saveRuntimeConfig: () => true,
    fetch: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'API key ****1899 is invalid' } }),
    }),
    spawnProbe: () => {
      spawned = true;
      return okProbe();
    },
  });

  await assert.rejects(
    () => client.connect({
      auth: { mode: 'apikey', backendId: 'deepseek', apiKey: 'invalid' },
      runtimeConfig: { backendId: 'deepseek' },
    }),
    /API key \*\*\*\*1899 is invalid/,
  );
  assert.strictEqual(spawned, false);
});

test('updateTaskFromEvent tracks file edits and final text', () => {
  const task = { sessionId: '', finalResponse: '', changedFiles: new Set(), status: '' };
  updateTaskFromEvent(task, { type: 'system', subtype: 'init', session_id: 'x' }, new Set(['Write']));
  assert.strictEqual(task.sessionId, 'x');
  updateTaskFromEvent(task, { type: 'assistant', message: { content: [
    { type: 'tool_use', name: 'Write', input: { file_path: 'a.ts' } },
    { type: 'text', text: 'hi' },
  ] } }, new Set(['Write']));
  assert.ok(task.changedFiles.has('a.ts'));
  assert.strictEqual(task.finalResponse, 'hi');
});
