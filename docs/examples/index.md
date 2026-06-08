# 调用示例

## 在注入脚本中读取 manifest

```js
!async function () {
  const mdChrome = _require('mdChrome')
  const manifest = await mdChrome.web.cmd({ cmd: 'get-manifest' })
  console.log(manifest.name, manifest.env)
}()
```

## 在前端页面中请求后台接口

```js
const mdChrome = _require('mdChrome')

const res = await mdChrome.web.cmd({
  cmd: 'fetch',
  url: 'api/example/list',
  method: 'get',
  data: {
    pageNum: 1,
    pageSize: 20
  }
})

console.log(res.result)
```

## 添加一个新的 app 脚本

创建入口：

```txt
vue/src/sites/example/index.js
```

构建后会输出到：

```txt
package/app/example/index.js
```

把脚本加入 `package/app/config.json`：

```json
{
  "result": {
    "cssUrls": [],
    "jsUrls": ["example/index.js"]
  },
  "rules": {
    "example/index.js": {
      "supportIframe": false,
      "matches": ["*.example.com"]
    }
  },
  "canInjectIframeList": [],
  "version": "20260608.000001",
  "success": true,
  "api": ""
}
```

重新加载扩展后，访问匹配站点即可注入。

## iframe 中调用扩展

`package/chrome/cli.js` 会在 iframe 中重写一个轻量的 `chrome.runtime.sendMessage`，并通过 `window.postMessage` 交给 content script 转发。

```js
const mdChrome = _require('mdChrome')

await mdChrome.web.cmd({
  cmd: 'fetch',
  url: 'api/example',
  method: 'post',
  data: { ok: true }
})
```

iframe 不需要直接持有扩展 ID，桥接层会处理回调。
