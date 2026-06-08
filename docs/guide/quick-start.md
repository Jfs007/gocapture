# 快速上手

只需两步，就能把插件完整注入到你的前端项目中。

## 第一步：安装插件

加载 `package/` 目录作为 Chrome MV3 扩展：

1. 打开 `chrome://extensions/`
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择项目中的 `package/` 目录

加载成功后，扩展会在匹配的页面注入桥接运行时（`package/chrome/web.js`），并准备好接收页面消息。

## 第二步：在项目中添加监听代码

在你的前端项目里添加下面这段监听代码。当插件就绪并发出 `install-setup` 消息时，挂载你的应用：

```js
window.addEventListener('message', (e) => {
    if (e.data.cmd === 'install-setup') {
        // 插件已就绪，此处即可调用 mdChrome.web.cmd() 等能力
    }
})
```

- `e.data.cmd === 'install-setup'`：插件注入完成后下发的安装信号。
- `e.data.env`：插件透传的环境参数，可按需读取。

收到 `install-setup` 信号后，就表示插件已完全注入到前端项目中，此时即可通过 `mdChrome.web.cmd()` 调用 service worker 提供的各项能力。
