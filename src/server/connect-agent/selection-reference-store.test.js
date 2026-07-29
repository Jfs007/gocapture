'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  deleteProjectSelectionLocations,
  loadProjectSelectionLocations,
  persistLocatedSelectionReferences,
  selectionReferenceFile,
  updateProjectSelectionLocations,
} = require('./selection-reference-store');

test('runtime DOM is not persisted as a selection reference', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-selection-ref-'));
  const project = { path: root };

  const persisted = persistLocatedSelectionReferences(project, {
    locatorEvidence: {
      selections: [{
        selectionId: 'selection_1',
        tag: 'button',
        markup: '<button>登 录</button>',
      }],
    },
  });

  assert.deepEqual(persisted, []);
  assert.equal(fs.existsSync(selectionReferenceFile(project, 'selection_1')), false);
});

test('Locator source bindings persist locations and thumbnail in the selection JSON', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-selection-ref-'));
  const project = { path: root };

  persistLocatedSelectionReferences(project, {
    selectionBindings: [{
      uid: 'selection_1',
      binding: {
        targets: [{
          file: 'src/PwdForm.vue',
          role: 'main-render',
          line: 31,
          anchor: '登 录',
          targetSnippet: '<n-button>登 录</n-button>',
        }],
        investigation: { reason: 'not persisted' },
      },
    }],
    selectionThumbnails: [{
      selectionId: 'selection_1',
      thumbnail: 'data:image/png;base64,locator-thumbnail',
    }],
  });

  const stored = JSON.parse(fs.readFileSync(
    selectionReferenceFile(project, 'selection_1'),
    'utf8',
  ));
  assert.deepEqual(stored, {
    selectionId: 'selection_1',
    locations: [{
      file: 'src/PwdForm.vue',
      startLine: 31,
      endLine: 31,
      anchor: '登 录',
      source: '<n-button>登 录</n-button>',
    }],
    thumbnail: 'data:image/png;base64,locator-thumbnail',
  });
});

test('Agent locations persist the thumbnail supplied with the first turn', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-selection-ref-'));
  const project = { path: root };

  updateProjectSelectionLocations(
    project,
    [{
      selectionId: 'selection_1',
      locations: [{
        file: 'src/views/login/PwdForm.vue',
        startLine: 28,
        endLine: 35,
        anchor: '<n-button',
      }],
    }],
    [{
      selectionId: 'selection_1',
      thumbnail: 'data:image/png;base64,agent-thumbnail',
    }],
  );

  const stored = JSON.parse(fs.readFileSync(
    selectionReferenceFile(project, 'selection_1'),
    'utf8',
  ));
  assert.deepEqual(Object.keys(stored), ['selectionId', 'locations', 'thumbnail']);
  assert.equal(stored.locations[0].file, 'src/views/login/PwdForm.vue');
  assert.equal(stored.locations[0].endLine, 35);
  assert.equal(stored.locations[0].source, '');
  assert.equal(stored.thumbnail, 'data:image/png;base64,agent-thumbnail');
});

test('project selection locations can be restored and are deleted only explicitly', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-selection-ref-'));
  const project = { path: root };
  updateProjectSelectionLocations(
    project,
    [{
      selectionId: 'selection_1',
      locations: [{
        file: 'src/View.vue',
        startLine: 10,
        endLine: 12,
        anchor: 'HELLO',
      }],
    }],
    [{
      selectionId: 'selection_1',
      thumbnail: 'data:image/png;base64,restored-thumbnail',
    }],
  );

  const restored = loadProjectSelectionLocations(project);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].thumbnail, 'data:image/png;base64,restored-thumbnail');
  assert.equal(deleteProjectSelectionLocations(project, ['selection_1']), 1);
  assert.deepEqual(loadProjectSelectionLocations(project), []);
});

test('a later location update without image data preserves the stored thumbnail', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-selection-ref-'));
  const project = { path: root };
  const locations = [{
    selectionId: 'selection_1',
    locations: [{
      file: 'src/View.vue',
      startLine: 10,
      endLine: 12,
      anchor: 'HELLO',
    }],
  }];

  updateProjectSelectionLocations(project, locations, [{
    selectionId: 'selection_1',
    thumbnail: 'data:image/png;base64,preserved-thumbnail',
  }]);
  updateProjectSelectionLocations(project, locations);

  assert.equal(
    loadProjectSelectionLocations(project)[0].thumbnail,
    'data:image/png;base64,preserved-thumbnail',
  );
});
