'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { scanProject } = require('../../../core/project');
const {
  expandSyntaxEvidenceFlow,
  findPathConsumers,
  traceSymbolHops,
  traceFileEvidenceFlow,
} = require('./syntax-evidence-flow');

function projectFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-syntax-flow-'));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return { root, project: scanProject(root) };
}

test('syntax evidence expansion follows closed nodes from a glob seed to an exported symbol', () => {
  const text = [
    "const files = import.meta.glob('./modules/*.ts', { eager: true })",
    'const modulesRouter = Object.keys(files).reduce((modules, modulePath) => {',
    "  const moduleName = modulePath.replace(/^\\.\\/modules\\/(.*)\\.\\w+$/, '$1')",
    '  modules[moduleName] = files[modulePath].default',
    '  return modules',
    '}, {})',
    'export const sortedRoutes = sortRoutes(modulesRouter)',
  ].join('\n');

  const chains = expandSyntaxEvidenceFlow({
    text,
    seedText: './modules/*.ts',
    maxDepth: 4,
  });

  assert.equal(chains.length, 1);
  assert.deepEqual(chains[0].nodes.map(node => node.defines[0]), [
    'files',
    'modulesRouter',
    'sortedRoutes',
  ]);
  assert.deepEqual(chains[0].nextSearchSymbols, ['sortedRoutes']);
});

test('path consumers use relative glob coverage without assuming src or @ aliases', t => {
  const fixture = projectFixture({
    'app/router/groups/data-center.ts': "export default [{ title: '抖音经营数据' }]",
    'app/router/index.ts': [
      "const files = import.meta.glob('./groups/*.ts', { eager: true })",
      'const routeGroups = collect(files)',
      'export const routes = flatten(routeGroups)',
    ].join('\n'),
  });
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const consumers = findPathConsumers(
    fixture.project,
    'app/router/groups/data-center.ts',
    new Map()
  );

  assert.equal(consumers.length, 1);
  assert.equal(consumers[0].file, 'app/router/index.ts');
  assert.equal(consumers[0].evidence[0].kind, 'directory-glob');
  assert.equal(consumers[0].evidence[0].seedText, './groups/*.ts');
});

test('file evidence flow returns observations and never decides the final render file', t => {
  const fixture = projectFixture({
    'app/router/groups/data-center.ts': "export default [{ title: '抖音经营数据' }]",
    'app/router/index.ts': [
      "const files = import.meta.glob('./groups/*.ts', { eager: true })",
      'const routeGroups = collect(files)',
      'export const routes = flatten(routeGroups)',
    ].join('\n'),
  });
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const flow = traceFileEvidenceFlow(
    fixture.project,
    'app/router/groups/data-center.ts',
    new Map()
  );

  assert.equal(flow.length, 1);
  assert.equal(flow[0].consumerFile, 'app/router/index.ts');
  assert.deepEqual(flow[0].nextSearchSymbols, ['routes']);
  assert.equal(Object.hasOwn(flow[0], 'renderFile'), false);
});

test('symbol hops continue from exported symbols through import aliases without framework assumptions', t => {
  const fixture = projectFixture({
    'app/router/groups/data-center.ts': "export default [{ title: '抖音经营数据' }]",
    'app/router/index.ts': [
      "const files = import.meta.glob('./groups/*.ts', { eager: true })",
      'const routeGroups = collect(files)',
      'export const routes = flatten(routeGroups)',
    ].join('\n'),
    'app/consumer.ts': [
      "import { routes as loadedRoutes } from './router'",
      'const visibleRoutes = filterVisible(loadedRoutes)',
      'export const navigation = createNavigation(visibleRoutes)',
    ].join('\n'),
  });
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const flow = traceFileEvidenceFlow(
    fixture.project,
    'app/router/groups/data-center.ts',
    new Map()
  );

  const routerFlow = flow.find(item => item.consumerFile === 'app/router/index.ts');
  assert.ok(routerFlow);
  assert.deepEqual(routerFlow.nextSearchSymbols, ['routes']);
  const symbolHop = routerFlow.symbolHops[0];
  assert.deepEqual(symbolHop.symbols, ['routes']);
  assert.ok(symbolHop.consumers.some(item => item.file === 'app/consumer.ts'));
  const consumer = symbolHop.consumers.find(item => item.file === 'app/consumer.ts');
  assert.ok(consumer.nextSearchSymbols.includes('navigation'));
});

test('traceSymbolHops follows only symbols produced by the previous closed node', t => {
  const fixture = projectFixture({
    'app/source.ts': 'export const sourceValue = createSource()',
    'app/consumer.ts': [
      "import { sourceValue as localValue } from './source'",
      'const derivedValue = normalize(localValue)',
      'export const finalValue = wrap(derivedValue)',
    ].join('\n'),
  });
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const hops = traceSymbolHops(fixture.project, ['sourceValue'], new Map(), 2);
  assert.equal(hops[0].symbols[0], 'sourceValue');
  const consumer = hops[0].consumers.find(item => item.file === 'app/consumer.ts');
  assert.ok(consumer);
  assert.ok(consumer.nextSearchSymbols.includes('finalValue'));
});
