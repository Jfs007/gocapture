# Magnus Side Panel Rewrite Architecture

本文档是 `vue/src/sites/magnus` 的重写边界。后续实现以这里为准，不再把旧 `ctx/useForm/useApi`、巨型 hook、长参数链作为主架构。

## 1. 产品功能清单

Magnus 是一个运行在 Chrome Side Panel iframe 内的本地开发辅助应用。它必须保留以下能力：

- 连接当前浏览器 Tab，并通过 `package/app/magnus/sfr-runtime.js` 操作真实页面。
- 页面侧支持鼠标悬浮选区、空格确认、多选区保存、选区截图、扩区、高亮预览、删除选区。
- Side Panel 展示选区资产卡片、缩略图、节点详情，并支持输入框 `@选区N` 引用。
- 关联本地源码项目，恢复历史项目，展示 source-server 状态。
- 解析当前页面路由，显示页面源码地址，支持 hash 路由和大小写宽松匹配。
- 捕获页面请求作为接口线索，过滤 Magnus 自身本地请求。
- 发送用户需求后，先本地检索候选源码，再调用模型做粗加工定位。
- 模型支持不启用、API 模型、Cli 模型；DeepSeek API 配置、代理、模型选择和选择结果要持久化。
- 模型定位要实时展示日志，支持停止；最终提示词要带页面、文件、源码方向、推测方向、需求和执行兜底准则。
- 聊天区展示系统消息、检索日志、模型日志、工作时长和最终提示词。

## 2. 运行边界

```txt
Chrome Side Panel
  -> package/sidepanel.html
  -> package/js/sidepanel.js
  -> source-server /ui
  -> package/app/magnus/index.js
  -> vue/src/sites/magnus/main.ts
  -> App.vue
  -> views/MagnusPanel.vue
```

业务页面 DOM 不属于 Side Panel UI。

```txt
package/js/sidepanel.js
  -> chrome.runtime.sendMessage({ cmd: "install" })
  -> package/js/service-worker.js
  -> package/app/magnus/sfr-runtime.js
```

`sfr-runtime.js` 持有真实 DOM 引用。Side Panel 只保存结构化选区对象、选区 id 和缩略图；扩区、预览、高亮、截图都通过 bridge 命令回到 runtime 执行。

## 3. 新架构分层

```txt
components
  只渲染 UI，读取 Pinia stores，调用 commands

stores
  单一状态中心，按业务域拆分

app/runtime
  应用启动、模块装配、commands provide、store 同步、runtime API

app/modules
  源码项目、路由、请求、选区、输入、搜索、模型、消息等业务模块

app/workflows
  发送 -> 本地检索 -> 模型定位 -> 最终提示词的跨模块流程

app/services
  source-server API、项目扫描等本地服务适配

app/prompt / app/model / app/presenters
  提示词构造、模型适配、展示文本格式化

app/types
  应用类型定义
```

允许的依赖方向：

```txt
components -> stores + app/runtime/commands
app/runtime -> app/modules + app/workflows + stores
app/modules -> app/services + app/prompt + app/model + core
stores -> app/types
```

禁止方向：

- 组件 import `core/ctx`。
- 组件 import 旧 hook 模块。
- 单个 hook 平铺十几个 `ref` 后再传给其他 hook。
- workflow 通过长参数列表互相传递状态。
- `App.vue` 或 `MagnusPanel.vue` 写检索、模型、请求、选区业务逻辑。

## 4. Store 职责

- `project.store.ts`：源码项目、source-server 状态。
- `route.store.ts`：当前页面 URL/path、路由解析结果。
- `selection.store.ts`：选区资产、选区确认状态、`promptAssets`。
- `request.store.ts`：页面请求缓存、接口线索开关。
- `search.store.ts`：候选文件、候选选择、检索日志状态、接口/i18n/定义追踪。
- `model.store.ts`：模型配置、当前模型、模型编辑器、运行状态、日志、结果。
- `composer.store.ts`：输入框内容、最终提示词、发送状态。
- `chat.store.ts`：聊天消息。
- `app-ui.store.ts`：toast、runtime 连接态等 UI 全局状态。

组件只能从这些 store 读取状态，不再通过 `useForm('xxx')` 读散乱字段。

## 5. Commands 职责

`app/runtime/commands.ts` 是组件唯一调用入口。

命令按用户动作命名：

- `selectProject`
- `sendRequest`
- `copyPrompt`
- `copyText`
- `openSourceFile`
- `previewSelection`
- `restoreSelectionPreview`
- `expandSelection`
- `removeSelection`
- `clearSelections`
- `toggleCandidateFile`
- `toggleCandidateDetail`
- `setIncludeApiEvidence`
- `openModelEditor`
- `saveModelForm`
- `stopModelAssist`

组件不关心这些命令背后调用 API、bridge、storage 还是模型。

## 6. 迁移规则

当前仍存在部分动态适配器文件，它们已经迁入 app 层，只允许作为待继续类型化的底层能力：

- `app/prompt/search-prompt.ts`
- `app/model/model-adapters.ts`
- `app/runtime/create-modules.ts`
- `app/runtime/store-sync.ts`

重写期间必须遵守：

- 旧模块可以被 app 层临时调用，但不得被组件直接 import。
- 新组件必须走 Pinia stores + commands。
- 每替换一个旧模块，都要用 store/usecase/service 承接完整功能后再移除旧文件。
- 不允许只把 `.js` 改成 `.ts` 就算重构。

## 7. 当前 UI 主链路

```txt
main.ts
  -> createMagnusBootstrap()
  -> Pinia stores
  -> App.vue
  -> MagnusPanel.vue
  -> createMagnusRuntime(api)
       -> app runtime lifecycle
       -> bridge connect
       -> source project restore
       -> route resolve
       -> commands provide

components/*
  -> Pinia stores
  -> useMagnusCommands()
```

旧 `core/ctx.js` 和 `hooks/use-magnus-ctx.ts` 已移除。组件不得恢复 `useForm/useApi` 模式。

## 8. 重写完成标准

- `App.vue` 保持入口壳层，不超过 300 行。
- `MagnusPanel.vue` 只负责页面布局和挂载应用生命周期。
- `components` 下没有 `useForm/useApi/core/ctx`。
- 选区、项目、路由、请求、搜索、模型、聊天、输入框分别有清晰 store。
- 跨模块行为放在 usecase/service，不通过长参数链拼接。
- 构建产物仍输出到 `package/app/magnus/index.js`。
- `npm run app:inspector:build` 必须通过。
