# Chrome 扩展开发指南

## 项目结构

```
shop-chrome-plugins/
├── dev/                          # 🔧 开发环境
│   ├── src/                      # Vue源码目录
│   │   ├── components/           # Vue组件
│   │   ├── composables/          # 组合式函数
│   │   ├── utils/                # 工具函数
│   │   └── content-scripts/      # 内容脚本入口
│   ├── package.json              # 开发依赖
│   ├── vite.config.js            # 构建配置
│   └── node_modules/             # 开发依赖包
├── chrome-extension/             # 📦 Chrome扩展包 (可直接使用)
│   ├── js/                       # 脚本文件
│   │   └── compass.jinritemai.com.js  # 构建输出
│   ├── manifest.json             # 扩展清单
│   ├── other/                    # 第三方库
│   ├── hack_scripts/             # 注入脚本
│   └── ... (其他运行时文件)
└── README.md                     # 项目说明
```

## 🚀 快速开始

### 开发模式 (实时构建)
```bash
cd dev
npm run dev
```
- ✅ 自动监听文件变化
- ✅ 实时编译到 `../chrome-extension/js/`
- ✅ 可直接在Chrome中测试扩展
- ✅ 无需手动复制文件

### 生产构建
```bash
cd dev
npm run build:size
```
- ✅ 最优化压缩
- ✅ 移除开发工具代码
- ✅ 显示文件大小信息

## 🔥 主要优势

### 1. 完全分离的开发环境
- **开发代码** (`dev/`) 与 **扩展包** (`chrome-extension/`) 完全独立
- 扩展包可以直接使用，无需删除开发文件
- 项目结构清晰，维护方便

### 2. 实时开发体验
- 保存即构建，无需手动复制
- 在Chrome中加载 `chrome-extension/` 目录
- 代码变更后刷新页面即可看到效果

### 3. 最小化文件体积
- 生产构建：`481KB` (gzip: 146KB)
- 移除Vue开发工具
- 移除console.log和debugger
- 使用esbuild快速压缩

### 4. 保持完美兼容
- ✅ 保持原有 `_require('mdChrome')` 系统
- ✅ 保持原有脚本注入机制
- ✅ 保持原有API拦截逻辑
- ✅ 其他内容脚本不受影响

## 📝 开发工作流

### 日常开发
```bash
# 1. 启动开发模式
cd dev && npm run dev

# 2. 在Chrome中加载扩展
# 扩展管理 → 加载已解压的扩展程序 → 选择 chrome-extension/ 目录

# 3. 修改代码，自动构建到扩展包

# 4. 刷新页面测试
```

### 发布准备
```bash
# 1. 生产构建
cd dev && npm run build

# 2. 打包扩展
zip -r extension.zip chrome-extension/

# 3. 上传到Chrome商店
```

## 🛠️ 技术架构

### Vue组件架构
```
CompassApp.vue (主应用)
├── FloatingToolbox.vue (悬浮工具箱)
└── VideoModal.vue (视频弹窗)
    ├── ProductGroup.vue (商品分组)
    │   └── VideoCard.vue (视频卡片)
    └── SettingsModal.vue (设置弹窗)
```

### 数据流
```
web-request.js → eventBridge → useVideoData → Vue组件
```

### 第三方库集成
```javascript
// 使用other/目录中的库
import { useLibs } from '@/utils/libs'

const { JSZip, saveAs, checkLibs } = useLibs()
if (checkLibs(['JSZip', 'saveAs'])) {
  // 使用库
}
```

## 🎯 功能对比

| 功能特性 | 原版(h函数) | Vue版(SFC) |
|---------|------------|-----------|
| 代码可读性 | ❌ 很差 | ✅ 很好 |
| 开发效率 | ❌ 低 | ✅ 高 |
| 组件复用 | ❌ 困难 | ✅ 容易 |
| 调试体验 | ❌ 困难 | ✅ 友好 |
| 文件大小 | 🟡 62KB | 🟡 481KB |
| 功能完整性 | ✅ 完整 | ✅ 完整 |
| 运行性能 | ✅ 优秀 | ✅ 优秀 |

## ⚙️ 构建优化

### 已启用的优化
- `esbuild` 压缩器 (最快)
- 移除 Vue DevTools
- 移除 console.log (生产环境)
- CSS 压缩
- 外部化 mdChrome 依赖
- 关闭 sourcemap

### 文件大小分析
- **Vue + NaiveUI**: ~400KB
- **业务逻辑**: ~80KB
- **总计**: 481KB (gzip: 146KB)

## 🔧 配置说明

### Vite配置特点
- 直接输出到 `chrome-extension/js/`
- IIFE格式兼容Chrome扩展
- 外部化mdChrome依赖
- 针对Chrome89优化

### 开发依赖
- Vue 3 + Composition API
- NaiveUI 组件库
- Vite 构建工具
- 仅开发时需要

## 🐛 故障排除

### 常见问题
1. **构建失败**: 检查是否在 `dev/` 目录下运行命令
2. **扩展不工作**: 确保在Chrome中加载 `chrome-extension/` 目录
3. **库未加载**: 检查 `other/` 目录中的库文件

### 调试方法
```javascript
// 浏览器控制台
console.log('扩展状态:', window.__VUE_APP_STATE__)
console.log('视频数据:', window.__PRODUCT_INFO__)
```

## 📊 性能指标

### 构建速度
- 开发构建: ~2s
- 生产构建: ~2s
- 增量构建: ~0.5s

### 运行时性能
- 初始化时间: ~200ms
- 内存占用: ~10MB
- CPU使用率: 极低

---

**🎉 现在你可以享受现代化的Vue开发体验，同时保持Chrome扩展的完美兼容性！**