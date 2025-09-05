# Vue + Vite 开发指南

## 项目结构

```
shop-chrome-plugins/
├── src/                          # Vue源码目录
│   ├── components/               # Vue组件
│   │   ├── CompassApp.vue       # 主应用组件
│   │   ├── FloatingToolbox.vue  # 悬浮工具箱
│   │   ├── VideoModal.vue       # 视频展示弹窗
│   │   ├── VideoCard.vue        # 视频卡片
│   │   ├── ProductGroup.vue     # 商品分组
│   │   └── SettingsModal.vue    # 设置弹窗
│   ├── composables/             # 组合式函数
│   │   ├── useVideoData.js      # 视频数据管理
│   │   └── useDownload.js       # 下载功能
│   ├── utils/                   # 工具函数
│   │   ├── libs.js              # 第三方库封装
│   │   └── eventBridge.js       # 事件桥接器
│   └── content-scripts/         # 内容脚本入口
│       └── compass.jinritemai.com.js
├── dist/                        # 构建输出
└── js/                          # Chrome扩展文件目录
    └── compass.jinritemai.com.js # 实际运行的文件
```

## 开发命令

### 开发模式（实时构建）
```bash
npm run dev
```
- 自动监听文件变化
- 实时编译到 `dist/js/compass.js`
- 需要手动复制到 `js/` 目录或设置符号链接

### 生产构建
```bash
npm run build
```
- 构建优化版本
- 输出到 `dist/js/compass.js`

### 部署到Chrome扩展
```bash
# 方式1: 手动复制
cp dist/js/compass.js js/compass.jinritemai.com.js

# 方式2: 创建符号链接（推荐开发时使用）
ln -sf ../dist/js/compass.js js/compass.jinritemai.com.js
```

## 架构说明

### 1. 保持兼容性
- ✅ 保持原有的 `_require('mdChrome')` 依赖系统
- ✅ 保持原有的脚本注入逻辑 (`web-request.js`, `jszip.min.js` 等)
- ✅ 保持原有的消息监听机制
- ✅ 其他content scripts不受影响

### 2. Vue集成
- 使用Vue 3 + Composition API
- NaiveUI作为UI组件库
- 响应式数据管理
- 组件化开发

### 3. 第三方库使用
```javascript
// 在Vue组件中使用other/目录的库
import { useLibs } from '@/utils/libs'

const { JSZip, saveAs, checkLibs } = useLibs()

// 检查库是否加载
if (checkLibs(['JSZip', 'saveAs'])) {
  const zip = new (JSZip())()
  // ...
}
```

### 4. 数据流
```
web-request.js → eventBridge → useVideoData → Vue组件
```

## 开发建议

### 组件开发
1. 使用 `.vue` 单文件组件
2. 优先使用 Composition API
3. 抽取可复用逻辑到 composables
4. 样式使用 scoped 避免冲突

### 调试
1. 在Chrome开发者工具中查看Vue DevTools
2. console.log输出会显示在页面的控制台
3. 构建错误会显示在终端

### 新增功能
1. 在 `src/components/` 中添加新组件
2. 在 `src/composables/` 中添加业务逻辑
3. 在 `src/utils/` 中添加工具函数
4. 运行 `npm run build` 构建
5. 复制到 `js/` 目录测试

## 性能优化

### 已实现的优化
- 分页显示（50个视频/页）
- 虚拟滚动支持
- 批量下载分包处理
- 可配置的并发控制

### 构建优化
- Tree shaking自动移除未使用代码
- 代码分离和懒加载
- 生产环境代码压缩

## 故障排除

### 常见问题
1. **库未加载错误**: 确保 `other/` 目录中的库文件存在
2. **_require未定义**: 确保在Chrome扩展环境中运行
3. **消息监听失效**: 检查 `web-request.js` 是否正确注入

### 开发调试
```javascript
// 在浏览器控制台检查
console.log('Vue应用状态:', window.__VUE_APP_STATE__)
console.log('视频数据:', window.__PRODUCT_INFO__)
```

## 迁移对比

| 功能 | 原版(h函数) | Vue版(SFC) |
|------|-------------|------------|
| 代码可读性 | ❌ 很差 | ✅ 很好 |
| 组件复用 | ❌ 困难 | ✅ 容易 |
| 类型提示 | ❌ 无 | ✅ 完整 |
| 调试体验 | ❌ 困难 | ✅ 友好 |
| 开发效率 | ❌ 低 | ✅ 高 |
| 功能完整性 | ✅ 完整 | ✅ 完整 |
| 性能 | ✅ 相同 | ✅ 相同 |

改造完成！🎉