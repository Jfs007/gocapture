你需要构建的md文件统统放到readme下面，否则太混乱了

1. src/js/service-worker.js 用来接受命令 webpage 通过如下调用
```js
 const mdPluginId = localStorage.getItem('MdPluginId');
 chrome.runtime.sendMessage(mdPluginId, { cmd: 'cmd' },)
```
2. 通过dev/src/sites打包目标目录为src/app,app/config.json 需要自己配置，表示默认加载的js
