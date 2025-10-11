// 共享组件库 - 参考用户的简化模式
import { createApp, h, ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  NConfigProvider,
  NLoadingBarProvider,
  NMessageProvider,
  NDialogProvider,
  NModalProvider,
  NNotificationProvider,
  NModal,
  NInput,
  NButton,
  NCheckbox,
  NProgress,
  NPagination,
  NSpace,
  NSlider,
} from 'naive-ui'

// 导入共享组件 - 只有App是共享的

// Provider包装组件
const __NProvider = ({ slots }) => {
  return h(NConfigProvider, { theme: null }, {
    default: () => h(NModalProvider, null, {
      default: () => h(NLoadingBarProvider, null, {
        default: () => h(NMessageProvider, null, {
          default: () => h(NDialogProvider, null, {
            default: () => h(NNotificationProvider, null, {
              default: () => slots.default ? slots.default() : null
            })
          })
        })
      })
    }),
  })
}

// App创建函数，参考用户的模式
const createBaseApp = (component, { props, options }) => {
  const { tag, id, style } = options || {};
  const div = document.createElement(tag || 'div');
  div.id = id || 'chrome-app'
  if (style) {
    div.style.cssText = style
  }

  // 创建应用实例
  const app = createApp({
    render() {
      return h(__NProvider, {
        slots: {
          default: () => h(component, props || {})
        }
      })
    }
  });

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

  // 挂载应用
  app.mount(div);
  app.__el__ = div;
  console.log('✅ Vue应用创建成功，响应式系统已启用', app);
  return app
}
// 创建共享组件库对象
const MdUiComponent = {
  // Vue相关 - 确保使用同一个Vue实例的响应式系统
  createApp,
  h,
  ref,
  reactive,
  computed,
  onMounted,
  onUnmounted,
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
    createBaseApp: createBaseApp
  }
}

// 挂载到全局，类似原来的方式
window['MdUiComponent'] = MdUiComponent

// 也支持ES模块导出
export default MdUiComponent