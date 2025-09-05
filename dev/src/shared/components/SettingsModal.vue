<template>
  <n-modal
    v-model:show="isVisible"
    preset="dialog"
    title="下载性能设置"
    :style="{ width: '500px' }"
  >
    <div class="settings-content">
      <n-space vertical size="large">
        <!-- 并发数设置 -->
        <div class="setting-item">
          <div class="setting-title">并发下载数</div>
          <div class="setting-desc">同时下载的文件数量，网络好可以调高，网络差建议调低</div>
          <n-slider
            v-model:value="localConfig.concurrentLimit"
            :min="1"
            :max="6"
            :step="1"
            :marks="{
              1: '1个',
              3: '3个',
              6: '6个'
            }"
          />
        </div>

        <!-- 批次延迟设置 -->
        <div class="setting-item">
          <div class="setting-title">批次间隔时间</div>
          <div class="setting-desc">每批下载之间的等待时间，避免请求过于频繁</div>
          <n-slider
            v-model:value="localConfig.batchDelay"
            :min="0"
            :max="500"
            :step="50"
            :marks="{
              0: '0ms',
              100: '100ms',
              500: '500ms'
            }"
          />
        </div>

        <!-- 压缩级别设置 -->
        <div class="setting-item">
          <div class="setting-title">压缩级别</div>
          <div class="setting-desc">压缩级别越高文件越小，但压缩时间越长</div>
          <n-slider
            v-model:value="localConfig.compressionLevel"
            :min="1"
            :max="9"
            :step="1"
            :marks="{
              1: '最快',
              6: '平衡',
              9: '最小'
            }"
          />
        </div>

        <!-- 文件数限制设置 -->
        <div class="setting-item">
          <div class="setting-title">每个压缩包文件数</div>
          <div class="setting-desc">单个压缩包包含的文件数量，避免内存溢出</div>
          <n-slider
            v-model:value="localConfig.maxFilesPerZip"
            :min="5"
            :max="30"
            :step="5"
            :marks="{
              5: '5个',
              15: '15个',
              30: '30个'
            }"
          />
        </div>

        <!-- 分页设置 -->
        <div class="setting-item">
          <div class="setting-title">每页显示视频数</div>
          <div class="setting-desc">单页显示的视频数量，影响页面性能</div>
          <n-slider
            v-model:value="localConfig.videosPerPage"
            :min="20"
            :max="100"
            :step="10"
            :marks="{
              20: '20个',
              50: '50个',
              100: '100个'
            }"
          />
        </div>
      </n-space>
    </div>

    <template #action>
      <n-space>
        <n-button @click="handleReset">
          重置默认
        </n-button>
        <n-button @click="handleCancel">
          取消
        </n-button>
        <n-button type="primary" @click="handleConfirm">
          确定
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { NModal, NSpace, NButton, NSlider } from 'naive-ui'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  config: {
    type: Object,
    required: true
  }
})

// Emits
const emit = defineEmits(['update:show', 'update:config'])

// 本地配置副本
const localConfig = ref({})

// 默认配置
const defaultConfig = {
  concurrentLimit: 3,
  batchDelay: 100,
  compressionLevel: 6,
  maxFilesPerZip: 15,
  maxZipSize: 100 * 1024 * 1024,
  videosPerPage: 50,
  enableVirtualScroll: true
}

// 计算属性
const isVisible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

// 监听显示状态，初始化本地配置
watch(() => props.show, (show) => {
  if (show) {
    localConfig.value = { ...props.config }
  }
})

// 方法
const handleConfirm = () => {
  emit('update:config', { ...localConfig.value })
  isVisible.value = false
}

const handleCancel = () => {
  isVisible.value = false
}

const handleReset = () => {
  localConfig.value = { ...defaultConfig }
}
</script>

<style scoped>
.settings-content {
  padding: 16px 0;
}

.setting-item {
  margin-bottom: 24px;
}

.setting-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
}

.setting-desc {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.4;
}
</style>