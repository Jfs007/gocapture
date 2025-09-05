// Compass 抖音商家平台 - Vue版本
import { createApp } from 'vue'
import CompassApp from '../components/CompassApp.vue'

// 等待DOM加载完成
const initApp = () => {
  // 获取mdChrome依赖（保持原有的依赖系统）
  const mdChrome = _require('mdChrome')
  
  // 注入必要的脚本（保持原有的注入逻辑）
  mdChrome.web.injectScript('hack_scripts/web-request.js')
  mdChrome.web.injectScript('other/jszip.min.js')
  mdChrome.web.injectScript('other/FileSaver.js')

  // 初始化全局变量
  window.__PRODUCT_INFO__ = window.__PRODUCT_INFO__ || {}

  // 等待库加载完成后创建Vue应用
  setTimeout(() => {
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
    
    // 挂载到body
    document.body.appendChild(appContainer)
    
    // 创建Vue应用
    const app = createApp(CompassApp)
    app.mount('#compass-vue-app')
    
    console.log('🎉 Compass Vue应用启动成功!')
  }, 200) // 给库加载一些时间
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp)
} else {
  initApp()
}