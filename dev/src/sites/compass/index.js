// Compass 站点入口 - 使用共享组件库
// 类似原来的使用方式

// 等待共享组件库加载
const waitForMdUiComponent = () => {
  return new Promise((resolve) => {
    if (window['MdUiComponent']) {
      resolve(window['MdUiComponent'])
      return
    }
    
    // 轮询等待
    const check = () => {
      if (window['MdUiComponent']) {
        resolve(window['MdUiComponent'])
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}

// 初始化Compass应用
const initCompassApp = async () => {
  console.log('1');
  
  // 获取mdChrome依赖（保持原有的依赖系统）
  const mdChrome = _require('mdChrome')
  
  // 注入必要的脚本（保持原有的注入逻辑）
  mdChrome.web.injectScript('hack_scripts/web-request.js')
  mdChrome.web.injectScript('other/jszip.min.js')
  mdChrome.web.injectScript('other/FileSaver.js')

  // 初始化全局变量
  window.__PRODUCT_INFO__ = window.__PRODUCT_INFO__ || {}

  // 等待共享组件库加载
  const MdUiComponent = await waitForMdUiComponent()
  
  // 等待第三方库加载完成
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
    
    // 创建Compass应用组件
    const CompassApp = {
      template: `
        <div class="compass-app">
          <floating-toolbox @open-modal="showModal = true" />
          <video-modal v-model:show="showModal" />
        </div>
      `,
      components: {
        FloatingToolbox: MdUiComponent.Components.FloatingToolbox,
        VideoModal: MdUiComponent.Components.VideoModal
      },
      data() {
        return {
          showModal: false
        }
      }
    }
    
    // 使用共享组件库创建应用
    const app = MdUiComponent.createProviderApp(CompassApp, '#compass-vue-app')
    
    console.log('🎉 Compass Vue应用启动成功!')
  }, 200)
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCompassApp)
} else {
  initCompassApp()
}