#### 开发前阅读

0. 你需要构建的md文件统统放到readme下面，否则太混乱了
1. package/为插件包,开发插件源码在此目录下

   - 该目录只支持原生js开发,如果需要vue,可在vue/src下进行开发,vite会打包为原生js到package/app 目录下面
     举例: vue/src/sites/jinritemai.com/index.js 会打包到package/app/index.js
   - 原生js不支持import/export, 所以通过将方法绑定到window._exports.module上面来调用，详情见package/chrome/cli.js
   - package/chrome/web.js 提供了一些动态注入js等基础函数
   - package/js 下面是chrome插件提供的content-scripts 和 background
   - package/js/service-worker.js 是插件的background。
2. 如何调用background的函数

```js
 const mdPluginId = localStorage.getItem('MdPluginId');
 chrome.runtime.sendMessage(mdPluginId, { cmd: 'cmd' },)
```

3. src/cp_modules 是模块包，通过如下加载

```js
// 需要调用注入脚本函数, 如果没有注入则无法 _require
await mdChrome.web.injectScript('cp_modules/store/index.js');
// 在普通js下使用
const store = _require('chromeRedux');
// 在.vue使用 
const store = _require('chromeRedux');
```

4. 通过vue来开发
   - vue/src/sites 创建 xx/index.js
   - vue/src/sites/common/index.js 公共的代码文件，会被优先加载到MdUiComponent 供其他js使用
   - 开发vue的时候

```js
import App from './app.vue';
const initApp = async () => {
    // 加载store
    await mdChrome.web.injectScript('cp_modules/store/index.js');
    // 加载后可以使用store;
    const store = _require('chromeRedux');
    // MdUiComponent 来自common/index.js MdUiComponent绑定了公共组件
    const { createBaseApp } = MdUiComponent.Components;
    const app = createBaseApp(App, {});
    // 比如挂到body下面
    document.body.appendChild(app.__el__);
}
initApp()
```

5. 开发完之后不需要测试，我会自己手动测试功能
