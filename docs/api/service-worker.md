# Service Worker Commands

`package/js/service-worker.js` 通过 `onMessageLister(message, sender, sendResponse)` 统一分发命令。页面侧通过 `mdChrome.web.cmd()` 调用这些命令。

## start

触发桥接运行时和动态 app 脚本注入。

```js
await mdChrome.web.cmd({ cmd: 'start' })
```

content script 安装时会自动调用它。

## get-manifest

返回当前扩展 manifest。

```js
const manifest = await mdChrome.web.cmd({ cmd: 'get-manifest' })
```

## inject

执行脚本注入。

文件注入：

```js
await mdChrome.web.cmd({
  cmd: 'inject',
  type: 2,
  fileNames: ['chrome/web.js']
})
```

eval 注入：

```js
await mdChrome.web.cmd({
  cmd: 'inject',
  params: { type: 'eval', value: 'console.log(location.href)' }
})
```

## fetch / ajax

由 service worker 发起请求。相对 URL 会拼接 `manifest.env.api`。

```js
const res = await mdChrome.web.cmd({
  cmd: 'fetch',
  url: 'api/user/info',
  method: 'get',
  data: { id: 1 },
  headers: {
    accessToken: 'token'
  }
})
```

返回结构：

```ts
type FetchResult = {
  success: boolean
  result: any
  resultContent?: string
}
```

GET 请求会把 `data` 合并进 query；非 GET 请求默认把 `data` JSON 序列化到 body。

如果 header 名包含 `md-header-` 前缀，service worker 会通过 `declarativeNetRequest.updateSessionRules` 修改真实请求头。

## getCookie

获取 cookie。

```js
const res = await mdChrome.web.cmd({
  cmd: 'getCookie',
  url: 'https://example.com',
  names: ['session']
})
```

也可以按 domain 获取：

```js
const res = await mdChrome.web.cmd({
  cmd: 'getCookie',
  myDomain: '.example.com'
})
```

## setCookies

设置 cookie。

```js
await mdChrome.web.cmd({
  cmd: 'setCookies',
  domainUrl: 'https://example.com',
  cookieData: {
    token: 'value'
  }
})
```

## removeCookie

删除 cookie。

```js
await mdChrome.web.cmd({
  cmd: 'removeCookie',
  url: 'https://example.com',
  name: 'token'
})
```

## downFile

调用 `chrome.downloads.download` 下载一个或多个文件。

```js
await mdChrome.web.cmd({
  cmd: 'downFile',
  urls: [
    { url: 'https://example.com/file.csv', filename: 'file.csv' }
  ]
})
```

## changeAccount

清除指定 origins 的 cookie 并刷新当前 tab。

```js
await mdChrome.web.cmd({
  cmd: 'changeAccount',
  origins: ['https://example.com']
})
```

## event-*

service worker 内部有一个中央事件总线：

```js
await mdChrome.web.cmd({ cmd: 'event-once', name: 'task:done' })
await mdChrome.web.cmd({ cmd: 'event-emit', name: 'task:done', payload: {} })
await mdChrome.web.cmd({ cmd: 'event-list' })
```

`mdChrome.web.send()`、`once()`、`on()` 是这些命令的页面侧封装。

## activeTab

激活 tab。

```js
await mdChrome.web.cmd({ cmd: 'activeTab', tabId: 123 })
```

## updateDynamicRules

更新 `declarativeNetRequest` dynamic rules。

```js
await mdChrome.web.cmd({
  cmd: 'updateDynamicRules',
  rules: [],
  removeRuleIds: [1, 2]
})
```

## Base.*

透传调用 Chrome API。

```js
await mdChrome.web.cmd({
  cmd: 'Base.tabs.query',
  params: [{ active: true, currentWindow: true }]
})
```

service worker 会将 `Base.tabs.query` 解析成 `chrome.tabs.query(...params)`。
