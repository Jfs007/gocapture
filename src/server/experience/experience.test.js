const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanProject } = require('../core/project');
const { executeDiscoveryPlan } = require('./discovery-executor');
const { enhanceLocatedPrompt } = require('./prompt-enhancer');
const { ensureProjectContext, projectTechnicalStackMarkdown } = require('./project-context');
const { loadExperienceContexts, loadExperienceMetas } = require('./experience-store');
const {
  memorySnapshot,
  removeTaskSessionMemory,
  updateStoredExperience,
  updateTaskSessionMemory,
} = require('./memory-service');

function write(root, file, content) {
  const absolute = path.join(root, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-experience-'));
  try {
    write(root, 'package.json', JSON.stringify({
      dependencies: { vue: '^3.0.0', axios: '^1.0.0', 'naive-ui': '^2.0.0' },
      devDependencies: { vite: '^5.0.0', typescript: '^5.0.0' },
    }));
    const longAppBody = Array.from({ length: 900 }, (_, index) => `const marker${index} = ${index}`).join('\n');
    write(root, 'src/App.vue', [
      '<script setup lang="ts">',
      "import { onMounted } from 'vue'",
      longAppBody,
      'onMounted(() => {})',
      'const MAGNUS_FULL_TARGET_FILE_MARKER = true',
      '</script>',
    ].join('\n'));
    write(root, 'src/main.ts', "import App from './App.vue'\n");
    write(root, 'src/imports.ts', [
      "import helper from './helper'",
      "import icon from './icon.png'",
      'export { helper, icon }',
    ].join('\n'));
    write(root, 'src/helper.ts', 'export default function helper() { return true }\n');
    write(root, 'src/icon.png', 'not-real-image');
    write(root, 'src/api/user.ts', [
      "import http from '@/utils/http/axios'",
      "export function getUser() { return http.request({ url: '/api/user', method: 'GET' }) }",
    ].join('\n'));
    write(root, 'src/api/common.ts', [
      "import http from '@/utils/http/axios'",
      "export function getConfig() { return http.request({ url: '/api/config', method: 'GET' }) }",
    ].join('\n'));
    write(root, 'src/utils/http/axios/index.ts', 'export default { request(config: unknown) { return config } }\n');
    write(root, 'src/api/model/baseModel.ts', 'export interface BasicResponseModel<T> { code: number; data: T }\n');
    write(root, 'src/components/index.ts', "export { default as MdTable } from './md-table'\n");
    write(root, 'src/components/md-table/hooks/useTable.ts', 'export function useTable(options: unknown) { return options }\n');
    write(root, 'src/components/md-table/index.vue', '<template><div class="md-table"><slot /></div></template>\n');
    write(root, 'src/views/order/index.vue', [
      '<template><md-table :columns="columns" :data="data" /></template>',
      '<script setup lang="ts">',
      "import { MdTable } from '@/components'",
      "import { useTable } from '@/components/md-table/hooks/useTable'",
      'const { data } = useTable({ api: () => Promise.resolve([]) })',
      'const columns = []',
      '</script>',
    ].join('\n'));
    write(root, 'src/views/goods/index.vue', [
      '<template><MdTable :columns="columns" :data="data" /></template>',
      '<script setup lang="ts">',
      "import { MdTable } from '@/components'",
      "import { useTable } from '@/components/md-table/hooks/useTable'",
      'const { data } = useTable({ api: () => Promise.resolve([]) })',
      'const columns = []',
      '</script>',
    ].join('\n'));

    const project = scanProject(root);
    const context = ensureProjectContext(project);
    assert.equal(context.writable, true);
    assert.match(context.markdown, /Project Interpreter 尚未运行/);
    assert.doesNotMatch(context.markdown, /Naive UI/);
    assert.match(
      projectTechnicalStackMarkdown(project, '## 技术栈\n- Vue\n\n## 项目信息\n- old'),
      /Vue/
    );
    assert.ok(fs.existsSync(path.join(root, '.magnus', 'Project.md')));

    const discovery = executeDiscoveryPlan(project, {
      domain: 'api-integration',
      requests: [{
        id: 'api-usage',
        operation: 'search_text',
        scope: { roots: ['src'] },
        terms: ['http.request'],
        fileTypes: ['ts'],
        maxResults: 10,
        maxLinesPerResult: 8,
      }],
    });
    assert.equal(discovery.results['api-usage'].matches.length, 2);

    const tableDiscovery = executeDiscoveryPlan(project, {
      domain: 'table-pattern',
      requests: [{
        id: 'table-frequency',
        operation: 'find_related_examples',
        scope: { roots: ['src'] },
        terms: ['useTable', 'MdTable', 'md-table'],
        maxResults: 10,
        maxLinesPerResult: 12,
      }],
    });
    assert.equal(tableDiscovery.results['table-frequency'].stats.termStats.find(item => item.term === 'useTable').files >= 2, true);
    assert.equal(tableDiscovery.results['table-frequency'].stats.termStats.find(item => item.term === 'MdTable').files >= 2, true);

    const importDiscovery = executeDiscoveryPlan(project, {
      domain: 'import-pattern',
      requests: [{
        id: 'imports',
        operation: 'find_imports',
        target: 'src/imports.ts',
        maxResults: 10,
      }],
    });
    assert.deepEqual(importDiscovery.results.imports.matches.map(item => item.path), ['src/helper.ts']);

    const logs = [];
    const result = await enhanceLocatedPrompt({
      project,
      body: {
        pagePath: '/',
        searchPayload: {
          url: 'http://localhost/',
          userPrompt: '默认请求初始化接口 /api/setup',
          selectionInstructions: [],
        },
      },
      modelItems: [{
        file: 'src/App.vue',
        locateLevel: 'direction',
        codeSnippet: 'onMounted(() => {})',
        directionGuess: '在应用挂载时初始化',
        prompt: '粗提示词',
        confidence: 80,
      }],
      log: message => logs.push(message),
      invoke: async (stage, prompt) => {
        if (stage === 'experience-discovery-plan') {
          return JSON.stringify({
            domain: 'api-integration',
            objective: '发现接口接入方式',
            questions: ['接口如何封装'],
            requests: [{
              id: 'api-usage',
              operation: 'search_text',
              path: 'src',
              fileTypes: ['ts'],
              maxResults: 10,
              maxLinesPerResult: 8,
              reason: '寻找真实案例',
            }],
            expectedExperience: { name: '普通接口接入', triggerTags: ['接口'] },
          });
        }
        if (stage === 'experience-discovery-plan-repair') {
          return JSON.stringify({
            domain: 'api-integration',
            objective: '发现接口接入方式',
            questions: ['接口如何封装'],
            requests: [{
              id: 'api-usage',
              operation: 'search_text',
              scope: { roots: ['src'] },
              terms: ['http.request'],
              fileTypes: ['ts'],
              maxResults: 10,
              maxLinesPerResult: 16,
              reason: '寻找真实案例',
            }],
          });
        }
        assert.match(prompt, /src\/api\/user\.ts/);
        assert.match(prompt, /http\.request/);
        assert.match(prompt, /MAGNUS_FULL_TARGET_FILE_MARKER/);
        return JSON.stringify({
          changePlan: {
            summary: '在 App.vue 按项目现有 API 层接入 /api/setup',
            targets: [{ file: 'src/App.vue', anchor: 'onMounted', line: 0, whatToChange: '挂载时调用 /api/setup 初始化接口', why: '默认请求初始化接口' }],
            affected: [],
            reusePatterns: ['复用项目现有 API 层封装'],
            risks: [],
            verification: ['构建通过'],
            openQuestions: ['接口方法与响应结构仍需确认'],
          },
          confirmedFacts: ['项目通过 API 模块调用统一 HTTP 实例'],
          assumptions: ['接口方法与响应结构仍需确认'],
          usedExperienceIds: [],
          candidateExperience: null,
        });
      },
    });
    assert.match(result.enhancedPrompt, /API 层/);
    assert.ok(result.changePlan.targets.length >= 1);
    assert.equal(result.changePlan.targets[0].file, 'src/App.vue');
    assert.equal(result.savedExperience, null);
    assert.equal(loadExperienceMetas(project).length, 0);

    const tableExperience = await enhanceLocatedPrompt({
      project,
      body: {
        pagePath: '/order',
        searchPayload: {
          url: 'http://localhost/order',
          userPrompt: '新增一个表格',
          selectionInstructions: [],
        },
      },
      modelItems: [{
        file: 'src/views/order/index.vue',
        locateLevel: 'direction',
        codeSnippet: '<md-table :columns="columns" :data="data" />',
        directionGuess: '按项目表格模式新增',
        prompt: '粗提示词',
        confidence: 80,
      }],
      log: message => logs.push(message),
      invoke: async (stage, prompt) => {
        if (stage === 'experience-match') {
          return JSON.stringify({
            matchedExperienceIds: [],
            missingFacts: [],
            requests: [],
            discoveryNeeded: true,
            domain: 'table-pattern',
          });
        }
        if (stage === 'experience-discovery-plan') {
          return JSON.stringify({
            domain: 'table-pattern',
            objective: '发现表格实现模式',
            requests: [{
              id: 'table-frequency',
              operation: 'find_related_examples',
              scope: { roots: ['src'] },
              terms: ['useTable', 'MdTable', 'md-table'],
              maxResults: 10,
              maxLinesPerResult: 24,
              reason: '统计表格实现频次',
            }],
          });
        }
        assert.notEqual(stage, 'legacy-evaluation');
        if (stage === 'experience-candidate') {
          assert.match(prompt, /src\/components\/md-table\/hooks\/useTable\.ts/);
          assert.match(prompt, /src\/components\/md-table\/index\.vue/);
          assert.match(prompt, /src\/views\/order\/index\.vue/);
          return JSON.stringify({
            shouldSave: true,
            reason: 'MdTable 与 useTable 来源清晰，且多个业务页面按同一模式实现表格。',
            candidateExperience: {
              id: 'experience:mdtable-usetable',
              name: 'MdTable + useTable 表格实现规范',
              triggerTags: ['MdTable', 'useTable', 'md-table', '表格', '列表'],
              applicableWhen: ['新增或修改业务列表表格', '目标文件已使用 MdTable 或 useTable'],
              notApplicableWhen: ['目标文件没有使用该表格体系', '需求明确要求原生组件或第三方表格'],
              context: [
                '## 适用场景',
                '业务页面需要新增或修改列表表格，并且目标文件已经使用 MdTable / useTable。',
                '## 标准用法',
                "从 '@/components' 或 '@/components/md-table' 引入 MdTable；从 '@/components/md-table/hooks/useTable' 引入 useTable。",
                '使用 useTable({ api, params }) 管理 data、loading、pagination、paginationChange 等表格状态。',
                '模板使用 <md-table :columns="columns" :data="data" :loading="loading" :pagination="pagination" @update:pagination="paginationChange" />。',
                '## 注意事项',
                '新增接口应放在当前业务目录的 api.ts，并复用项目已有 http.request 封装。',
              ].join('\n'),
              requiredEvidence: [
                { path: 'src/components/md-table/hooks/useTable.ts', purpose: '公共表格状态 hook' },
                { path: 'src/components/md-table/index.vue', purpose: '公共 MdTable 组件' },
              ],
              examples: [
                { path: 'src/views/order/index.vue', purpose: '当前业务表格用法' },
                { path: 'src/views/goods/index.vue', purpose: '另一个业务表格用法' },
              ],
              recipes: [{
                title: '新增分页业务表格',
                when: '目标页面已有 MdTable/useTable 或同类列表页结构',
                steps: [
                  '从项目组件入口导入 MdTable，从 md-table hooks 导入 useTable。',
                  '在当前业务目录 api.ts 增加列表接口函数。',
                  '定义 columns，并通过 useTable({ api, params }) 接管数据、分页和 loading。',
                  '模板中绑定 columns、data、loading、pagination，并把分页事件接到 paginationChange。',
                ],
                code: "const { data, loading, pagination, paginationChange, getData } = useTable({ api: getListApi, params: () => ({ ...filter }) })",
              }],
              sourceContracts: [{
                name: 'MdTable',
                importFrom: '@/components',
                usage: '<md-table :columns="columns" :data="data" :loading="loading" :pagination="pagination" @update:pagination="paginationChange" />',
              }, {
                name: 'useTable',
                importFrom: '@/components/md-table/hooks/useTable',
                usage: 'useTable({ api, params }) 返回 data/loading/pagination/paginationChange/getData 等表格状态与动作。',
              }],
              verificationChecklist: [
                '确认目标文件实际导入路径与当前项目一致。',
                '确认接口函数位于当前业务目录或项目既有 api 模块。',
                '确认 columns、rowKey、分页字段与后端响应结构匹配。',
              ],
              confidence: 'medium',
            },
          });
        }
        return JSON.stringify({
          changePlan: {
            summary: '复用 MdTable + useTable 新增业务表格',
            targets: [{ file: 'src/views/order/index.vue', anchor: 'MdTable', line: 0, whatToChange: '按 useTable 模式新增分页表格', why: '需求新增表格' }],
            affected: [],
            reusePatterns: ['复用 MdTable + useTable 公共表格模式'],
            risks: [],
            verification: [],
            openQuestions: [],
          },
          confirmedFacts: ['MdTable + useTable 是高频公共模式'],
          assumptions: [],
          usedExperienceIds: [],
          candidateExperience: null,
        });
      },
    });
    assert.equal(tableExperience.savedExperience.saved, true, tableExperience.savedExperience.reason);
    assert.equal(loadExperienceMetas(project).length, 1);
    assert.deepEqual(loadExperienceMetas(project)[0].triggerTags, ['MdTable', 'useTable', 'md-table', '表格', '列表']);
    const experienceDirectory = path.join(root, '.magnus', 'experiences', 'mdtable-usetable');
    assert.equal(fs.existsSync(path.join(experienceDirectory, 'recipes.json')), true);
    assert.equal(fs.existsSync(path.join(experienceDirectory, 'source-contracts.json')), true);
    assert.equal(fs.existsSync(path.join(experienceDirectory, 'checklist.json')), true);
    assert.equal(fs.existsSync(path.join(experienceDirectory, 'provenance.json')), true);
    assert.equal(fs.existsSync(path.join(experienceDirectory, 'examples.json')), false);
    assert.equal(fs.existsSync(path.join(experienceDirectory, 'evidence.json')), false);
    assert.equal(fs.existsSync(path.join(root, '.magnus', 'skills')), false);
    const contexts = loadExperienceContexts(project, ['experience:mdtable-usetable']);
    assert.equal(contexts.length, 1);
    assert.equal(Array.isArray(contexts[0].recipes), true);
    assert.equal(Array.isArray(contexts[0].sourceContracts), true);
    assert.equal(Array.isArray(contexts[0].verificationChecklist), true);
    assert.equal(contexts[0].examples, undefined);
    assert.equal(contexts[0].evidence, undefined);

    const memory = memorySnapshot(project);
    assert.equal(memory.experiences.length, 1);
    assert.ok(memory.taskSessions.some(session => session.pageKey === '/order'));
    const orderSession = memory.taskSessions.find(session => session.pageKey === '/order');
    const updatedSession = updateTaskSessionMemory(project, orderSession.id, {
      requirements: ['新增订单表格', '增加执行时间列'],
      confirmedFacts: ['订单列表使用 MdTable'],
    });
    assert.deepEqual(updatedSession.requirements, ['新增订单表格', '增加执行时间列']);
    assert.deepEqual(updatedSession.confirmedFacts, ['订单列表使用 MdTable']);

    const updatedExperience = updateStoredExperience(project, {
      id: 'experience:mdtable-usetable',
      name: '项目表格实现规范',
      status: 'active',
      confidence: 'high',
      context: `${contexts[0].context}\n\n编辑后的补充约束。`,
    });
    assert.equal(updatedExperience.meta.name, '项目表格实现规范');
    assert.equal(updatedExperience.meta.status, 'active');
    assert.match(updatedExperience.context, /编辑后的补充约束/);
    assert.match(
      fs.readFileSync(path.join(root, '.magnus', 'Project.md'), 'utf8'),
      /项目表格实现规范/
    );
    assert.equal(removeTaskSessionMemory(project, orderSession.id), true);
    assert.equal(memorySnapshot(project).taskSessions.some(session => session.id === orderSession.id), false);

    const rescanned = scanProject(root);
    assert.equal(rescanned.files.some(file => file.path.startsWith('.magnus/')), false);
    assert.ok(logs.some(log => log.includes('候选经验已保存')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().then(() => {
  console.log('experience tests passed');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});

(function changePlanHelperChecks() {
  const { normalizeChangePlan, changePlanToText, changePlanMatchesRoughSource } = require('./prompt-enhancer');

  // normalize: 缺字段/脏类型 → 结构齐备
  const plan = normalizeChangePlan({
    summary: '  改成本单元格  ',
    targets: [{ file: 'src/columns.tsx', anchor: '点击设置', line: '15', whatToChange: '改文案', why: '需求' }, { file: '' }],
    affected: [{ file: 'src/types.ts', reason: '类型' }, {}],
    reusePatterns: ['复用 useTable', ''],
    risks: [], verification: ['构建通过'], openQuestions: [],
  });
  assert.equal(plan.summary, '改成本单元格');
  assert.equal(plan.targets.length, 1);
  assert.equal(plan.targets[0].line, 15);
  assert.equal(plan.affected.length, 1);
  assert.deepEqual(plan.reusePatterns, ['复用 useTable']);

  // 派生文本包含关键信息
  const text = changePlanToText(plan, { userRequirement: 'x' });
  assert.match(text, /修改计划/);
  assert.match(text, /src\/columns\.tsx:15/);
  assert.match(text, /点击设置/);

  // 护栏：粗定位源码有 ≥3 锚点时，计划必须引用其中 ≥2，否则视为跑偏
  const task = { targets: [{ file: 'src/columns.tsx', codeSnippet: 'renderCostCell useTable NButton clickSetup' }] };
  const good = normalizeChangePlan({ summary: '', targets: [{ file: 'src/columns.tsx', whatToChange: '在 renderCostCell 用 useTable 调整 NButton' }] });
  const bad = normalizeChangePlan({ summary: '', targets: [{ file: 'src/other.vue', whatToChange: '改了别的无关内容' }] });
  assert.equal(changePlanMatchesRoughSource(task, good), true);
  assert.equal(changePlanMatchesRoughSource(task, bad), false);
  console.log('changePlan helper checks passed');
})();

(function trimDiscoveryChecks() {
  const { trimDiscoveryForPlan } = require('./prompt-enhancer');
  const discovery = { plan: {}, results: {
    r1: { operation: 'read_file', matches: [{ path: 'src/target.vue', snippet: 'x'.repeat(3000) }] },
    r2: { operation: 'search_text', matches: [{ path: 'src/target.vue' }, { path: 'src/a.ts', snippet: 'aa' }] },
    r3: { operation: 'find_related_examples', stats: { matchedFiles: 81 }, matches: [{ path: 'src/b.vue' }, { path: 'src/c.vue' }] },
    r4: { operation: 'find_imports', matches: [{ path: 'src/a.ts', snippet: 'dup' }, { path: 'src/d.ts', snippet: 'dd' }] },
  } };
  const t = trimDiscoveryForPlan(discovery, ['src/target.vue']);
  const files = Object.values(t.results).flatMap(r => r.matches.map(m => m.path));
  assert.deepEqual(files.sort(), ['src/a.ts', 'src/d.ts']);   // 目标去重、过泛略去、跨请求去重
  assert.equal(t.results.r1.matches.length, 0);
  assert.equal(t.results.r3.trimmed, 'too-generic');
  assert.ok(t.results.r2.matches.find(m => m.path === 'src/a.ts'));
  console.log('trimDiscoveryForPlan checks passed');
})();

(function roughTaskOriginSelectionCheck() {
  const { roughTask, buildChangePlanPrompt } = require('./prompt-enhancer');
  // 扩区后 selectionInstructions 只剩「删除选区」；但 body.originSelections 保住了扩区前的原始选区 ¥3。
  const body = {
    searchPayload: { url: 'http://x', userPrompt: '@选区1 删除选区', selectionInstructions: [{ index: 1, instruction: '删除选区' }] },
    originSelections: [{ token: '@选区1', tag: 'div', text: '¥3', className: '', attrs: { style: 'color: rgb(153, 153, 153)' }, ancestors: 'td[data-col-key=cost] > div', summary: '¥3' }],
  };
  const task = roughTask(body, [{ file: 'src/index.vue', codeSnippet: 'region', scopeAlignment: 'approximate' }]);
  assert.equal(task.selections[0].text, '¥3');                       // 原始选区优先于指令文本
  assert.equal(task.selections[0].ancestors, 'td[data-col-key=cost] > div');
  const prompt = buildChangePlanPrompt({ roughTask: task, targetFiles: [], discovery: {}, matchedExperiences: [] });
  assert.ok(prompt.includes('¥3'));                                  // 变更计划 LLM 能看到用户到底选了什么
  assert.ok(prompt.includes('data-col-key=cost'));
  // 没有 originSelections 时退回指令文本，不报错
  const fallback = roughTask({ searchPayload: { selectionInstructions: [{ index: 1, instruction: 'x' }] } }, []);
  assert.equal(fallback.selections[0].instruction, 'x');
  console.log('roughTask origin-selection checks passed');
})();
