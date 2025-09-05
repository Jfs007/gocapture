// 共享组件库 - 类似原来的 window['MdUiComponent']
import { createApp } from 'vue'
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

// 导入共享组件
import FloatingToolbox from '../../shared/components/FloatingToolbox.vue'
import VideoModal from '../../shared/components/VideoModal.vue'
import VideoCard from '../../shared/components/VideoCard.vue'
import ProductGroup from '../../shared/components/ProductGroup.vue'
import SettingsModal from '../../shared/components/SettingsModal.vue'

// 导入组合式函数
import { useVideoData } from '../../shared/composables/useVideoData.js'
import { useDownload } from '../../shared/composables/useDownload.js'

// 导入工具函数
import { useLibs } from '../../shared/utils/libs.js'
import { EventBridge, eventBridge } from '../../shared/utils/eventBridge.js'

// 创建共享组件库对象
const MdUiComponent = {
  // Vue相关
  createApp,
  
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
  
  // 业务组件
  Components: {
    FloatingToolbox,
    VideoModal,
    VideoCard,
    ProductGroup,
    SettingsModal
  },
  
  // 组合式函数
  Composables: {
    useVideoData,
    useDownload
  },
  
  // 工具函数
  Utils: {
    useLibs,
    EventBridge,
    eventBridge
  },
  
  // 创建应用的便捷方法
  createComponentApp(component, container) {
    const app = createApp(component)
    app.mount(container)
    return app
  },
  
  // 创建完整的Provider包装应用
  createProviderApp(component, container) {
    const ProviderWrapper = {
      template: `
        <n-config-provider :theme="null">
          <n-loading-bar-provider>
            <n-message-provider>
              <n-dialog-provider>
                <n-notification-provider>
                  <component :is="component" />
                </n-notification-provider>
              </n-dialog-provider>
            </n-message-provider>
          </n-loading-bar-provider>
        </n-config-provider>
      `,
      components: {
        NConfigProvider,
        NLoadingBarProvider,
        NMessageProvider,
        NDialogProvider,
        NNotificationProvider
      },
      data() {
        return { component }
      }
    }
    
    const app = createApp(ProviderWrapper)
    app.mount(container)
    return app
  }
}

// 挂载到全局，类似原来的方式
window['MdUiComponent'] = MdUiComponent

// 也支持ES模块导出
export default MdUiComponent