// Compass站点 - 使用共享组件库
const initCompassApp = async () => {
  console.log('🚀 Compass站点初始化...')
  
  // 获取mdChrome依赖  
  const mdChrome = _require('mdChrome')
  
  // 使用新的异步injectScript，并行加载依赖文件
  try {
    // await Promise.all([
      
    //   mdChrome.web.injectScript('other/jszip.min.js'), 
    //   mdChrome.web.injectScript('other/FileSaver.js')
    // ])
    console.log('✅ 依赖文件注入成功')
    // 加载cp_modules模块
    await Promise.all([
      mdChrome.web.requireModule('loadsh'),
      mdChrome.web.requireModule('store')
    ])
    console.log('✅ cp_modules加载成功')
    
  } catch (error) {
    console.error('❌ 依赖加载失败:', error)
    return
  }

  // 初始化全局变量
  window.__PRODUCT_INFO__ = window.__PRODUCT_INFO__ || {}

  // 直接使用共享组件库
  const MdUiComponent = window['MdUiComponent']
  
  if (!MdUiComponent) {
    console.error('❌ MdUiComponent未加载')
    return
  }
  
  console.log('📦 共享组件库已加载:', MdUiComponent)
  console.log('📦 可用组件:', Object.keys(MdUiComponent.Components))
  
  // 等待DOM加载
  setTimeout(() => {
    console.log('🔧 开始创建Vue应用...')
    
    // 使用cp_modules中的工具函数
    const loadsh = _require('loadsh') 
    const store = _require('store')
    
    console.log('📦 cp_modules已可用:')
    console.log('  - loadsh工具函数:', Object.keys(loadsh))
    console.log('  - store状态管理:', typeof store)
    
    // 示例：使用loadsh工具函数
    loadsh.showToast({ message: '🎉 Compass应用启动成功!' })
    
    // 示例：使用getProperty函数
    const testData = { a: { b: { c: 'hello world' } } }
    const value = loadsh.getProperty(testData, 'a.b.c')
    console.log('📝 loadsh.getProperty示例:', value)
    
    // 创建应用容器
    const appContainer = document.createElement('div')
    appContainer.id = 'compass-vue-app'
    appContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `
    document.body.appendChild(appContainer)
    console.log('✅ 容器已创建')
    
    // 使用你的App模式创建应用
    const { App, h } = MdUiComponent
    const { FloatingToolbox } = MdUiComponent.Components
    
    console.log('🔧 使用App模式创建应用...')
    
    const app = App({
      slots: {
        default: () => [
         
          // FloatingToolbox组件
          h(FloatingToolbox, {
            onOpenModal: () => console.log('打开模态框')
          })
        ]
      },
      options: {
        id: 'compass-vue-app',
        style: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; pointer-events: none;'
      }
    })
    
    // 将应用元素添加到页面
    document.body.appendChild(app.__el__)
    
    console.log('✅ App模式应用创建成功!')
    
    // 添加样式让子组件可交互
    const style = document.createElement('style')
    style.textContent = `
      .compass-app > * {
        pointer-events: auto !important;
      }
    `
    document.head.appendChild(style)
    
    console.log('🎉 Compass应用创建完成!')
  }, 500)
}

// 页面加载完成后初始化 (支持异步)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initCompassApp())
} else {
  initCompassApp()
}