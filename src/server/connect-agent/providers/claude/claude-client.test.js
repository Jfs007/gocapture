'use strict';

const assert = require('assert');
const test = require('node:test');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const { ClaudeCodeClient, updateTaskFromEvent } = require('./claude-client');

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
    spawnTask: (exe, opts) => { calls.push(opts); return fakeChild(STREAM); },
  });
  await client.connect();
  await client.runTask({ taskId: 't1', cwd: '/proj', prompt: '第一次', onEvent() {} });
  await client.runTask({ taskId: 't2', cwd: '/proj', prompt: '第二次', onEvent() {} });

  assert.strictEqual(calls[0].resumeSessionId, ''); // 首次无续接
  assert.strictEqual(calls[1].resumeSessionId, 'sess-1'); // 同项目续接上一次会话
});

test('ClaudeCodeClient rejects a task whose result is an error', async () => {
  const client = new ClaudeCodeClient({
    inspectCli: READY_CLI,
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
  const client = new ClaudeCodeClient({ inspectCli: READY_CLI });
  const status = client.status();
  assert.strictEqual(status.id, 'claude');
  assert.strictEqual(status.category, 'connection');
  assert.ok('connected' in status && 'installed' in status && 'activeTaskCount' in status);
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
