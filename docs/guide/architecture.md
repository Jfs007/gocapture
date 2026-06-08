# 架构

脚手架由三层组成：

```txt
web page / iframe
  ↑  window.postMessage
content script: package/js/content.js
  ↑  chrome.runtime.sendMessage
service worker: package/js/service-worker.js
  ↓  chrome.scripting.executeScript
page runtime: package/chrome/cli.js + package/chrome/web.js
```

## 1. content script 建立入口

`package/js/content.js` 在 `document_start` 运行。它做两件事：

- 将扩展 ID 和插件名称写入 `localStorage`，页面脚本后续通过 `MdPluginId` 找到扩展。
- 向 service worker 发送 `{ cmd: "start" }`，触发桥接运行时和动态脚本注入。

它还监听来自页面或 iframe 的 `window.postMessage`，把 `call: "runtime.sendMessage"` 这类请求转成真实的 Chrome API 调用，再把结果通过 `postMessage` 回传。

## 2. service worker 注入桥接运行时

`package/js/service-worker.js` 接收 `start` 命令后，会先注入本地基础文件：

```js
const localConfig = {
  jsUrls: ['chrome/cli.js', 'chrome/web.js', 'chrome/web-hook.js', 'chrome/auth.js']
}
```

这些文件运行在 `MAIN` world，因此页面业务代码可以直接访问 `_require('mdChrome')`。

随后 service worker 读取 `app/config.json`。如果 `manifest.app_module` 是 `Offline`，它读取扩展内的 `package/app/config.json`；否则读取 `manifest.env.source` 上的远程配置。

## 3. web.js 暴露页面 API

`package/chrome/cli.js` 先创建简单模块系统：

```js
window._exports.module['mdChrome'] = {}
window._require = (name) => window._exports.module[name]
```

`package/chrome/web.js` 再向这个模块写入：

```js
mdChrome.web = {
  name: 'chrome-extension-scaffold',
  version: '4.0',
  cmd,
  injectScript,
  injectScript2,
  invalidateScriptCache,
  on,
  once,
  off,
  send,
  activeTab
}
```

因此前端页面可以这样调用扩展能力：

```js
const mdChrome = _require('mdChrome')
const manifest = await mdChrome.web.cmd({ cmd: 'get-manifest' })
```

## 4. cmd 的调用路径

`mdChrome.web.cmd(params)` 的核心逻辑是：

```txt
mdChrome.web.cmd(params)
  -> chrome.runtime.sendMessage(extensionId, params)
  -> service-worker onMessageLister(message)
  -> 根据 message.cmd 分发到对应 Lister
  -> sendResponse(result)
  -> Promise resolve
```

这就是普通前端项目能够调用扩展后台能力的关键。
