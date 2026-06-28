const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanProject } = require('../core/project');
const { executeDiscoveryPlan } = require('./discovery-executor');
const { enhanceLocatedPrompt } = require('./prompt-enhancer');
const { ensureProjectContext } = require('./project-context');
const { loadSkillContexts, loadSkillMetas } = require('./skill-store');

function write(root, file, content) {
  const absolute = path.join(root, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magnus-experience-'));
  try {
    write(root, 'package.json', JSON.stringify({
      dependencies: { vue: '^3.0.0', axios: '^1.0.0' },
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
    assert.match(context.markdown, /Vue/);
    assert.ok(fs.existsSync(path.join(root, '.magnus-project', 'Project.md')));

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
            expectedSkill: { name: '普通接口接入', triggerTags: ['接口'] },
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
          enhancedPrompt: '任务: 在 App.vue 按项目现有 API 层接入 /api/setup。',
          confirmedFacts: ['项目通过 API 模块调用统一 HTTP 实例'],
          assumptions: ['接口方法与响应结构仍需确认'],
          usedSkillIds: [],
          candidateSkill: null,
        });
      },
    });
    assert.match(result.enhancedPrompt, /API 层/);
    assert.equal(result.savedSkill, null);
    assert.equal(loadSkillMetas(project).length, 0);

    const tableSkill = await enhanceLocatedPrompt({
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
        if (stage === 'skill-match') {
          return JSON.stringify({
            matchedSkillIds: [],
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
        assert.notEqual(stage, 'skill-evaluation');
        if (stage === 'skill-candidate') {
          assert.match(prompt, /src\/components\/md-table\/hooks\/useTable\.ts/);
          assert.match(prompt, /src\/components\/md-table\/index\.vue/);
          assert.match(prompt, /src\/views\/order\/index\.vue/);
          return JSON.stringify({
            shouldSave: true,
            reason: 'MdTable 与 useTable 来源清晰，且多个业务页面按同一模式实现表格。',
            candidateSkill: {
              id: 'skill:mdtable-usetable',
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
          enhancedPrompt: '任务: 复用 MdTable + useTable 新增表格。',
          confirmedFacts: ['MdTable + useTable 是高频公共模式'],
          assumptions: [],
          usedSkillIds: [],
          candidateSkill: null,
        });
      },
    });
    assert.equal(tableSkill.savedSkill.saved, true, tableSkill.savedSkill.reason);
    assert.equal(loadSkillMetas(project).length, 1);
    assert.deepEqual(loadSkillMetas(project)[0].triggerTags, ['MdTable', 'useTable', 'md-table', '表格', '列表']);
    const skillDirectory = path.join(root, '.magnus-project', 'skills', 'mdtable-usetable');
    assert.equal(fs.existsSync(path.join(skillDirectory, 'recipes.json')), true);
    assert.equal(fs.existsSync(path.join(skillDirectory, 'source-contracts.json')), true);
    assert.equal(fs.existsSync(path.join(skillDirectory, 'checklist.json')), true);
    assert.equal(fs.existsSync(path.join(skillDirectory, 'provenance.json')), true);
    assert.equal(fs.existsSync(path.join(skillDirectory, 'examples.json')), false);
    assert.equal(fs.existsSync(path.join(skillDirectory, 'evidence.json')), false);
    const contexts = loadSkillContexts(project, ['skill:mdtable-usetable']);
    assert.equal(contexts.length, 1);
    assert.equal(Array.isArray(contexts[0].recipes), true);
    assert.equal(Array.isArray(contexts[0].sourceContracts), true);
    assert.equal(Array.isArray(contexts[0].verificationChecklist), true);
    assert.equal(contexts[0].examples, undefined);
    assert.equal(contexts[0].evidence, undefined);

    const rescanned = scanProject(root);
    assert.equal(rescanned.files.some(file => file.path.startsWith('.magnus-project/')), false);
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
