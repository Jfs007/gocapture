# Chrome 扩展开发指南

## 项目结构

```
shop-chrome-plugins/
├── main-site/          # iframe页面插件会加载该地址，见package/manifest.json env配置项
│   ├── src/                      # Vue源码目录
│   ├── package.json              # 开发依赖
│   ├── vite.config.js            # 构建配置
│   └── node_modules/             # 开发依赖包
├──package/             # 📦 Chrome扩展包 (可直接使用)
│   ├── app/                       # 脚本文件
│   │   └── compass.jinritemai.com.js  # 构建输出
│   ├── manifest.json             # 扩展清单
│   ├── other/                    # 第三方库
│   └── ... (其他运行时文件)
└── README.md                     # 项目说明
```

## 🚀 快速开始

### 启动iframe静态页

```bash
cd main-site
yarn dev
```

### 切换环境

```bash
cd scripts
### 切换为本地开发环境，见update-env.js envConfigs 配置
node ./update-env.js local 
```

## 📋 配置说明

### package/app/config.json

`config.json` 是插件动态脚本加载的核心配置文件，控制哪些 JS 文件在何时何地被加载执行。

#### 配置结构

```json
{
    "result": {
        "cssUrls": [],
        "jsUrls": [
            "common/index.js",
            "ldd/index.js",
            "1688/index.js"
        ]
    },
    "rules": {
        "ldd/index.js": {
            "supportIframe": false,
            "matches": [
                "*localhost:9002",
                "*ad.itaored.com"
            ]
        },
        "1688/index.js": {
            "supportIframe": false,
            "matches": [
                "*.1688.com"
            ]
        }
    },
    "canInjectIframeList": ["https://search.1688.com"],
    "version": "20260303.141152",
    "success": true,
    "api": ""
}
```

#### 字段说明

##### 1. `result` - 动态加载文件列表

定义哪些文件会被动态加载到页面中。

- **`cssUrls`**: CSS 文件列表（相对于 app 目录的路径）
- **`jsUrls`**: JS 文件列表（相对于 app 目录的路径）

**示例**：
```json
"jsUrls": [
    "common/index.js",    // 通用脚本
    "ldd/index.js",       // 量多多相关脚本
    "1688/index.js"       // 1688 相关脚本
]
```

##### 2. `rules` - 加载规则配置

为每个脚本文件定义加载规则和限制条件。

**字段说明**：

- **`supportIframe`** (boolean)
  - `true`: 脚本会在 iframe 中加载
  - `false`: 脚本不会在 iframe 中加载

- **`matches`** (array) - 白名单地址
  - **不填写**：脚本在任意网页均加载
  - **填写**：脚本仅在匹配的地址加载执行
  - 支持通配符 `*`

**示例**：
```json
"ldd/index.js": {
    "supportIframe": false,
    "matches": [
        "*localhost:9002",      // 本地开发环境
        "*ad.itaored.com"       // 生产环境
    ]
}
```

```json
"1688/index.js": {
    "supportIframe": false,
    "matches": [
        "*.1688.com"            // 仅在 1688.com 域名下加载
    ]
}
```

##### 3. `version` - 版本控制

控制脚本缓存机制的关键字段。

- **版本改变**：所有 JS 文件会重新加载运行
- **版本不变**：JS 文件在首次加载后被缓存在插件内存中，刷新页面时从内存加载，而不是从网络重新获取

**格式**：`YYYYMMDD.HHMMSS`（时间戳格式）

**示例**：
```json
"version": "20260303.141152"  // 2026年3月3日 14:11:52
```

> **提示**：执行 `node scripts/update-env.js` 时会自动更新 version 为当前时间戳。

##### 4. `canInjectIframeList` - iframe 注入白名单

指定哪些 iframe 地址允许注入脚本。

```json
"canInjectIframeList": ["https://search.1688.com"]
```

### 脚本加载机制

#### 加载路径配置

脚本的加载路径由 `scripts/update-env.js` 中的环境配置决定：

```javascript
const envConfigs = {
  prod: {
    source: "https://cdn.itaored.com/static/fed/ldd-pro-chrome-plugin/",
    api: "https://ad.itaored.com/",
    site: "https://ad-cdn.itaored.com/prod/ad/index.html",
    env: "prod"
  },
  dev: {
    source: "https://cdn.itaored.com/static/fed/testldd-pro-chrome-plugin/",
    api: "https://testad.itaored.com/",
    site: "https://ad-cdn.itaored.com/dev/ad/index.html",
    env: "dev"
  },
  local: {
    source: "https://cdn.itaored.com/static/fed/testldd-pro-chrome-plugin/",
    api: "https://testad.itaored.com/",
    site: "http://localhost:3000/",
    env: "local"
  }
};
```

#### 环境模式

**Local 环境（本地开发）**：
- `app_module` 设置为 `Offline`
- 脚本从本地项目目录 `package/app` 获取
- 适合本地开发调试

**其他环境（dev/prod）**：
- `app_module` 设置为 `Online`
- 脚本从配置的 `source` 地址获取
- 适合线上部署

#### 切换环境

```bash
# 切换到本地开发环境
node scripts/update-env.js local

# 切换到开发环境
node scripts/update-env.js dev

# 切换到生产环境
node scripts/update-env.js prod
```

执行环境切换时会自动：
1. 更新 `manifest.json` 中的环境配置
2. 更新 `config.json` 的 version（触发脚本重新加载）
3. 打包生成 `package.zip`

### 最佳实践

1. **开发调试**：使用 `local` 环境，脚本从本地加载，修改即时生效
2. **版本控制**：重要更新时手动修改 version 或执行环境切换脚本
3. **白名单配置**：为特定功能脚本配置 matches，避免在不必要的页面加载
4. **iframe 控制**：根据实际需求设置 supportIframe，优化性能
5. **缓存管理**：开发时可通过修改 version 强制刷新缓存




