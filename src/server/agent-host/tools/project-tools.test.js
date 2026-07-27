'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { executeAgentTool, listAgentTools } = require('./registry');

function fixtureProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gocapture-agent-tools-'));
  const projectFiles = [];
  for (const [file, content] of Object.entries(files)) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    projectFiles.push({
      path: file,
      size: Buffer.byteLength(content),
      mtimeMs: Date.now(),
    });
  }
  return { name: 'fixture', path: root, kind: 'unknown', stack: [], files: projectFiles };
}

test('project tools expose relation-oriented read tools', () => {
  const names = listAgentTools().map(tool => tool.name);
  assert.ok(names.includes('search_source_evidence'));
  assert.ok(names.includes('trace_file_evidence_flow'));
  assert.ok(names.includes('read_closed_blocks'));
  assert.ok(names.includes('inspect_symbol_occurrences'));
});

test('search_source_evidence reports measured frequencies and rejects obvious noise', async () => {
  const project = fixtureProject({
    'src/a.any': '<label>执行人</label>\n<label>反馈附件</label>',
    'src/b.any': '// 执行人\nconsole.log("反馈附件")',
    'src/c.any': '<label>执行人员</label>\n<label>反馈附件</label>',
  });
  const output = await executeAgentTool(project, {
    tool: 'search_source_evidence',
    input: {
      anchors: [
        { text: '执行人', kind: 'text' },
        { text: '反馈附件', kind: 'text' },
      ],
      mode: 'all',
    },
  });
  assert.equal(output.result.matchedFileCount, 1);
  assert.equal(output.result.candidates[0].file, 'src/a.any');
  assert.deepEqual(
    output.result.anchorFrequency.map(item => [item.text, item.matchedFileCount]),
    [['执行人', 1], ['反馈附件', 2]]
  );
});

test('project tools expose LangChain-native inputs instead of legacy scope protocol', async () => {
  const readFile = listAgentTools().find(tool => tool.name === 'read_file');
  const searchText = listAgentTools().find(tool => tool.name === 'search_text');
  assert.ok(readFile);
  assert.ok(searchText);
  assert.ok(readFile.inputSchema.properties.files);
  assert.equal(readFile.inputSchema.properties.scope, undefined);
  assert.ok(searchText.inputSchema.properties.roots);
  assert.equal(searchText.inputSchema.properties.scope, undefined);

  const project = fixtureProject({ 'src/a.ts': 'export const value = 1' });
  const output = await executeAgentTool(project, {
    tool: 'read_file',
    input: { files: ['src/a.ts'] },
  });
  assert.equal(output.tool, 'read_file');
  assert.ok(output.result.matches.some(match => match.path === 'src/a.ts'));
});

test('read_file supports explicit line-range continuation through around', async () => {
  const project = fixtureProject({
    'src/long.ts': Array.from({ length: 180 }, (_, index) => `line ${index + 1}`).join('\n'),
  });
  const output = await executeAgentTool(project, {
    tool: 'read_file',
    input: { files: ['src/long.ts'], around: '81-100' },
  });
  assert.equal(output.result.matches[0].lineStart, 81);
  assert.equal(output.result.matches[0].lineEnd, 100);
  assert.match(output.result.matches[0].snippet, /^line 81/m);
  assert.match(output.result.matches[0].snippet, /line 100$/m);
});

test('search_text can return summary-only when a DOM investigation query exceeds its result limit', async () => {
  const files = Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [`src/file-${index + 1}.js`, `shared-anchor ${index + 1}`])
  );
  const project = fixtureProject(files);
  const output = await executeAgentTool(project, {
    tool: 'search_text',
    input: { roots: ['src'], terms: ['shared-anchor'], maxResults: 3 },
  }, {
    searchResultPolicy: 'summary-on-truncation',
  });

  assert.equal(output.result.status, 'too-broad');
  assert.equal(output.result.stats.matchedFiles, 5);
  assert.equal(output.result.resultLimit, 3);
  assert.equal(output.result.truncated, true);
  assert.deepEqual(output.result.matches, []);
  assert.match(output.result.note, /增加判别性关键词/);
});

test('search_text keeps partial results when summary-only policy is not enabled', async () => {
  const files = Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [`src/file-${index + 1}.js`, `shared-anchor ${index + 1}`])
  );
  const project = fixtureProject(files);
  const output = await executeAgentTool(project, {
    tool: 'search_text',
    input: { roots: ['src'], terms: ['shared-anchor'], maxResults: 3 },
  });

  assert.equal(output.result.status, undefined);
  assert.equal(output.result.truncated, true);
  assert.equal(output.result.matches.length, 3);
});

test('trace_file_evidence_flow observes relative glob consumers', async () => {
  const project = fixtureProject({
    'src/router/modules/data-center.ts': 'export default []',
    'src/router/index.ts': [
      "const files = import.meta.glob('./modules/*.ts', { eager: true })",
      'const modulesRouter = Object.values(files)',
      'export const sortedRoutes = modulesRouter',
    ].join('\n'),
  });
  const output = await executeAgentTool(project, {
    tool: 'trace_file_evidence_flow',
    input: { file: 'src/router/modules/data-center.ts' },
  });
  assert.equal(output.tool, 'trace_file_evidence_flow');
  assert.equal(output.result.observations[0].consumerFile, 'src/router/index.ts');
  assert.deepEqual(output.result.observations[0].nextSearchSymbols, ['sortedRoutes']);
});

test('read_closed_blocks returns syntax-closed snippets around terms', async () => {
  const project = fixtureProject({
    'src/menu.js': [
      'const permissionRoutes = routes',
      'const menuOptions = format(permissionRoutes)',
      'export default menuOptions',
    ].join('\n'),
  });
  const output = await executeAgentTool(project, {
    tool: 'read_closed_blocks',
    input: { file: 'src/menu.js', terms: ['menuOptions'] },
  });
  assert.equal(output.tool, 'read_closed_blocks');
  assert.ok(output.result.blocks.some(block => block.code.includes('menuOptions')));
});

test('inspect_symbol_occurrences returns distant definition and use sites in one call', async () => {
  const middle = Array.from({ length: 90 }, (_, index) => `  const value${index} = ${index}`).join('\n');
  const project = fixtureProject({
    'src/subtask.js': [
      "import subTask from './subtask.view'",
      'function Component(options = {}, subTaskComponent = subTask) {',
      middle,
      '  return combine(options, subTaskComponent)',
      '}',
    ].join('\n'),
  });
  const output = await executeAgentTool(project, {
    tool: 'inspect_symbol_occurrences',
    input: {
      file: 'src/subtask.js',
      symbols: ['subTask', 'subTaskComponent'],
      missingFact: 'Component 是否实际使用 subTask',
      decisionImpact: '决定两个候选文件之间的关系是否成立',
    },
  });
  assert.equal(output.tool, 'inspect_symbol_occurrences');
  assert.equal(output.result.missingFact, 'Component 是否实际使用 subTask');
  const componentFacts = output.result.symbols.find(item => item.symbol === 'subTaskComponent');
  assert.deepEqual(componentFacts.occurrences.map(item => item.line), [2, 93]);
  assert.match(componentFacts.occurrences[1].snippet, /combine\(options, subTaskComponent\)/);
  assert.equal(componentFacts.occurrences[0].localBlock.lineStart, 2);
  assert.ok(componentFacts.occurrences[1].localBlock.lineStart <= 93);
});
