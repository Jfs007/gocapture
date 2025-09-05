# 🏗️ 代码共享架构方案

## 问题分析

你提到的代码重复问题确实存在：
- 如果多个站点都用Vue组件，会重复打包相同代码
- 原来用 `window['MdUiComponent']` 方式避免了这个问题

## 🎯 最佳解决方案

### 方案一：预加载共享库 (推荐)

```
chrome-extension/
├── js/
│   ├── md-ui-component.js      # 共享组件库 (~450KB) 
│   ├── compass.jinritemai.com.js   # Compass站点逻辑 (~20KB)
│   ├── other-site.com.js       # 其他站点逻辑 (~15KB)
│   └── ...
```

**优点：**
- ✅ 共享代码只加载一次
- ✅ 各站点文件很小 
- ✅ 类似原来的 `window['MdUiComponent']` 模式
- ✅ 易于维护和扩展

**实现方式：**
```javascript
// manifest.json 中预加载共享库
{
  "content_scripts": [
    {
      "matches": ["https://compass.jinritemai.com/*"],
      "js": ["js/md-ui-component.js", "js/compass.jinritemai.com.js"],
      "run_at": "document_end"
    },
    {
      "matches": ["https://other-site.com/*"],
      "js": ["js/md-ui-component.js", "js/other-site.com.js"],
      "run_at": "document_end"
    }
  ]
}

// 各站点使用
const { Components, Composables } = window['MdUiComponent']
```

### 方案二：动态导入

```javascript
// 运行时动态加载共享组件
const loadSharedComponents = async () => {
  if (!window['MdUiComponent']) {
    await import('./md-ui-component.js')
  }
  return window['MdUiComponent']
}
```

## 📊 文件大小对比

| 方案 | 共享库大小 | 站点文件大小 | 总大小(2个站点) |
|------|-----------|-------------|---------------|
| 当前(重复) | - | 481KB × 2 | **962KB** |
| 共享库方案 | 450KB | 20KB × 2 | **490KB** |
| 节省 | - | - | **472KB (49%)** |

## 🚀 实施建议

### 立即可用的方案：
1. 保持当前 `compass.jinritemai.com.js` (481KB) 
2. 新站点开发时采用共享库模式
3. 逐步重构现有站点

### 完整重构方案：
1. 将Vue组件提取到 `md-ui-component.js`
2. 各站点只保留业务逻辑
3. 通过 `window['MdUiComponent']` 访问共享组件

## 🔧 开发体验

```javascript
// 开发时 - src/sites/compass/index.js
import { createApp } from 'vue'

const MdUiComponent = window['MdUiComponent'] 
const app = MdUiComponent.createProviderApp(CompassApp, '#app')

// 构建后 - js/compass.jinritemai.com.js (20KB)
// 依赖 js/md-ui-component.js (450KB) 预先加载
```

## 💡 最终建议

考虑到你的实际需求：
1. **当前保持现有架构** - 功能完整可用
2. **未来新站点使用共享库** - 避免代码重复  
3. **逐步重构** - 有需要时再优化现有站点

这样既保证了现有功能，又为未来的扩展做好了准备！

需要我实施哪种方案？