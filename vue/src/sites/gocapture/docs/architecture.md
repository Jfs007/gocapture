# GoCapture Side Panel Rewrite Architecture

本文档是 `vue/src/sites/gocapture` 的重写边界。后续实现以这里为准，不再把旧 `ctx/useForm/useApi`、巨型 hook、长参数链作为主架构。

## 1. 产品功能清单

GoCapture 是一个运行在 Chrome Side Panel iframe 内的本地开发辅助应用。它必须保留以下能力：

- 连接当前浏览器 Tab，并通过 `package/app/gocapture/sfr-runtime.js` 操作真实页面。
- 页面侧支持鼠标悬浮选区、空格确认、多选区保存、选区截图、扩区、高亮预览、删除选区。
- Side Panel 展示选区资产卡片、缩略图、节点详情，并支持输入框 `@选区N` 引用。
- 关联本地源码项目，恢复历史项目，展示 source-server 状态。
- 解析当前页面路由，显示页面源码地址，支持 hash 路由和大小写宽松匹配。
- 捕获页面请求作为接口线索，过滤 GoCapture 自身本地请求。
- 发送用户需求后，先本地检索候选源码，再调用模型做粗加工定位。
- 模型支持不启用和 API 模型；DeepSeek API 配置、代理、模型选择和选择结果要持久化。
- 模型定位要实时展示日志，支持停止；最终提示词要带页面、文件、源码方向、推测方向、需求和执行兜底准则。
- 聊天区展示系统消息、检索日志、模型日志、工作时长和最终提示词。

## 2. 运行边界

```txt
Chrome Side Panel
  -> package/sidepanel.html
  -> package/js/sidepanel.js
  -> source-server /ui
  -> package/app/gocapture/index.js
  -> vue/src/sites/gocapture/main.ts
  -> App.vue
  -> views/GoCapturePanel.vue
```

业务页面 DOM 不属于 Side Panel UI。

```txt
package/js/sidepanel.js
  -> chrome.runtime.sendMessage({ cmd: "install" })
  -> package/js/service-worker.js
  -> package/app/gocapture/sfr-runtime.js
```

`sfr-runtime.js` 持有真实 DOM 引用。Side Panel 只保存结构化选区对象、选区 id 和缩略图；扩区、预览、高亮、截图都通过 bridge 命令回到 runtime 执行。

## 3. 新架构分层

```txt
components
  只渲染 UI，读取 Pinia stores，调用 commands

stores
  单一状态中心，按业务域拆分

app/runtime
  应用启动、命令装配、Side Panel bridge、runtime API、store-backed runtime bridge

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
app/runtime -> app/workflows + stores + app/services + app/prompt + app/model + app/presenters
stores -> app/types
```

禁止方向：

- 组件 import 旧 `ctx/useForm/useApi`。
- 组件 import 旧 hook 模块。
- 单个 hook 平铺十几个 `ref` 后再传给其他 hook。
- workflow 通过长参数列表互相传递状态。
- `App.vue` 或 `GoCapturePanel.vue` 写检索、模型、请求、选区业务逻辑。

## 4. Store 职责

- `project.store.ts`：源码项目、source-server 状态。
- `route.store.ts`：当前页面 URL/path、路由解析结果。
- `selection.store.ts`：选区资产、选区确认状态、`promptAssets`。这是选区唯一真状态源。
- `request.store.ts`：页面请求缓存、接口线索开关。
- `search.store.ts`：候选文件、候选选择、检索日志状态、接口/i18n/定义追踪。
- `model.store.ts`：模型配置、当前模型、模型编辑器、运行状态、日志、结果。
- `composer.store.ts`：输入框内容、最终提示词、发送状态。
- `chat.store.ts`：聊天消息。
- `app-ui.store.ts`：toast、runtime 连接态等 UI 全局状态。这是 toast 唯一真状态源。

组件只能从这些 store 读取状态，不再通过 `useForm('xxx')` 读散乱字段。

### Selection 边界

选区状态只允许由 `selection.store.ts` 保存。页面 runtime 事件进入 `handle-runtime-event.usecase.ts` 后写入 store。

选区副作用命令放在 usecase：

