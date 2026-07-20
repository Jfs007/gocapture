const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { scanProject } = require('../core/project');
const { runDiscoveryOperation } = require('./discovery-executor');

function mkProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'discovery-executor-'));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return { root, project: scanProject(root) };
}

test('find_directory_consumers finds glob or directory consumers for a definition module', () => {
  const { root, project } = mkProject({
    'src/router/modules/data-center.ts': 'export default [{ meta: { title: "抖音经营数据" } }]',
    'src/router/index.ts': [
      "const routeModules = import.meta.glob('./modules/*.ts', { eager: true })",
      'export const asyncRoutes = Object.values(routeModules).flatMap((item: any) => item.default)',
    ].join('\n'),
    'src/main.ts': 'import router, { setupRouter } from "./router"',
    'src/store/modules/permission.ts': 'import { asyncRoutes } from "@/router"',
    'src/utils/http.ts': 'import router from "@/router"',
    'src/views/page.vue': 'import { useRouteE } from "@/router/enhance"',
  });
  try {
    const result = runDiscoveryOperation(project, {
      operation: 'find_directory_consumers',
      target: 'src/router/modules/data-center.ts',
      scope: { roots: ['src'] },
      maxResults: 8,
    });
    const indexMatch = result.matches.find(item => item.path === 'src/router/index.ts');
    assert.ok(indexMatch);
    assert.equal(indexMatch.relation, 'directory-glob-consumer');
    assert.match(indexMatch.snippet, /import\.meta\.glob/);
    assert.deepEqual(result.matches.map(item => item.path), ['src/router/index.ts']);

    const directoryResult = runDiscoveryOperation(project, {
      operation: 'find_directory_consumers',
      target: 'src/router/modules',
      scope: { roots: ['src'] },
      maxResults: 8,
    });
    assert.deepEqual(directoryResult.matches.map(item => item.path), ['src/router/index.ts']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
