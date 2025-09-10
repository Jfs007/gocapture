# cp_modules 开发指南

## 🎯 概述

cp_modules是一个类似node_modules的模块系统，用于Chrome扩展开发。通过构建脚本将模块代码内联到web.js中，完全避开Chrome扩展资源访问限制。

## 🔧 工作流程

### 1. 开发cp_modules模块

在 `src/cp_modules/` 目录下创建模块：

```
src/
└── cp_modules/
    ├── my-module/
    │   └── index.js
    ├── loadsh/
    │   └── index.js
    ├── store/
    │   └── index.js
    └── web-hook/
        └── index.js
```

### 2. 模块结构示例

```javascript
// src/cp_modules/my-module/index.js
!function () {
    function myFunction() {
        return 'Hello from my module!';
    }

    function utilityFunction(data) {
        // 你的工具函数逻辑
        return processedData;
    }

    // 导出模块
    _exports.module['my-module'] = {
        myFunction,
        utilityFunction
    };
}();
```

### 3. 构建模块

```bash
# 单次构建
npm run build-modules

# 监听模式（推荐开发时使用）
npm run build-modules:watch
```

### 4. 在代码中使用模块

```javascript
// 加载模块
await mdChrome.web.requireModule('my-module');

// 使用模块
const myModule = _require('my-module');
const result = myModule.myFunction();
```

## 📦 内置模块

### loadsh 模块
Chrome扩展专用工具集：

```javascript
const loadsh = _require('loadsh');

// Toast提示
loadsh.showToast({ message: '操作成功!' });

// 模拟输入
loadsh.simulateInput('#input', 'new value');

// 文件上传模拟
const file = loadsh.base64ToFile(base64String, 'file.jpg');
loadsh.simulateUpload(uploaderElement, [{ name: 'file.jpg', blob: file }]);

// 图片转Blob
const blob = await loadsh.imageToBlob('https://example.com/image.jpg');

// 获取对象属性
const value = loadsh.getProperty(obj, 'a.b.c');
```

### store 模块
状态管理系统：

```javascript
const store = _require('store');

// 注册模块
store.registerModule('user', {
    state: { name: '', avatar: '' },
    mutations: {
        setName(state, name) { state.name = name; },
        setAvatar(state, avatar) { state.avatar = avatar; }
    }
});

// 初始化
await store.init();

// 获取状态
const userName = await store.get('user/name');

// 提交变更
await store.commit('user/setName', 'John Doe');
```

### web-hook 模块
网页Hook工具：

```javascript
const webHook = _require('web-hook');

// 启用Hook
webHook.enable();

// 添加拦截器
webHook.addInterceptor('fetch', ({ url, options }) => {
    console.log('拦截到fetch请求:', url);
    // 返回false可以阻止请求
    return true;
});

// 获取状态
const status = webHook.getStatus();
console.log('Hook状态:', status);
```

## 🛠️ 构建脚本功能

### 自动压缩
- 移除注释和多余空白
- 压缩变量名和函数名
- 优化代码结构

### 监听模式
```bash
npm run build-modules:watch
```
- 实时监听cp_modules目录变化
- 自动重新构建
- 支持热更新开发

### 错误处理
- 语法错误检测
- 模块依赖检查
- 构建失败回滚

## 🎨 开发最佳实践

### 1. 模块命名规范
- 使用小写字母和连字符: `my-module`
- 避免与现有模块冲突
- 保持语义化命名

### 2. 模块结构规范
```javascript
!function () {
    // 私有变量和函数
    const privateVar = 'private';
    
    function privateFunction() {
        // 私有逻辑
    }
    
    // 公共API
    function publicFunction() {
        return privateFunction();
    }
    
    // 导出
    _exports.module['module-name'] = {
        publicFunction
    };
}();
```

### 3. 依赖管理
- 每个模块应该是独立的
- 避免模块间的直接依赖
- 通过事件或回调进行通信

### 4. 性能优化
- 保持模块代码精简
- 避免大型库的完整引入
- 使用按需加载模式

## 🔄 集成到开发流程

### package.json 脚本
```json
{
  "scripts": {
    "dev": "npm run build-modules && cd dev && npm run dev",
    "build": "npm run build-modules && cd dev && npm run build",
    "build-modules": "node build-modules.js",
    "build-modules:watch": "node build-modules.js --watch"
  }
}
```

### 开发启动
```bash
# 完整开发模式（推荐）
npm run dev

# 或者分步骤
npm run build-modules:watch  # 终端1：监听模块变化
cd dev && npm run dev        # 终端2：启动主项目开发
```

## 📝 示例：创建新模块

### 1. 创建模块目录
```bash
mkdir src/cp_modules/utils
```

### 2. 创建index.js
```javascript
// src/cp_modules/utils/index.js
!function () {
    function formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    }
    
    function randomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    _exports.module['utils'] = {
        formatDate,
        randomString
    };
}();
```

### 3. 构建和使用
```bash
# 构建模块
npm run build-modules

# 在代码中使用
await mdChrome.web.requireModule('utils');
const utils = _require('utils');
const dateStr = utils.formatDate(new Date());
const randomId = utils.randomString(12);
```

## 🐛 故障排除

### 常见问题

**Q: 模块构建失败**
A: 检查JavaScript语法，确保使用IIFE格式并正确导出

**Q: 模块加载后无法访问**
A: 确保使用`_exports.module['模块名']`正确导出

**Q: 监听模式不工作**
A: 安装chokidar依赖：`npm install chokidar --save-dev`

**Q: 压缩后代码出错**
A: 检查代码中是否有特殊字符需要转义

## 🚀 高级功能

### 条件加载
```javascript
// 根据环境加载不同模块
const moduleName = process.env.NODE_ENV === 'development' ? 'dev-utils' : 'prod-utils';
await mdChrome.web.requireModule(moduleName);
```

### 模块版本管理
```javascript
// 在模块中包含版本信息
_exports.module['my-module'] = {
    version: '1.0.0',
    functions: { ... }
};
```

## 📊 性能监控
构建脚本会显示：
- 原始代码大小
- 压缩后代码大小
- 压缩比例
- 构建时间

这套cp_modules系统让Chrome扩展开发更加模块化和可维护！🎉