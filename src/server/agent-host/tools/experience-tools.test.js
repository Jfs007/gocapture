'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { scanProject } = require('../../core/project');
const { updateComponentExperience } = require('../../experience/component-experience');
const {
  experienceCatalog,
  loadExperiences,
  recordExperience,
} = require('./experience-tools');

function write(root, file, content) {
  const absolute = path.join(root, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

test('Recon Experience tools record and revalidate evidence files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-tools-'));
  write(root, 'source/component.js', 'export const component = {};');
  write(root, 'feature/usage.js', 'component();');
  const project = scanProject(root);
  recordExperience(project, {
    capabilityPath: 'source/component.js',
    role: 'component',
    keywords: ['component'],
    evidenceFiles: ['feature/usage.js'],
    documentation: '# Usage\n\nUse `component()` from the project module.',
  });
  assert.equal(experienceCatalog(project)[0].valid, true);
  assert.match(loadExperiences(project, ['source/component.js'])[0].documentation, /component/);
  const updated = updateComponentExperience(project, {
    componentPath: 'source/component.js',
    name: 'Shared component',
    role: 'component',
    keywords: ['shared'],
    usageFiles: ['feature/usage.js'],
    doc: '# Updated usage\n\nCall the verified shared component.',
  });
  assert.equal(updated.name, 'Shared component');
  assert.equal(updated.validation.valid, true);
  assert.match(updated.doc, /Updated usage/);
  fs.unlinkSync(path.join(root, 'feature/usage.js'));
  const rescanned = scanProject(root);
  assert.equal(experienceCatalog(rescanned)[0].valid, false);
  assert.equal(loadExperiences(rescanned, ['source/component.js'])[0].documentation, '');
  fs.rmSync(root, { recursive: true, force: true });
});
