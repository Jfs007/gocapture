# Chrome插件脚手架开发指南

## 📁 目录结构说明

```
shop-chrome-plugins/
├── package/                 # Chrome插件开发目录（原生JS）
│   ├── app/                # 站点打包输出目录
│   ├── chrome/             # Chrome插件基础工具
│   │   ├── cli.js         # 模块导出系统
│   │   └── web.js         # 动态注入JS等基础函数
│   └── js/                # Chrome插件核心
│       ├── service-worker.js  # Background脚本
│       └── content.js/   # 内容脚本
├── vue/                    # Vue开发目录（等同于文档中的vue/）
│   └── src/
│       ├── sites/         # 各站点Vue组件开发
```

## 🔧 开发模式

### 1. Vue开发模式（推荐）
在 `vue/src/sites/` 下创建站点目录进行Vue开发：

```javascript
// vue/src/sites/jinritemai.com/index.js
import App from './app.vue';

const initApp = async () => {
    // 加载cp_modules模块
    await mdChrome.web.injectScript('cp_modules/store/index.js');
    
    // 使用注入的模块
    const store = _require('chromeRedux');
    
    // 使用公共组件创建应用
    const { createBaseApp } = MdUiComponent.Components;
    const app = createBaseApp(App, {});
    
    // 挂载到页面
    document.body.appendChild(app.__el__);
}

initApp();
```

### 2. 原生JS开发模式
直接在 `package/app/` 下开发，使用 `window._exports.module` 导出模块。

## 📦 模块系统

### cp_modules 使用方式
`src/cp_modules/` 是通用工具包，类似 `node_modules` 概念：

```javascript
// 1. 注入模块
await mdChrome.web.injectScript('cp_modules/store/index.js');

// 2. 使用模块
const store = _require('chromeRedux');
const loadsh = _require('loadsh');
const webHook = _require('webHook');
```

### 可用的cp_modules模块

#### store模块 - 状态管理
```javascript
const store = _require('chromeRedux');

// 注册模块
store.registerModule('user', {
    state: { name: '', avatar: '' },
    mutations: {
        setName(state, name) { state.name = name; }
    }
});

// 初始化
await store.init();

// 使用
const userName = await store.get('user/name');
await store.commit('user/setName', 'John');
```

#### loadsh模块 - 工具函数
```javascript
const loadsh = _require('loadsh');

// Toast提示
loadsh.showToast({ message: '操作成功!' });

// 模拟输入
loadsh.simulateInput('#input', 'new value');

// 文件上传模拟
loadsh.simulateUpload(uploaderElement, [{ name: 'file.jpg', blob: file }]);

// 图片转Blob
const blob = await loadsh.imageToBlob('https://example.com/image.jpg');

// 获取对象属性
const value = loadsh.getProperty(obj, 'a.b.c');
```

#### webHook模块 - 网络拦截
```javascript
const webHook = _require('webHook');

// 添加拦截规则
webHook.addRule({
    urlPattern: "api/goods",
    modifier: (body) => {
        body.modified = true;
        return body;
    }
});

// 移除规则
webHook.removeRule('api/goods');
```

## 🚀 开发流程

### 1. 启动开发环境
```bash
yarn dev  # 启动自动打包监听
```

### 2. 开发步骤
1. 在 `vue/src/sites/[站点名]/` 下创建Vue组件
2. 编写代码后自动打包到 `package/app/`
3. 在Chrome扩展管理页面重新加载插件
4. 访问对应站点查看效果

### 3. 调用Background函数
```javascript
const mdPluginId = localStorage.getItem('MdPluginId');
chrome.runtime.sendMessage(mdPluginId, { cmd: 'your_command' });
```

## 🎯 关键概念

- **cp_modules**: 通用工具包，放置可复用的基础功能模块
- **站点目录**: 放置具体站点的业务逻辑代码
- **MdUiComponent**: 来自 `common/index.js` 的公共组件库
- **模块注入**: 通过 `mdChrome.web.injectScript()` 动态加载模块
- **模块调用**: 通过 `_require()` 获取已注入的模块

## ⚠️ 注意事项

1. **模块路径**: `injectScript()` 的路径相对于 `package/` 目录
2. **开发预览**: 修改代码后需重新加载Chrome扩展才能看到效果
3. **模块分工**: 
   - 通用工具 → `src/cp_modules/`
   - 业务逻辑 → `vue/src/sites/[站点]/`
4. **导出格式**: cp_modules使用 `_exports.module['模块名']` 导出