#### 开发前阅读

1. `package/` 是可直接加载的 Chrome MV3 扩展包。
2. `package/chrome/cli.js` 提供 `_exports.module` 和 `_require` 模块系统。
3. `package/chrome/web.js` 将 `mdChrome.web` 注入页面主世界，前端代码可以通过 `mdChrome.web.cmd()` 调用 `package/js/service-worker.js` 中的命令。
4. `package/js/service-worker.js` 是后台中枢，负责动态配置读取、桥接文件注入、fetch、cookie、download、事件总线和 Chrome API 透传。
5. `package/app/config.json` 是动态业务脚本配置。当前脚手架保持空配置，不加载任何业务脚本。
6. 若需要新增注入脚本，在 `vue/src/sites/<name>/index.js` 创建入口，构建后输出到 `package/app/<name>/index.js`，再按需写入 `package/app/config.json`。
7. 项目文档使用 VitePress，位于 `docs/`。桥接通信链路和 API 说明优先维护在文档站中。
