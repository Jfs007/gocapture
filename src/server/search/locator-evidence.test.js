'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { scopedSelectionBody } = require('./locator-evidence');

function selection(uid, text) {
  return {
    uid,
    selectionId: uid,
    element: {
      uid,
      tag: 'div',
      text,
      outerHtml: `<div>${text}</div>`,
    },
  };
}

test('locator evidence keeps only selections referenced by the current request', () => {
  const body = {
    activeSelectionIds: ['selection_current'],
    selections: [
      selection('selection_old_a', '旧资产 A'),
      selection('selection_current', '当前选区'),
      selection('selection_old_b', '旧资产 B'),
    ],
  };

  const scoped = scopedSelectionBody(body);

  assert.deepEqual(scoped.selections.map(item => item.uid), ['selection_current']);
  assert.equal(body.selections.length, 3, 'filtering must not mutate the request body');
});

test('locator evidence supports multiple explicitly referenced selections', () => {
  const body = {
    activeSelectionIds: ['selection_a', 'selection_c'],
    selections: [
      selection('selection_a', '选区 A'),
      selection('selection_b', '未引用资产'),
      selection('selection_c', '选区 C'),
    ],
  };

  const scoped = scopedSelectionBody(body);

  assert.deepEqual(scoped.selections.map(item => item.uid), [
    'selection_a',
    'selection_c',
  ]);
});

test('legacy callers without an active selection list keep their original payload', () => {
  const body = {
    selections: [
      selection('selection_a', '选区 A'),
      selection('selection_b', '选区 B'),
    ],
  };

  assert.strictEqual(scopedSelectionBody(body), body);
});
