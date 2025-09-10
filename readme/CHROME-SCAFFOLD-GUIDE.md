# Chrome插件开发脚手架使用指南

## 🎯 新功能概述

### 1. 全新的 injectScript 实现
解决了原有 `chrome.runtime.getURL` 只能在 content-script 和 background.js 中调用的限制，现在可以在动态注入的代码中直接使用。

### 2. cp_modules 模块系统
类似 node_modules 的概念，提供可复用的工具模块，通过新的加载机制实现模块化开发。

## 🔧 API 使用说明

### mdChrome.web API 升级

#### injectScript(scriptPath, options)
- **功能**: 注入外部脚本文件
- **参数**: 
  - `scriptPath`: 字符串或数组，脚本路径
  - `options`: 可选配置 `{ world: "MAIN" | "ISOLATED" }`
- **返回**: Promise

```javascript
// 单个文件注入
await mdChrome.web.injectScript('other/jquery.js')

// 多个文件并行注入 
await mdChrome.web.injectScript([
  'hack_scripts/web-hook.js',
  'other/jszip.min.js',
  'other/FileSaver.js'
])

// 或者使用Promise.all
await Promise.all([
  mdChrome.web.injectScript('hack_scripts/web-hook.js'),
  mdChrome.web.injectScript('other/jszip.min.js'), 
  mdChrome.web.injectScript('other/FileSaver.js')
])
```

#### injectCode(code, options)
- **功能**: 注入代码字符串
- **参数**: 
  - `code`: 要执行的JavaScript代码字符串
  - `options`: 可选配置
- **返回**: Promise

```javascript
await mdChrome.web.injectCode(`
  console.log('动态注入的代码');
  window.myVariable = 'hello world';
`)
```

#### requireModule(moduleName, options)
- **功能**: 加载cp_modules中的模块
- **参数**: 
  - `moduleName`: 模块名称 (如 'lodash', 'store')
  - `options`: 可选配置
- **返回**: Promise

```javascript
// 加载单个模块
await mdChrome.web.requireModule('lodash')

// 加载多个模块
await Promise.all([
  mdChrome.web.requireModule('lodash'),
  mdChrome.web.requireModule('loadsh'),
  mdChrome.web.requireModule('store')
])

// 使用模块
const lodash = _require('lodash')
const value = lodash.get({ a: { b: 'test' } }, 'a.b', 'default')
```

## 📦 cp_modules 模块系统

### 内置模块

#### lodash 模块
提供常用的工具函数:

```javascript
const lodash = _require('lodash')

// 深拷贝
const cloned = lodash.cloneDeep(originalObject)

// 防抖/节流
const debouncedFn = lodash.debounce(fn, 1000)
const throttledFn = lodash.throttle(fn, 1000)

// 对象操作
const value = lodash.get(obj, 'a.b.c', 'default')
lodash.set(obj, 'a.b.c', 'newValue')

// 数组操作
const uniqueArray = lodash.uniq([1, 2, 2, 3])
const chunks = lodash.chunk([1, 2, 3, 4], 2) // [[1,2], [3,4]]
```

#### loadsh 模块
提供Chrome扩展专用工具:

```javascript
const loadsh = _require('loadsh')

// Toast提示
loadsh.showToast({ message: '操作成功!', duration: 2000 })

// 模拟输入
loadsh.simulateInput('#input-selector', 'new value')

// 文件上传模拟
const file = loadsh.base64ToFile(base64String, 'filename.jpg')
loadsh.simulateUpload(uploaderElement, [{ name: 'file.jpg', blob: file }])

// 图片转Blob
const blob = await loadsh.imageToBlob('https://example.com/image.jpg')
```

#### store 模块
提供状态管理:

```javascript
const store = _require('store')

// 注册模块
store.registerModule('user', {
  state: {
    name: '',
    avatar: ''
  },
  mutations: {
    setName(state, name) {
      state.name = name
    },
    setAvatar(state, avatar) {
      state.avatar = avatar  
    }
  }
})

// 初始化
await store.init()

// 获取状态
const userName = await store.get('user/name')

// 提交变更
await store.commit('user/setName', 'John Doe')
```

