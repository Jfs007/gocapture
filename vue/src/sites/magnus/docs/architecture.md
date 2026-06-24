# Magnus Frontend Architecture

本文档描述 `vue/src/sites/magnus` 当前前端结构、模块职责和运行链路。后续改动应优先遵守这里的边界，避免把业务逻辑重新堆回 `App.vue` 或单个大 hook。

## 1. 当前定位

Magnus 前端现在运行在 Chrome Side Panel 的 iframe 中，不再作为业务页面内的浮层 UI 注入。

业务页面侧职责由 `package/app/magnus/sfr-runtime.js` 承担：

- 鼠标悬浮选区
- 空格确认选区
- 页面选区高亮
- 选区截图
- 选区扩区
- 真实 DOM 引用维护
- 页面 URL 变化监听
- 接口请求监听

Side Panel UI 职责由 `vue/src/sites/magnus` 承担：

- 展示选区资产
- 管理输入框和 `@选区`
- 管理源码项目
- 发起本地检索
- 发起模型定位
- 展示日志、候选文件和最终提示词

Side Panel UI 和业务页面 runtime 通过 source-server 的 WebSocket bridge 通信。

## 2. 启动链路

```txt
Chrome Side Panel
  -> package/sidepanel.html
  -> package/js/sidepanel.js
  -> source-server /ui
  -> package/app/magnus/index.js
  -> vue/src/sites/magnus/main.ts
  -> App.vue
  -> views/MagnusPanel.vue
  -> useMagnusApp(api)
```

业务页面 runtime 注入链路：

```txt
package/js/sidepanel.js
  -> chrome.runtime.sendMessage({ cmd: "install" })
  -> package/js/service-worker.js
  -> package/app/magnus/sfr-runtime.js
```

## 3. 入口职责

### `main.ts`

`main.ts` 只负责 Side Panel iframe 内的 Vue 挂载：

- 读取 `window.__MAGNUS_SIDE_PANEL__`
- 注入 `styles/style.css`
- 创建 `magnus-side-panel-root`
- 创建最小 `api`
- 挂载 `App.vue`
- 重载时销毁旧实例

禁止在 `main.ts` 中恢复以下旧逻辑：

- Shadow DOM 宿主
- 业务页面 fixed 面板
- 页面 overlay
- 页面 DOM 事件监听
- 旧 `element-inspector` 兼容入口

### `App.vue`

`App.vue` 是纯入口壳层，目标是保持极薄。

当前职责：

- 接收 `api`
- 挂载 `views/MagnusPanel.vue`

硬性约束：

- `App.vue` 不应超过 300 行。
- `App.vue` 不写检索、模型、选区、请求、路由等业务逻辑。

### `views/MagnusPanel.vue`

`MagnusPanel.vue` 是 Side Panel 主界面壳层。

当前职责：

- 渲染 `.mda-root`
- 渲染 `.mda-panel`
- 展示 logo 和当前页面 host
- 挂载源码目录选择 input
- 挂载 `ChatThread`
- 挂载 `ComposerPanel`
- 调用 `useMagnusApp(props.api)`

它不应该承载检索、模型、选区、请求、路由等业务流程。

## 4. 应用装配层

### `hooks/use-magnus-app.js`

这是应用级生命周期装配层。

它负责：

- 创建页面级响应式上下文
- 调用 `createMagnusModules`
- 调用 `createMagnusActions`
- 调用 `provideMagnusRuntime`
- 注册 source project 恢复
- 注册 route resolve 触发
- 注册生命周期
- 连接 / 断开 side panel bridge

它不应该：

- 平铺大量 `ref`
- 直接写 UI 组件细节
- 直接承载选区状态、模型状态、检索状态
- 直接监听业务页面 DOM 事件
- 直接实现检索、模型定位、复制、打开文件等动作

当前模块装配关系：

```txt
useMagnusApp
  -> createMagnusModules
  -> syncLegacyStateToStores
  -> createMagnusActions
  -> provideMagnusRuntime
  -> registerRuntimeApi
  -> installLocationWatcher
```

### `app/create-magnus-modules.js`

负责创建和接线领域模块：

- `useSourceProject`
- `useRouteResolver`
- `usePageRequests`
- `useSelectionModule`
- `useComposerModule`
- `useSearchState`
- `usePromptModule`
- `useModelModule`
- `useMessageModule`
- `useSidePanelBridge`

这里允许处理模块之间的依赖关系，但不写 UI 交互细节，也不实现发送 workflow。

### `app/legacy-actions.js`

负责把旧 ctx 组件需要的动作集中起来：

- 选择源码目录
- 选区预览/删除/清空/扩区
- 输入框 token 插入
- 候选文件选择/展开
- 接口线索开关
- 模型配置动作
- 打开源码文件
- 复制文本

这是旧组件迁移期的动作适配层。新组件优先使用更明确的 commands/store，不继续扩散 `useApi()`。

### `app/workflows/composer-workflow.js`