- `expand-selection.usecase.ts`
- `remove-selection.usecase.ts`
- `clear-selections.usecase.ts`
- `preview-selection.usecase.ts`

`runtime/selection-state.bridge.ts` 只是临时 facade，用来把 store 暴露成旧 prompt/message/search 模块需要的 ref 形态。它不拥有状态，也不写 runtime。

禁止恢复：

- `app/modules/selection-module.ts`
- `store-sync` 镜像 selection 的 watch
- `window.__GOCAPTURE_LAST_ELEMENT__`
- `window.__GOCAPTURE_LAST_ELEMENT_INFO__`
- `window.__GOCAPTURE_SELECTIONS__`

### Composer 边界

输入框内容和最终提示词只允许由 `composer.store.ts` 保存。组件直接写 store，不允许再通过 commands 暴露 `setComposerValue`、`insertSelectionMention` 这类局部输入框 mutator。

发送流程由 `workflows/composer-workflow.ts` 编排，读取 store-backed composer facade 后进入本地检索和模型定位。

`runtime/composer-state.bridge.ts` 只是临时 facade，用来把 store 暴露成旧 prompt/search/model/message 模块需要的 ref 形态。它不拥有状态，不做业务副作用。

禁止恢复：

- `app/modules/composer-module.ts`
- `store-sync` 镜像 composer 的 watch
- commands 直接修改输入框局部状态

### App UI 边界

toast 和 runtime 连接态归 `app-ui.store.ts`。toast 的自动清理定时器也在 store 内闭合，runtime 只在卸载时调用 `cleanupToast()`。

禁止恢复：

- `app/modules/toast.ts`
- `store-sync` 镜像 toast 的 watch

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
- `app/runtime/create-runtime-state.ts`

已经删除的旧迁移层禁止恢复：

- `app/modules/*`
- `app/runtime/store-sync.ts`

后续维护必须遵守：

- 新组件必须走 Pinia stores + commands。
- 运行时状态只能通过 stores、runtime bridge、usecase、workflow 组织。
- 不允许只把 `.js` 改成 `.ts` 就算重构。

## 7. 当前 UI 主链路

```txt
main.ts
  -> createGoCaptureBootstrap()
  -> Pinia stores
  -> App.vue
  -> GoCapturePanel.vue
  -> createGoCaptureRuntime(api)
       -> app runtime lifecycle
       -> bridge connect
       -> source project restore
       -> route resolve
       -> commands provide

components/*
  -> Pinia stores
  -> useGoCaptureCommands()
```

旧 ctx 和 `hooks/use-gocapture-ctx.ts` 已移除。组件不得恢复 `useForm/useApi` 模式。

## 8. 重写完成标准

- `App.vue` 保持入口壳层，不超过 300 行。
- `GoCapturePanel.vue` 只负责页面布局和挂载应用生命周期。
- `components` 下没有 `useForm/useApi/ctx`。
- 选区、项目、路由、请求、搜索、模型、聊天、输入框分别有清晰 store。
- 跨模块行为放在 usecase/service，不通过长参数链拼接。
- 构建产物仍输出到 `package/app/gocapture/index.js`。
- `npm run app:inspector:build` 必须通过。

## 9. Connect Agent 协议

连接层分为三个互相独立的概念：

```txt
Connect Agent Service
  -> AgentRegistry
      -> AgentAdapter (Codex / Claude Code / future agents)
          -> ModelBackend compatibility
```

- `AgentAdapter` 统一 `inspect / connect / disconnect / runTask`，并通过 capability 声明任务绑定、代理和模型后端配置能力。
- `AgentRegistry` 是唯一的 Agent 注册与查找入口。服务和路由不得根据 provider id 分支。
- `ModelBackend` 描述模型服务的 wire protocol、Endpoint 和默认模型，不承担 Agent 的任务、线程或工具行为。
- `CompatibilityResolver` 只允许协议兼容的组合。例如 Claude Code 可连接 Anthropic Messages 兼容后端；Codex 声明 OpenAI Responses 协议，但当前由 Codex 自身配置模型后端。
- Provider 原始事件进入服务前统一归一为 Agent event，同时保留原始事件供前端展示详细日志。

新增 Agent 时实现并注册一个 adapter；不得复制 API 路由、项目消息持久化或任务编排。
