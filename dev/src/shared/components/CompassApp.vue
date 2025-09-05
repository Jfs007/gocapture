<template>
  <n-config-provider :theme="theme">
    <n-loading-bar-provider>
      <n-message-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <div class="compass-app">
              <!-- 悬浮工具箱 -->
              <floating-toolbox @open-modal="showModal = true" />
              
              <!-- 视频展示弹窗 -->
              <video-modal v-model:show="showModal" />
            </div>
          </n-notification-provider>
        </n-dialog-provider>
      </n-message-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<script setup>
import { ref } from 'vue'
import {
  NConfigProvider,
  NLoadingBarProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider
} from 'naive-ui'
import FloatingToolbox from './FloatingToolbox.vue'
import VideoModal from './VideoModal.vue'

// 主题配置
const theme = null // 使用默认主题

// 弹窗状态
const showModal = ref(false)
</script>

<style>
/* 全局样式重置，确保不影响页面其他内容 */
.compass-app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 确保弹窗样式不被页面CSS干扰 */
.compass-app .n-modal-container {
  font-family: inherit;
}

.compass-app * {
  box-sizing: border-box;
}
</style>