负责“发送 -> 本地检索 -> 模型定位 -> 生成提示词”的跨模块流程：

- `sendComposer`
- `searchCandidateFiles`
- `runModelAssistForCandidates`
- 检索重试判断
- 模型定位可用性判断

该文件是 workflow 层，不应出现组件状态或 DOM 逻辑。

### `app/provide-magnus-runtime.js`

负责把模块和动作发布给组件：

- 兼容旧 `useForm/useApi`
- 提供新 `useMagnusCommands`

## 5. Context 中心

### `core/ctx.js`

提供基础注入能力：

- `useCtx`
- `useForm`
- `useApi`
- `useParams`

内部使用 `shallowRef(ctxValue || {})`，避免 Vue 深层解包 ref/computed。

### `hooks/use-magnus-ctx.js`

负责把领域模块映射成组件可消费的 ctx。

组件不应该直接 import 领域模块。组件应该通过：

- `useForm`
- `useApi`

读取状态或调用操作。

### `app/MagnusAppProvider.ts`

提供逐步迁移用的命令中心：

- `sendRequest`
- `resolveRoute`
- `selectProject`
- `openSourceFile`
- `copyPrompt`
- `expandSelection`
- `removeSelection`
- `clearSelections`

新组件优先通过 `useMagnusCommands()` 调用跨模块操作，减少对旧 `useApi()` 的依赖。

### `stores/*`

Pinia stores 是新的状态中心，用于承接逐步迁移后的状态：

- `chat.store.ts`
- `composer.store.ts`
- `project.store.ts`
- `search.store.ts`
- `model.store.ts`
- `selection.store.ts`
- `route.store.ts`
- `request.store.ts`
- `app-ui.store.ts`

迁移期间，`app/legacy-state-sync.js` 会把旧 hook 的状态同步到 store，保证组件可以分批迁移而不丢功能。

## 6. 领域模块

### 6.1 选区模块

文件：`hooks/modules/use-selection-module.js`

职责：

- 管理选区资产
- 管理选区确认状态
- 管理选区相关自定义证据
- 生成 `selectionPayloads`
- 接收 runtime 传来的远程选区
- 发送选区高亮、扩区、删除、清空命令

重要约束：

- UI 不持有真实 DOM。
- 真实 DOM 只存在于 `sfr-runtime.js`。
- UI 只持有 uid、结构化信息、缩略图和证据。

### 6.2 输入框模块

文件：`hooks/modules/use-composer-module.js`

职责：

- 管理输入框内容
- 管理最终提示词文本
- 管理 `@选区` 插入
- 管理输入框可编辑状态
- 管理发送按钮可用状态

发送流程不放在这里，因为发送需要串联 selection、search、model、prompt。

### 6.3 检索状态模块

文件：`hooks/modules/use-search-state.js`

职责：

- 管理候选文件状态
- 管理检索 loading/error
- 管理检索耗时
- 管理 trace：
  - api trace
  - i18n trace
  - definition trace
- 管理候选文件选择
- 管理是否需要更多证据
- 管理是否展示候选确认

它只管理状态，不直接调用 `/api/search`。

### 6.4 Prompt 模块

文件：`hooks/modules/use-prompt-module.js`

包装 `hooks/use-search-prompt.js`。

职责：

- 构建 `/api/search` payload
- 生成检索日志
- 生成最终提示词
- 组织选区、路由、接口、i18n、definition、候选文件和用户需求

### 6.5 模型模块

文件：`hooks/modules/use-model-module.js`

包装 `hooks/use-model-adapters.js`。

职责：

- 管理模型配置
- 管理模型选择
- 管理模型表单
- 管理模型运行状态
- 管理模型日志
- 运行模型定位
- 停止模型定位

模型定位的目标不是必须给出唯一精确源码，而是对本地预检索结果做粗加工：

- 能确定具体修改点时返回 `exact`
- 不能确定具体修改点但方向可信时返回 `direction`
- 完全无法判断时返回空结果

### 6.6 消息模块

文件：`hooks/modules/use-message-module.js`

包装 `hooks/use-chat-messages.js`。

职责：

- 生成 `ChatThread` 展示用消息
- 汇总项目状态、选区状态、检索状态、模型状态、日志和最终提示词

### 6.7 路由模块

文件：`hooks/use-route-resolver.js`

职责：

- 维护 `routeResolverTrace`
- 根据当前 URL 调 `/api/route/resolve`
- 支持 hash 路由
- 合并 route trace
- 清理 route resolve timer

它只做页面路径到源码入口的解析，不做全文检索。

### 6.8 请求模块

文件：`hooks/use-page-requests.js`

职责：

- 维护最近接口请求
- 提供接口线索给检索
- 提供 `denoiseTextByApi` 降噪

接口请求来源：

```txt
sfr-runtime.js
  -> network.request
  -> bridge
  -> use-side-panel-bridge.js
  -> usePageRequests.rememberRequest
```

