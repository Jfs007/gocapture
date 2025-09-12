# Chrome 扩展开发指南

## 项目结构

```
shop-chrome-plugins/
├── vue/                          # 🔧 开发环境
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

### 开发模式 (实时构建)

```bash
cd dev
npm run dev
```

- ✅ 自动监听文件变化
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

### 1. 实时开发体验

- 保存即构建，无需手动复制
- 在Chrome中加载 `package/` 目录
- 代码变更后刷新页面即可看到效果

### 2. 保持完美兼容

- ✅ 保持 `_require('mdChrome')` 系统
- ✅ 保持原有脚本注入机制
- ✅ 保持原有API拦截逻辑
- ✅ 其他内容脚本不受影响
## 📝 开发工作流

### 日常开发

```bash
# 1. 启动开发模式
cd dev && npm run dev

# 2. 在Chrome中加载扩展
# 扩展管理 → 加载已解压的扩展程序 → 选择 package/ 目录

# 3. 修改代码，自动构建到扩展包

# 4. 刷新页面测试
```