### 创建自定义模块

1. 在 `src/cp_modules/` 下创建新目录，如 `my-module/`
2. 创建 `index.js` 文件:

```javascript
// src/cp_modules/my-module/index.js
!function () {
  function myFunction() {
    return 'Hello from my module!'
  }

  function myUtility(data) {
    // 你的工具函数逻辑
    return processedData
  }

  // 导出模块
  _exports.module['my-module'] = {
    myFunction,
    myUtility
  }
}()
```

3. 使用模块:

```javascript
// 加载模块
await mdChrome.web.requireModule('my-module')

// 使用模块
const myModule = _require('my-module')
const result = myModule.myFunction()
```

## 💡 最佳实践

### 1. 异步初始化模式

```javascript
const initApp = async () => {
  try {
    // 并行加载依赖
    await Promise.all([
      mdChrome.web.injectScript(['dep1.js', 'dep2.js']),
      mdChrome.web.requireModule(['lodash', 'store'])
    ])
    
    // 初始化应用逻辑
    initializeApplication()
    
  } catch (error) {
    console.error('应用初始化失败:', error)
  }
}

// 页面加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp)
} else {
  initApp()
}
```

### 2. 错误处理

```javascript
try {
  await mdChrome.web.injectScript('external-lib.js')
} catch (error) {
  console.error('外部库加载失败:', error)
  // 提供降级方案
  useFallbackImplementation()
}
```

### 3. 模块预加载

```javascript
// 在应用启动时预加载常用模块
const preloadModules = async () => {
  await Promise.all([
    mdChrome.web.requireModule('lodash'),
    mdChrome.web.requireModule('store'),
    // 更多常用模块...
  ])
}
```

## 🔄 迁移指南

### 从旧版本迁移

**旧代码:**
```javascript
mdChrome.web.injectScript('script.js') // 同步，可能失败
```

**新代码:**
```javascript
await mdChrome.web.injectScript('script.js') // 异步，可靠
```

**批量加载:**
```javascript
// 旧方式 - 顺序加载
mdChrome.web.injectScript('dep1.js')
mdChrome.web.injectScript('dep2.js')
mdChrome.web.injectScript('dep3.js')

// 新方式 - 并行加载
await Promise.all([
  mdChrome.web.injectScript('dep1.js'),
  mdChrome.web.injectScript('dep2.js'),
  mdChrome.web.injectScript('dep3.js')
])
```

## ⚙️ 技术架构

### 工作原理
1. **通信机制**: 基于 `chrome.runtime.sendMessage` 与 service-worker 通信
2. **文件注入**: 使用 `chrome.scripting.executeScript` 的文件模式 (type: 2)
3. **代码注入**: 使用函数模式执行代码字符串 (type: 1)
4. **模块系统**: 基于全局 `_exports.module` 对象实现模块注册和加载

### 架构优势
- ✅ 突破了 `chrome.runtime.getURL` 的使用限制
- ✅ 支持在动态注入的代码中继续注入其他代码
- ✅ 提供了统一的模块加载机制
- ✅ 支持异步加载和错误处理
- ✅ 兼容现有的 `_require` 模块系统

## 📚 示例项目

查看 `dev/src/sites/compass.jinritemai.com/index.js` 文件获取完整的使用示例。

## 🐛 故障排除

### 常见问题

**Q: injectScript 返回错误 "chrome.runtime.lastError"**
A: 检查文件路径是否正确，确保文件存在于插件目录中

**Q: 模块加载后无法使用 _require 访问**  
A: 确保模块正确导出到 `_exports.module['模块名']`

**Q: 在动态代码中无法使用新的API**
A: 确保 `chrome/web.js` 已正确加载，并且在调用前等待其加载完成

**Q: 异步加载超时**
A: 检查网络连接和文件大小，考虑增加超时时间或使用分批加载