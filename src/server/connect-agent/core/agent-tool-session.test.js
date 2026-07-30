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

test('expand keeps small marked markup intact (no dedup) so all sibling columns stay visible', async () => {
  const session = new AgentToolSession({ taskId: 'task_expand', allowedSelectionIds: ['selection_1'] });
  const pending = session.request(EXPAND_SELECTION_CONTEXT, { selectionId: 'selection_1', reason: 'need row' });
  const callId = [...session.pending.values()][0].call.callId;

  // 一行 16 个同构 <td>，各列文本不同；目标那列被 <gocapture-original-selection> 包裹。
  const cols = ['S925', 'MAY', 'TARGET', '艺人营销', '2026', '潘柳杨', '0.00', '', '', '0.00', '0.00', '审核中', '', '', '', ''];
  const tds = cols.map((text, i) => i === 2
    ? '<gocapture-original-selection data-selection-id="selection_1"><td class="c"><span>TARGET</span></td></gocapture-original-selection>'
    : `<td class="c"><span>${text}</span></td>`);
  const rawMarkup = `<tr class="row">${tds.join('')}</tr>`;

  session.respond(callId, { success: true, selectionId: 'selection_1', expandedMarkup: rawMarkup });
  const result = await pending;

  // 关键：小 markup 原样透传，不去重——每一列的可辨识文本都还在，模型才能判断目标属于哪一列。
  assert.equal(result.expandedMarkup, rawMarkup, '小 markup 应原样透传');
  assert.doesNotMatch(result.expandedMarkup, /gocapture-repeat/, '不得折叠同构兄弟列');
  for (const text of ['S925', 'MAY', '艺人营销', '审核中']) {
    assert.ok(result.expandedMarkup.includes(text), `应保留兄弟列文本：${text}`);
  }
  assert.match(result.expandedMarkup, /<gocapture-original-selection/, '原始选区标记应保留');
  // 回归护栏：绝不回传选区元数据（ancestors/subtree/computedStyle 才是 440KB 撑爆的根因）。
  assert.ok(!('ancestors' in result) && !('subtree' in result));
});

test('expand compresses only oversized markup and caps it, marker still survives', async () => {
  const session = new AgentToolSession({ taskId: 'task_big', allowedSelectionIds: ['selection_1'] });
  const pending = session.request(EXPAND_SELECTION_CONTEXT, { selectionId: 'selection_1', reason: 'huge list' });
  const callId = [...session.pending.values()][0].call.callId;

  // 超大扩区（几千个同构行）：应触发折叠兜底并封顶，同时保住标记。
  const rows = Array.from({ length: 4000 }, (_, i) => `<li class="r"><span>row${i}</span></li>`);
  rows[0] = '<gocapture-original-selection><li class="r"><span>row0</span></li></gocapture-original-selection>';
  const rawMarkup = `<ul>${rows.join('')}</ul>`;

  session.respond(callId, { success: true, selectionId: 'selection_1', expandedMarkup: rawMarkup });
  const result = await pending;

  assert.ok(result.expandedMarkup.length < rawMarkup.length, '超大 markup 应被压缩');
  assert.ok(result.expandedMarkup.length <= 30000, '超大 markup 应封顶');
  assert.match(result.expandedMarkup, /gocapture-repeat/, '超长列表应折叠去重');
  assert.match(result.expandedMarkup, /<gocapture-original-selection/, '标记应存活压缩');
});

test('expand rounds log the weak-clue reason and the exact DOM fed back to the Agent', async () => {
  const events = [];
  const session = new AgentToolSession({
    taskId: 'task_log',
    allowedSelectionIds: ['selection_1'],
    onEvent: event => events.push(event),
  });
  const pending = session.request(EXPAND_SELECTION_CONTEXT, {
    selectionId: 'selection_1',
    reason: '单格无法区分发布者/执行人列',
  });
  const callId = [...session.pending.values()][0].call.callId;
  const markup = '<tr><td><span>A</span></td>'
    + '<gocapture-original-selection><td><span>TARGET</span></td></gocapture-original-selection></tr>';
  session.respond(callId, { success: true, selectionId: 'selection_1', markerEmbedded: true, expandedMarkup: markup });
  await pending;

  const required = events.find(event => event.type === 'agent-tool-required');
  assert.match(required.message, /弱线索/);
  assert.match(required.message, /单格无法区分发布者\/执行人列/, '应带上 Agent 的扩区理由');

  const resolved = events.find(event => event.type === 'agent-tool-resolved');
  assert.match(resolved.message, /第 1 次/);
  assert.match(resolved.message, /gocapture-original-selection/, '应说明原始选区已标记');
  assert.ok(resolved.message.includes(markup), '日志应带上实际喂给 Agent 的定位 DOM');
});