UI 不再直接监听 `window.__WEB_REQUEST_API__`。

### 6.9 源码项目模块

文件：`hooks/use-source-project.js`

职责：

- 管理源码项目选择
- 管理源码服务状态
- 保存和恢复 host 对应的项目路径
- 处理目录选择 input

## 7. Side Panel Bridge

文件：`hooks/use-side-panel-bridge.js`

职责：

- 连接 source-server bridge WebSocket
- 绑定当前 page session
- 接收 runtime 事件
- 发送 runtime command

接收事件：

- `selection.changed`
- `page.route_changed`
- `runtime.connected`
- `network.request`

发送命令：

- `picker.start`
- `picker.stop`
- `selection.highlight`
- `selection.expand`
- `selection.remove`
- `selection.clear`

## 8. 组件层

### `components/chat/ChatThread.vue`

职责：

- 展示系统消息
- 展示模型消息
- 展示候选文件
- 展示检索日志
- 展示模型日志
- 展示最终提示词
- 支持候选文件选择、展开、复制、打开源码

数据来源：

- Pinia stores
- `useMagnusCommands`

### `components/composer/ComposerPanel.vue`

职责：

- 组合 Composer 区域子组件
- 发送 / 停止
- 源码项目展示

数据来源：

- `useForm`
- `useApi`

子组件边界：

- `CandidateOptions.vue`：候选文件确认、候选详情展开、线索不足提示。
- `ComposerInput.vue`：textarea、自适应高度、`@选区` 快捷菜单、键盘选择、按光标插入 token。
- `ComposerPrebar.vue`：接口线索开关、选区资产缩略图、资产删除、资产详情 popover、页面选区预览。
- `ModelEditorPanel.vue`：模型适配器表单、DeepSeek/API/Cli 配置。
- `ModelMenu.vue`：模型选择菜单、禁用模型、新增/编辑模型入口。

`ComposerPanel.vue` 应保持编排职责，不再承载子组件内部交互状态。

## 9. 主流程

```txt
1. 用户打开 Side Panel
2. sidepanel.js 绑定当前 Tab
3. service-worker 注入 sfr-runtime.js
4. /ui 加载 Magnus Vue UI
5. UI 连接 bridge
6. runtime 连接 bridge
7. bridge 绑定 side iframe 和 page runtime
8. 用户在业务页面选择节点
9. runtime 生成选区对象和缩略图
10. runtime 发送 selection.changed
11. UI 保存选区资产
12. 用户输入 @选区 + 修改要求
13. UI 发起 /api/search
14. source-server 本地检索候选文件
15. UI 自动触发模型定位
16. 模型返回 exact 或 direction
17. UI 生成最终提示词
18. ChatThread 展示结果和日志
```

## 10. 已删除的旧逻辑

以下逻辑已经从 `vue/src/sites/magnus` 删除，禁止恢复到 UI 前端：

- 页面内 Shadow DOM 面板
- 页面内 overlay 高亮
- 页面内 badge
- 页面内鼠标移动选区
- 页面内键盘空格确认
- 页面内截图裁剪
- 页面内 `window.__WEB_REQUEST_API__` 监听
- 拖拽调整助手宽度
- 折叠面板
- 关闭浮层按钮
- `isSidePanel` 分支
- `.mda-root.is-side-panel`
- `.mda-panel.is-side-panel`
- `.mda-resizer`
- `.mda-overlay`
- `.mda-badge`
- `.mda-hotkey-tip`
- `.is-collapsed`
- `.is-resizing`

这些能力属于 `sfr-runtime.js` 或 Chrome Side Panel，不属于 UI iframe。

## 11. 后续重构约束

1. `App.vue` 不超过 300 行。
2. `main.ts` 只做挂载，不写业务逻辑。
3. `useMagnusApp` 只做生命周期装配，不写 workflow。
4. 单个领域模块只管理自己的状态和行为。
5. 旧组件可通过 ctx 消费状态和操作；新组件优先通过 Pinia store 和 `useMagnusCommands`。
6. 不为了单一业务页面写死规则。
7. runtime 负责真实 DOM；UI 只处理结构化选区资产。
8. 新增能力优先判断属于：
   - runtime
   - source-server
   - UI module
   - UI component
9. 新增状态优先进入对应 module，不要直接堆到 `useMagnusApp`。
10. 新增组件交互优先进入组件自己的子组件或 commands，不跨层互相 import。

## 12. TypeScript 迁移建议

当前代码仍为 JS，但模块边界已经适合逐步迁移 TS。

建议顺序：

1. 定义 bridge event 类型。
2. 定义 selection asset 类型。
3. 迁移 `use-selection-module`。
4. 迁移 `use-composer-module`。
5. 迁移 `use-search-state`。
6. 迁移 `use-side-panel-bridge`。
7. 迁移 `use-model-adapters`。
8. 迁移 `use-search-prompt`。

不要先整体改 TS；先从边界清晰的小模块开始。
