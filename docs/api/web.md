# mdChrome.web

`mdChrome.web` 由 `package/chrome/web.js` 注入到页面主世界。页面代码可以通过 `_require('mdChrome')` 获取它。

```js
const mdChrome = _require('mdChrome')
```

## cmd

调用 service worker 命令。

```ts
function cmd<T = any>(params: Record<string, any>): Promise<T>
```

示例：

```js
const manifest = await mdChrome.web.cmd({ cmd: 'get-manifest' })
```

`params.cmd` 会在 `package/js/service-worker.js` 的 `onMessageLister` 中分发。

## injectScript

向当前页面注入扩展内的文件。

```ts
function injectScript(scriptPath: string | string[]): Promise<void>
```

示例：

```js
await mdChrome.web.injectScript('cp_modules/store/index.js')
```

底层会发送：

```js
{
  cmd: 'inject',
  type: 2,
  fileNames: ['cp_modules/store/index.js']
}
```

## injectScript2

`injectScript` 的队列实现版本，支持去重和强制重新注入。

```ts
function injectScript2(
  scriptPath: string | string[],
  options?: { force?: boolean }
): Promise<void>
```

## invalidateScriptCache

清除 `web.js` 内部的文件注入缓存。它只影响页面侧的 `filesCache`，不清除 service worker 的远程代码缓存。

```js
mdChrome.web.invalidateScriptCache('cp_modules/store/index.js')
```

## send

发送事件到 service worker 中央事件总线。

```js
mdChrome.web.send('gocapture:ping', { at: Date.now() })
```

底层命令是 `event-emit`。

## once

等待一次 service worker 事件。

```js
await mdChrome.web.once('task:done', (payload) => {
  console.log(payload)
})
```

底层命令是 `event-once`。

## on

当前实现名为 `on`，但底层发送的是 `event-wait`。这意味着它更接近“一次性等待”，事件触发后会从 wait 队列移除。

```js
mdChrome.web.on('cookie-changed:[.example.com]', (payload) => {
  console.log(payload)
})
```

## off

移除 service worker 事件监听。

```js
mdChrome.web.off('task:done')
```

## activeTab

激活指定 tab。

```js
await mdChrome.web.activeTab(tabId)
```
