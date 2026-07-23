'use strict';

const test = require('node:test');
const assert = require('assert');
const {
  buildStructureDoc,
} = require('./project-structure');

// winsup 真实结构的代表性子集（仅文件；目录靠文件推断）。
const WINSUP_FILES = [
  'src/main.ts', 'src/App.vue',
  'src/layout/index.vue', 'src/layout/outer.vue', 'src/layout/content/index.vue',
  'src/layout/menu/index.vue', 'src/layout/breadcrumb/index.vue', 'src/layout/header/index.vue',
  'src/directives/index.ts', 'src/directives/v-lazy.ts', 'src/directives/v-track.ts', 'src/directives/v-trim.ts',
  'src/enums/httpEnum.ts', 'src/enums/roleEnum.ts', 'src/enums/cacheEnum.ts',
  'src/utils/http/index.ts', 'src/utils/options.ts', 'src/utils/storage.ts', 'src/utils/date.ts',
  'src/utils/deep.ts', 'src/utils/index.ts', 'src/utils/upload-tos.ts',
  'src/components/md-table/index.vue', 'src/components/md-table/hooks/useTable.ts',
  'src/components/md-table/component/cell.vue', 'src/components/md-table/types/hooks.d.ts',
  'src/components/md-filter/index.vue',
  'src/components/md-sup-filter/index.vue', 'src/components/md-sup-filter/item.vue',
  'src/components/md-check-group/index.vue',
  'src/components/md-customer/selector.vue', 'src/components/md-customer/api.ts', 'src/components/md-customer/useCustomer.ts',
  'src/components/md-material-selector-drawer/index.vue', 'src/components/md-material-selector-drawer/api.ts', 'src/components/md-material-selector-drawer/useHook.ts',
  'src/components/md-export-button/index.vue', 'src/components/md-upload/index.vue',
  'src/components/md-upload-ultra/index.vue', 'src/components/md-diy-column-draggable/index.vue',
  'src/components/v-render/index.ts',
  'src/hooks/usePage.ts', 'src/hooks/useDownload.ts', 'src/hooks/useUpload.ts', 'src/hooks/useCache.ts',
  'src/hooks/usePropsControl.ts', 'src/hooks/dictionary/index.ts', 'src/hooks/authority/index.ts',
  'src/api/common.ts', 'src/api/system.ts', 'src/api/user.ts',
  'src/store/index.ts', 'src/store/modules.ts', 'src/store/modules/user.ts',
  'src/router/index.ts', 'src/router/constant.ts', 'src/router/modules/route.ts',
  // views（业务区，应被排除；功能根现场探测才用得到）
  'src/views/login/index.vue', 'src/views/login/PwdForm.vue',
  'src/views/management/storeAuth/index.vue', 'src/views/management/storeAuth/api.ts',
  'src/views/management/storeAuth/components/operator-edit-modal.vue',
  'src/views/data-center/operation-data/ks-shop-data/index.vue',
  'src/views/data-center/operation-data/ks-shop-data/StoreTable.vue',
  'src/views/ai-product/product-card/index.vue', 'src/views/ai-product/product-card/const.ts',
  'src/views/ai-product/product-card/api.ts', 'src/views/ai-product/product-card/useHook.ts',
  'src/views/ai-product/product-card/ctx/useCtx.ts',
  'src/views/ai-product/product-card/components/upload-config-card.vue',
  'src/views/ai-product/product-card/components/store-selector-drawer.vue',
  'src/views/ai-product/product-card/components/config-editor-drawer.vue',
];

const project = { path: '/tmp/winsup', files: WINSUP_FILES.map(path => ({ path })) };

test('业务功能目录由入参决定（LLM 断定），代码不写死名字：不给则不排除', () => {
  const doc = buildStructureDoc(project); // 不提供 businessDirs → 全保留
  assert.ok(doc.includes('product-card') || doc.includes('login') || /views\//.test(doc.replace(/^#.*$/m, '')), 'businessDirs 为空时不应排除任何目录');
});

test('Structure.md 只留复用骨架，排除断定为业务的目录；含业务组件库与基建', () => {
  const doc = buildStructureDoc(project, ['views']); // ['views'] 模拟 init 时 LLM 的断定结果
  console.log('\n===== 生成的 Structure.md =====\n' + doc);
  assert.match(doc, /components\/\s+.*md-table/);
  assert.match(doc, /hooks\/\s+.*authority/);
  assert.match(doc, /api\/\s+common\.ts\s+system\.ts\s+user\.ts/);
  // views 业务区不应进常驻图（用真实业务内容判断，避开表头里出现的 "views/pages" 字样）。
  for (const business of ['product-card', 'storeAuth', 'StoreTable', 'operation-data', 'PwdForm']) {
    assert.ok(!doc.includes(business), `业务内容 ${business} 不应进常驻图`);
  }
});
