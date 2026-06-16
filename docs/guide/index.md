# 开始

这个项目现在定位为 Chrome MV3 插件脚手架。它保留底层桥接、动态注入、后台命令和 cookie/fetch/download 等基础能力，移除了原先绑定具体平台的业务脚本。

## 核心目录

```txt
package/
  chrome/              # 注入到网页主世界的桥接运行时
  js/                  # content script、service worker、offscreen
  app/                 # 动态业务脚本输出目录
main-site/
  src/                 # iframe 页面示例，可用于调试 bridge，不作为 app 打包入口
vue/
  src/sites/           # 工程化 app 源码，构建后输出到 package/app
docs/
  .vitepress/          # VitePress 文档站配置
```

## 本地开发

启动 iframe 示例页：

```bash
cd main-site
yarn dev
```

构建工程化 app 到 `package/app`：

```bash
npm run app:inspector:build
```

启动文档站：

```bash
npm run docs:dev
```

## 当前 app 配置

`package/app/config.json` 现在不会加载任何业务脚本：

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

当你开始一个新业务时，可以用 `npm run app:build` 自动输出 `package/app/<name>/index.js` 并更新 `jsUrls`、`cssUrls` 和 `rules`。详细说明见 [工程化 App 打包](/guide/app-build)。
