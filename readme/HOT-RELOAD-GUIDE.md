# 🔥 Chrome扩展热更新系统使用指南

## 概述

这是一个为Chrome扩展设计的热更新系统，支持两种模式：
- **本地app化**: 从扩展包app目录读取热更新代码
- **远程app化**: 通过远程配置API获取热更新代码

## 🏗️ 系统架构

```
src/
├── app/                    # 热更新包目录
│   ├── config.js          # 热更新配置
│   ├── shared/            # 共享组件
│   │   └── md-ui-component.js
│   └── sites/             # 站点文件
│       └── compass.jinritemai.com.js
├── js/
│   ├── service-worker.js   # 增强版service-worker
│   ├── hot-reload-manager.js # 热更新管理器
│   └── hot-reload-client.js  # 热更新客户端
└── manifest.json

dev/
├── src/                   # 源代码
├── build-hot.js          # 热更新构建脚本
└── vite.config.js        # 支持热更新输出
```

## 🚀 快速开始

### 1. 开发模式 - 热更新监听

```bash
cd dev

# 启动热更新开发模式（文件变更时自动重构建到app目录）
npm run hot:dev

# 或者一次性构建到app目录
npm run hot:build
```

### 2. 生产模式 - 构建到js目录

```bash
# 构建生产版本到js目录
npm run build

# 或者构建生产版本的热更新包
npm run hot:prod
```

## ⚙️ 配置说明

### app/config.js 配置文件

```javascript
const HotReloadConfig = {
  // 热更新模式: 'local' | 'remote'
  mode: 'local',
  
  // 本地模式配置
  local: {
    // 共享组件库路径
    'md-ui-component': './shared/md-ui-component.js',
    
    // 站点文件映射
    sites: {
      'compass.jinritemai.com': './sites/compass.jinritemai.com.js'
    }
  },
  
  // 远程模式配置  
  remote: {
    configUrl: null, // 通过GetConfigUrl()动态获取
    cache: {
      enabled: true,
      ttl: 300000 // 5分钟缓存
    }
  },
  
  // 开发设置
  dev: {
    enableLog: true,
    checkInterval: 1000,    // 检查间隔（毫秒）
    fileWatcher: {
      enabled: true,
      debounce: 500
    }
  }
};
```

### manifest.json 配置

需要确保service-worker和热更新文件正确加载：

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["js/hot-reload-client.js"],
      "run_at": "document_start"
    }
  ]
}
```

## 📋 使用方法

### 本地app化模式

1. **设置配置文件**
   ```javascript
   // app/config.js
   const HotReloadConfig = {
     mode: 'local',
     // ... 其他配置
   };
   ```

2. **启动开发构建**
   ```bash
   npm run hot:dev
   ```

3. **安装Chrome扩展**
   - 加载`src`目录
   - service-worker会自动启动热更新监听

4. **开发调试**
   - 修改`dev/src`下的源代码
   - 构建系统自动更新`app`目录
   - 热更新管理器检测变更并注入新代码

### 远程app化模式

1. **设置配置文件**
   ```javascript
   // app/config.js
   const HotReloadConfig = {
     mode: 'remote',
     remote: {
       configUrl: null, // 使用默认的GetConfigUrl逻辑
       cache: { enabled: true, ttl: 300000 }
     }
   };
   ```

2. **远程服务配置**
   - 服务端需要提供配置API（复用现有的GetConfigUrl）
   - 返回格式包含`jsUrls`数组，指向远程代码文件

3. **部署和更新**
   - 构建生产版本: `npm run hot:prod`
   - 将生成的文件上传到远程服务器
   - 更新配置API返回新的文件URLs

## 🛠️ API接口

### 热更新管理器 (Service Worker)

```javascript
// 初始化热更新
chrome.runtime.sendMessage({
  cmd: 'hot-reload',
  action: 'init'
});

// 检查更新
chrome.runtime.sendMessage({
  cmd: 'hot-reload', 
  action: 'check'
});

// 应用更新
chrome.runtime.sendMessage({
  cmd: 'hot-reload',
  action: 'apply',
  code: 'console.log("Hello Hot Reload");'
});
```

### 热更新客户端 (Content Script)

```javascript
// 手动检查更新
window.hotReloadClient.forceCheck();

// 启用/禁用热更新
window.hotReloadClient.setEnabled(true);

// 监听热更新事件
window.addEventListener('hot-reload-applied', (event) => {
  console.log('代码已更新:', event.detail);
});
```

## 📁 文件输出

### 开发模式输出

```
src/app/
├── shared/
│   ├── md-ui-component.js      # 共享组件库（含source map）
│   └── md-ui-component.js.map
└── sites/
    ├── compass.jinritemai.com.js    # 站点文件（含source map）  
    └── compass.jinritemai.com.js.map
```

### 生产模式输出

```
src/js/
├── md-ui-component.js          # 压缩版共享组件库
└── compass.jinritemai.com.js   # 压缩版站点文件
```

## 🎯 添加新站点

1. **创建源文件**
   ```bash
   mkdir -p dev/src/sites/new-site
   touch dev/src/sites/new-site/index.js
   ```

2. **更新构建配置**
   ```javascript
   // dev/build-hot.js
   const buildTargets = [
     // ... 现有配置
     {
       name: '新站点',
       target: 'new-site',
       outputName: 'sites/new-site.com.js',
       emoji: '🎯'
     }
   ];
   ```

3. **更新Vite配置**
   ```javascript
   // dev/vite.config.js
   entryFileNames: (chunkInfo) => {
     if (process.env.HOT_RELOAD_MODE === 'app') {
       if (chunkInfo.name === 'new-site') {
         return 'sites/new-site.com.js';
       }
     }
     return '[name].js';
   }
   ```

4. **更新热更新配置**
   ```javascript
   // src/app/config.js
   local: {
     sites: {
       'compass.jinritemai.com': './sites/compass.jinritemai.com.js',
       'new-site.com': './sites/new-site.com.js'
     }
   }
   ```

## 🔍 调试和日志

### 开启调试日志

```javascript
// app/config.js
const HotReloadConfig = {
  dev: {
    enableLog: true  // 启用详细日志
  }
};
```

### 查看日志

- **Service Worker**: Chrome DevTools → Application → Service Workers
- **Content Script**: Chrome DevTools → Console
- **构建日志**: 终端输出

### 常见问题

1. **文件不更新**: 检查构建脚本是否正在运行
2. **权限错误**: 确保manifest.json包含必要的权限
3. **缓存问题**: 重启Chrome扩展或清除缓存

## 📈 性能优化

- **本地模式**: 文件检查间隔建议1-2秒
- **远程模式**: 检查间隔建议10-30秒
- **缓存策略**: 启用缓存减少网络请求
- **文件大小**: 开发版本包含source map，生产版本压缩

## 🚀 部署流程

### 开发环境
```bash
npm run hot:dev    # 启动热更新开发
```

### 测试环境  
```bash
npm run hot:build  # 构建测试版本到app目录
```

### 生产环境
```bash
npm run build      # 构建生产版本到js目录
```

这个热更新系统让Chrome扩展开发变得更加高效，支持实时代码更新而无需重新加载扩展！🎉