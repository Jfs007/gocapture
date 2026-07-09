# Chrome Extension Scaffold

Chrome MV3 插件工程化脚手架，用于把扩展后台能力、动态脚本注入和普通前端页面连接起来。

## What Is Included

- `package/chrome`: 注入到网页主世界的桥接运行时，例如 `mdChrome.web.cmd()`。
- `package/js`: Chrome content script、service worker、offscreen 等扩展运行文件。
- `package/app`: 动态 app 脚本输出目录，可由 `npm run app:build` 写入业务脚本。
- `main-site`: iframe 示例页，用于查看 bridge 状态和调试基础通信。
- `docs`: VitePress 文档站。

## App Build

把 Vue/Vite 工程打成 `package/app/sth/index.js`：

```bash
npm run app:build -- --project vue --name sth --entry src/main.ts --matches "<all_urls>"
```

开发 watch + 重新注入：

```bash
npm run app:dev -- --project vue --name sth --entry src/main.ts --matches "http://localhost:3000/*"
```

输出是非 module 的 IIFE bundle。watch 模式会在构建产物变化时更新 `package/app/config.json` 的 `version`，页面端 dev reload 客户端检测到变化后重新触发 app 注入。

当前元素审查工具源码在 `vue/src/sites/magnus/`，可直接执行：

```bash
npm run app:inspector:build
npm run app:inspector:dev
```

## Local Source Server

如果页面改造助手需要拿到真实源码路径，先启动本地服务：

```bash
npm run source:server
```

插件菜单里的“选择源码”会请求 `http://127.0.0.1:17321/api/source/select`，由本地服务拉起系统目录选择器并扫描源码文件树。服务不可用时会退回浏览器目录选择器，但浏览器模式拿不到真实本地路径。

## Magnus Release Package

开发仓库不直接发布到 npm。发布前先生成一个独立 npm 包目录，目录里只包含运行 Magnus 需要的 CLI、本地服务、Side Panel UI 和 Chrome 插件目录。

```bash
npm run release:package
cd outputs/magnus-npm-package
npm publish --access public
```

也可以在开发仓库启动发布页面：

```bash
npm run release:gui
```

生成的发布包会把 Chrome 插件切到 `Online` 模式：`GetRemoteConfigUrl()` 从本地 source-server 读取 `/app/config.json`，配置里的 `jsUrls` 再从本地 `/app/*` 静态目录加载。默认地址是 `http://127.0.0.1:17321/`，可通过 `--source-server-url`、`MAGNUS_EXTENSION_SOURCE_URL` 或 `MAGNUS_SOURCE_SERVER_URL` 覆盖。

本地验证发布包：

```bash
node scripts/build-npm-package.js --skip-app-build --out /tmp/magnus-npm-package-test
cd /tmp/magnus-npm-package-test
npm pack --dry-run
```

用户安装：

```bash
npm install -g @sep-agent/magnus
magnus -v
magnus install
magnus chrome
```

`magnus chrome` 会打开随 npm 包携带的 `package/` 插件目录，并提示用户在 `chrome://extensions` 中通过“加载已解压的扩展程序”安装。

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
