# 动态配置

`package/app/config.json` 控制哪些脚本和样式会被注入到目标页面。它是业务扩展点，不是桥接运行时本身。

## 字段

```ts
type AppConfig = {
  result: {
    cssUrls: string[]
    jsUrls: string[]
  }
  rules: Record<string, {
    matches?: string[]
    supportIframe?: boolean
    auth?: string
  }>
  canInjectIframeList: string[]
  version: string
  success: boolean
  api: string
}
```

## result

`result.jsUrls` 和 `result.cssUrls` 是候选资源列表，路径相对于 `package/app`：

```json
{
  "result": {
    "cssUrls": [],
    "jsUrls": ["example/index.js"]
  }
}
```

## rules

`rules` 使用资源路径作为 key。service worker 会根据当前页面 URL、iframe 状态和权限过滤资源。

```json
{
  "rules": {
    "example/index.js": {
      "supportIframe": false,
      "matches": ["*.example.com"]
    }
  }
}
```

匹配规则会被规范化：

- 没有协议时自动补成 `*://`
- 没有 path 时自动补成 `/*`
- 支持 `*` 和 `*.example.com`
- 支持端口，例如 `localhost:3000`

## version

service worker 会缓存远程脚本内容。`version` 变化时会清空缓存并重新拉取资源。

开发时可以手动修改 `version`，也可以使用 app watch 脚本自动更新：

```bash
npm run app:dev -- --project vue --name sth
```

watch 模式会在构建产物变化时更新 `version`，页面中的 dev reload 客户端检测到变化后会重新触发 `start` 注入。

## iframe

子 iframe 默认不会注入 `supportIframe: false` 的脚本。若需要允许特定 iframe，可以配置：

```json
{
  "canInjectIframeList": ["https://docs.example.com"]
}
```

service worker 会允许扩展自身 iframe 页面，以及命中该白名单的 iframe。
