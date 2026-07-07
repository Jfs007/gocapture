#### 开发前阅读

1. `package/` 是可直接加载的 Chrome MV3 扩展包。
2. `package/chrome/cli.js` 提供 `_exports.module` 和 `_require` 模块系统。
3. `package/chrome/web.js` 将 `mdChrome.web` 注入页面主世界，前端代码可以通过 `mdChrome.web.cmd()` 调用 `package/js/service-worker.js` 中的命令。
4. `package/js/service-worker.js` 是后台中枢，负责动态配置读取、桥接文件注入、fetch、cookie、download、事件总线和 Chrome API 透传。
5. `package/app/config.json` 是动态业务脚本配置。当前脚手架保持空配置，不加载任何业务脚本。
6. 若需要新增工程化注入脚本，优先使用 `npm run app:build -- --project <dir> --name <name> --entry <file>`，它会输出到 `package/app/<name>/index.js` 并更新 `package/app/config.json`。
7. 项目文档使用 VitePress，位于 `docs/`。桥接通信链路和 API 说明优先维护在文档站中。

#### 通用性原则（强制，优先级最高）

- **不要因为用户举的具体案例去打专门补丁。** 用户给的案例（某个页面 / 某个选区 / 某个变量名或文案，如某个金额、某个按钮、某个 class）只是**复现问题的样本**，不是要你针对它硬编码。
- 禁止把案例的**字面值**写死进：代码分支、`if/switch` 特判、枚举表/常量表、正则里的具体词、以及**喂给 LLM 的提示词**。提示词尤其只能写抽象判定原则，不许塞「例如某某字段/某某按钮」这类具体样本。
- 收到 bug 先**查根因**，从案例里抽象出「类」的规律（如「可见文案可能是运行时值/插值」「同名文案多处需消歧」「选区扩区后原始身份会丢」），用**通用机制**解决，让同类的其它情况一并覆盖。
- 自检：任何改动里若出现「只有这个案例才成立」的字面量或分支，就是错的，删掉、改成通用规则。
