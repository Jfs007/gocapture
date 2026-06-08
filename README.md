# Chrome Extension Scaffold

Chrome MV3 插件工程化脚手架，用于把扩展后台能力、动态脚本注入和普通前端页面连接起来。

## What Is Included

- `package/chrome`: 注入到网页主世界的桥接运行时，例如 `mdChrome.web.cmd()`。
- `package/js`: Chrome content script、service worker、offscreen 等扩展运行文件。
- `package/app`: 动态 app 脚本输出目录，当前配置为空，不加载任何业务脚本。
- `vue`: 用 Vite 构建注入脚本的工程，当前只保留中性 `example` 入口。
- `main-site`: iframe 示例页，用于查看 bridge 状态和调试基础通信。
- `docs`: VitePress 文档站。

## Docs

```bash
npm install
npm run docs:dev
```

构建文档：

```bash
npm run docs:build
npm run docs:build:dev
npm run docs:build -- dev
```

## App Config

当前 `package/app/config.json` 不加载任何脚本：

```json
{
  "result": {
    "cssUrls": [],
    "jsUrls": []
  },
  "rules": {},
  "canInjectIframeList": [],
  "version": "20260608.000000",
  "success": true,
  "api": ""
}
```

## Bridge Example

页面或注入脚本中：

```js
const mdChrome = _require('mdChrome')
const manifest = await mdChrome.web.cmd({ cmd: 'get-manifest' })
```

更多命令和通信链路见 `docs/guide/architecture.md`、`docs/api/web.md` 和 `docs/api/service-worker.md`。
