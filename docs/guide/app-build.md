# 工程化 App 打包

`package/app` 只加载普通浏览器脚本和 CSS，不执行 ESM。工程化项目需要先打成非 module 产物，再写入 `package/app/<name>/` 并更新 `package/app/config.json`。

## 构建

把 Vue/Vite 项目输出到 `package/app/sth/index.js`：

```bash
npm run app:build -- --project vue --name sth --entry src/main.ts --matches "<all_urls>"
```

常用参数：

```bash
npm run app:build -- \
  --project vue \
  --name sth \
  --entry src/sites/sth/index.ts \
  --matches "https://example.com/*,http://localhost:3000/*"
```

脚本会做这些事：

- 使用 Vite/Rollup 将入口打成 IIFE，输出不是 ESM。
- 内联动态 import，最终入口固定为 `index.js`。
- 将 CSS 输出为 `style.css`，并写入 `result.cssUrls`。
- 同步到 `package/app/<name>/`。
- 更新 `package/app/config.json` 的 `jsUrls`、`cssUrls`、`rules` 和 `version`。

如果入口目录或其父目录下存在 `app-build.config.json`，脚本会优先读取其中的注入规则并覆盖命令行里的 `--matches` / `--iframe`。例如：

```json
{
  "matches": ["localhost:9002", "localhost:9003", "https://ad.itaored.com"],
  "supportIframe": false
}
```

GoCapture Side Panel 的源码在：

```txt
vue/src/sites/gocapture/
  main.js
  App.vue
  style.css
```

构建命令：

```bash
npm run app:inspector:build
```

业务入口需要自己创建挂载容器，因为 `index.html` 不会进入 `package/app`：

```ts
const root = document.createElement('div')
root.id = 'sth-app'
document.body.appendChild(root)
```

## Dev 热更新

开发时使用 watch 模式：

```bash
npm run app:dev -- --project vue --name sth --entry src/sites/sth/index.ts --matches "http://localhost:3000/*"
```

watch 模式会额外注入 `package/app/__dev__/reload.js`。它每秒读取一次 `app/config.json`，发现 `version` 变化后调用：

```js
mdChrome.web.cmd({ cmd: 'start', isDevConfig: 1 })
```

这不是 Vite 原生 HMR。因为 `package/app` 不能加载模块，开发体验是：

```txt
保存源码 -> Vite watch 重建 -> 写入 package/app/<name>/index.js -> bump config.version -> 页面重新注入 app bundle
```

如果 Vue app 需要避免重复挂载，可以监听重新注入前事件：

```js
window.addEventListener('gocapture-app:before-reload', () => {
  window.__STH_APP__ && window.__STH_APP__.unmount()
})
```

## 性能说明

实时写入 `package/app/sth/index.js` 本身通常不是性能瓶颈。更重的是 Vite 重建和浏览器重新执行完整 bundle。

当前脚本做了三点控制：

- 只在 Vite 成功构建后写入，不直接监听每个源码变动写目标文件。
- 写入前比较文件内容，内容没变就不改 `index.js`。
- 只有输出或配置真的变化时才更新 `config.version`，页面轮询才会触发重新注入。

因此正常保存文件的开发方式开销可控。需要注意的是，重新注入是整包执行，不是模块级热替换；如果 bundle 很大或保存频率极高，主要成本会体现在页面端重新执行和重复挂载清理上。
