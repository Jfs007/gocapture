# 🎯 Vue模板 + 组件共享 使用指南

## ✅ 已实现的两个需求

### 1. ✅ Vue模板代替h函数
- **之前**: 复杂的h函数嵌套 📝
- **现在**: 简洁的Vue模板语法 🎉

```javascript
// 之前的h函数写法 (复杂难读)
h('div', { class: 'app' }, [
  h(FloatingToolbox, { onOpenModal: () => showModal.value = true }),
  h(VideoModal, { show: showModal.value })
])

// 现在的Vue模板写法 (清晰易读)
template: `
  <div class="app">
    <floating-toolbox @open-modal="showModal = true" />
    <video-modal v-model:show="showModal" />
  </div>
`
```

### 2. ✅ 组件共享机制
- **共享库**: `md-ui-component.js` (493KB) - 包含所有Vue组件和工具
- **站点文件**: `compass.jinritemai.com.js` (1.2KB) - 只有业务逻辑
- **节省空间**: 多站点时避免重复打包

## 🚀 当前实现状态

### 📁 文件结构
```
src/
├── js/
│   ├── md-ui-component.js          # 🔧 共享组件库 (493KB)
│   └── compass.jinritemai.com.js   # 📱 Compass站点 (1.2KB)
```

### 🛠️ 开发结构  
```
dev/
├── src/
│   ├── shared/                     # 共享代码
│   │   ├── components/             # ✅ Vue SFC组件
│   │   │   ├── FloatingToolbox.vue
│   │   │   ├── VideoModal.vue
│   │   │   ├── VideoCard.vue
│   │   │   └── ...
│   │   ├── composables/            # ✅ 组合式函数
│   │   └── utils/                  # ✅ 工具函数
│   └── sites/
│       ├── shared-lib/index.js     # 🔧 共享库入口
│       └── compass/simple-index.js # 📱 站点入口
```

## 📋 使用方法

### 步骤1: 构建共享组件库
```bash
cd dev

# 修改 vite.config.js 构建共享库
input: {
  'md-ui-component': resolve(__dirname, 'src/sites/shared-lib/index.js')
}

npm run build
# ✅ 生成: src/js/md-ui-component.js (493KB)
```

### 步骤2: 开发新站点
```bash
# 修改 vite.config.js 构建站点
input: {
  'new-site.com': resolve(__dirname, 'src/sites/new-site/index.js')
}

npm run build
# ✅ 生成: src/js/new-site.com.js (~1-5KB)
```

### 步骤3: 配置manifest.json
```json
{
  "content_scripts": [
    {
      "matches": ["https://compass.jinritemai.com/*"],
      "js": [
        "js/md-ui-component.js",     // 📦 先加载共享库
        "js/compass.jinritemai.com.js" // 📱 再加载站点逻辑
      ],
      "run_at": "document_end"
    }
  ]
}
```

### 步骤4: 编写Vue模板代码
```javascript
// src/sites/new-site/index.js
const initApp = async () => {
  // 等待共享库加载
  const MdUiComponent = await waitForMdUiComponent()
  
  // 解构需要的组件
  const { createApp } = MdUiComponent
  const { FloatingToolbox, VideoModal } = MdUiComponent.Components
  
  // ✅ 使用Vue模板语法！
  const App = {
    template: `
      <div class="my-app">
        <floating-toolbox @open-modal="openModal" />
        <video-modal v-model:show="showModal" />
        <n-button type="primary" @click="handleClick">
          点击测试
        </n-button>
      </div>
    `,
    components: {
      FloatingToolbox,
      VideoModal,
      NButton: MdUiComponent.NaiveUI.NButton
    },
    data() {
      return {
        showModal: false
      }
    },
    methods: {
      openModal() {
        this.showModal = true
      },
      handleClick() {
        console.log('按钮被点击!')
      }
    }
  }
  
  // 创建应用
  const app = MdUiComponent.createProviderApp(App, '#app-container')
}
```

## 🎉 效果对比

| 方面 | 之前 h函数 | 现在 Vue模板 |
|------|-----------|------------|
| **可读性** | ❌ 很差 | ✅ 很好 |
| **开发速度** | ❌ 慢 | ✅ 快 |
| **代码重复** | ❌ 严重 | ✅ 避免 |
| **文件大小** | 481KB×N | 493KB + 1-5KB×N |
| **调试体验** | ❌ 困难 | ✅ 友好 |

## 🔧 可用的共享组件

```javascript
const MdUiComponent = window['MdUiComponent']

// Vue核心
const { createApp, ref, reactive } = MdUiComponent

// NaiveUI组件
const { NButton, NModal, NInput, NCheckbox } = MdUiComponent.NaiveUI

// 业务组件
const { FloatingToolbox, VideoModal, VideoCard } = MdUiComponent.Components

// 组合式函数
const { useVideoData, useDownload } = MdUiComponent.Composables

// 工具函数
const { useLibs, eventBridge } = MdUiComponent.Utils
```

## 🎯 总结

✅ **需求1完成**: 可以用Vue模板语法替代h函数了！
✅ **需求2完成**: 组件可以完美共享，避免重复打包！

现在你可以享受现代化的Vue开发体验，同时保持高效的组件复用！🚀