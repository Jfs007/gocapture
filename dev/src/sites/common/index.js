// 共享组件库 - 参考用户的简化模式
import { createApp, h } from 'vue'
import {
  NConfigProvider,
  NLoadingBarProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  NModal,
  NInput,
  NButton,
  NCheckbox,
  NProgress,
  NPagination,
  NSpace,
  NSlider
} from 'naive-ui'

// 导入共享组件 - 只有App是共享的

// Provider包装组件
const __NProvider = ({ slots, props }) => {
  return h(NConfigProvider, { theme: null }, {
    default: () => h(NLoadingBarProvider, null, {
      default: () => h(NMessageProvider, null, {
        default: () => h(NDialogProvider, null, {
          default: () => h(NNotificationProvider, null, slots)
        })
      })
    })
  })
}

// App创建函数，参考用户的模式
const App = ({ props, slots, options }) => {
  const { tag, id, style } = options || {}
  const div = document.createElement(tag || 'div')
  div.id = id || 'chrome-app'
  if (style) {
    div.style.cssText = style
  }
  const app = createApp(__NProvider({
    slots,
    props
  }))
  
  // 全局注册NaiveUI组件
  app.component('NConfigProvider', NConfigProvider)
  app.component('NLoadingBarProvider', NLoadingBarProvider)
  app.component('NMessageProvider', NMessageProvider)
  app.component('NDialogProvider', NDialogProvider)
  app.component('NNotificationProvider', NNotificationProvider)
  app.component('NModal', NModal)
  app.component('NInput', NInput)
  app.component('NButton', NButton)
  app.component('NCheckbox', NCheckbox)
  app.component('NProgress', NProgress)
  app.component('NPagination', NPagination)
  app.component('NSpace', NSpace)
  app.component('NSlider', NSlider)
  
  
  app.mount(div)
  app.__el__ = div
  return app
}

// 创建共享组件库对象
const MdUiComponent = {
  // Vue相关
  createApp,
  h,
  // NaiveUI组件
  NaiveUI: {
    NConfigProvider,
    NLoadingBarProvider,
    NMessageProvider,
    NDialogProvider,
    NNotificationProvider,
    NModal,
    NInput,
    NButton,
    NCheckbox,
    NProgress,
    NPagination,
    NSpace,
    NSlider
  },
  
  // 共享组件
  Components: {
    App
  }
}

// 挂载到全局，类似原来的方式
window['MdUiComponent'] = MdUiComponent

// 也支持ES模块导出
export default MdUiComponent