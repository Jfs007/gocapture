# Main Site

基于 Vue3 + TypeScript + Naive UI 的项目

## 安装依赖

```bash
npm install
# 或
pnpm install
# 或
yarn install
```

## 开发

```bash
npm run dev
```

## 构建

```bash
npm run build
```

## 预览

```bash
npm run preview
```

## Chrome 扩展 TypeScript 类型定义

本项目提供 Chrome 扩展的 TypeScript 类型定义，位于 `src/types/mdChrome.d.ts`。

**注意：** 此项目仅提供类型定义，实际功能由 Chrome 插件注入实现。

### 类型定义说明

#### MdChromeModule
Chrome 扩展主模块，提供脚本注入和命令通信功能。

```typescript
interface MdChromeModule {
  web: {
    cmd<T = any>(params: any): Promise<T>
    injectScript(scriptPath: string | string[]): Promise<void>
    injectScript2(scriptPath: string | string[], options?: InjectScriptOptions): Promise<void>
    invalidateScriptCache(scriptPath: string | string[]): void
  }
}
```

#### WebRequestAPI
Web 请求拦截器 API，用于监听和修改网络请求。

```typescript
interface WebRequestAPI {
  onResponse(callback: (data: WebRequestResponse) => void): void
  onRequestModify(callback: (data: WebRequestModified) => void): void
  addRule(rule: InterceptRule): void
  removeRule(urlPattern: string): void
  getRules(): InterceptRule[]
  updateRule(urlPattern: string, modifications: any): void
}
```

### 使用示例

```typescript
import type { MdChromeModule, WebRequestAPI } from './types/mdChrome'

// 使用 _require 获取插件注入的模块（带类型提示）
const mdChrome = _require('mdChrome') as MdChromeModule
const webHook = _require('webHook') as WebRequestAPI

// 发送命令到 Chrome 扩展
const result = await mdChrome.web.cmd({ cmd: 'getManifest' })

// 注入脚本
await mdChrome.web.injectScript('path/to/script.js')

// 监听网络请求响应
webHook.onResponse((data) => {
  console.log('URL:', data.url)
  console.log('Result:', data.result)
})

// 添加请求拦截规则
webHook.addRule({
  urlPattern: '/api/user',
  modifier: (bodyData) => {
    bodyData.modified = true
    return bodyData
  }
})
```

### 全局类型

项目已声明以下全局类型：

- `window._require(name: string)` - 全局模块加载函数
- `window.__WEB_REQUEST_API__` - Web 请求拦截 API
- `_require(name: string)` - 全局函数，用于加载插件模块
