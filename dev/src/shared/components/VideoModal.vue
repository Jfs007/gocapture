<template>
  <n-modal
    v-model:show="isVisible"
    preset="dialog"
    title="商品视频数据"
    :style="{ width: '90%', maxWidth: '1400px' }"
  >
    <div class="modal-content">
      <!-- 可滚动的内容区域 -->
      <div class="scrollable-content">
        <!-- 操作栏 -->
        <div class="toolbar">
          <!-- 搜索和过滤栏 -->
          <div class="search-bar">
            <n-input
              v-model:value="uiState.searchKeyword"
              placeholder="搜索视频标题或作者..."
              clearable
              style="width: 300px;"
            >
              <template #prefix>
                🔍
              </template>
            </n-input>

            <n-button
              v-if="allVideos.length > 50"
              size="small"
              :type="uiState.showAllProducts ? 'warning' : 'default'"
              @click="uiState.showAllProducts = !uiState.showAllProducts"
            >
              {{ uiState.showAllProducts ? `🔥 显示全部 (${allVideos.length})` : '⚡ 仅显示前100个商品 (性能优化)' }}
            </n-button>
          </div>
          
          <div class="stats-and-actions">
            <span class="stats">
              当前显示 {{ pagedGroupedVideos.reduce((sum, g) => sum + g.videos.length, 0) }} / 
              共 {{ allVideos.length }} 个视频 (第 {{ uiState.currentPage }}/{{ totalPages }} 页)
            </span>
            
            <div class="actions">
              <n-checkbox
                :checked="selectedCount === allVideos.filter(v => v.has_play_url).length && allVideos.length > 0"
                :indeterminate="selectedCount > 0 && selectedCount < allVideos.filter(v => v.has_play_url).length"
                @update:checked="toggleSelectAll"
              >
                全选可下载
              </n-checkbox>

              <n-button
                type="success"
                size="small"
                :loading="downloadProgress.isDownloading"
                :disabled="selectedCount === 0 || downloadProgress.isDownloading"
                @click="handleDownload"
              >
                {{ getDownloadButtonText() }}
              </n-button>

              <n-button
                type="default"
                size="small"
                @click="showSettingsModal = true"
              >
                设置
              </n-button>
            </div>
          </div>
        </div>

        <!-- 下载进度条 -->
        <div v-if="downloadProgress.isDownloading" class="progress-section">
          <div class="progress-info">
            <span>{{ downloadProgress.currentFileName }}</span>
            <span>{{ downloadProgress.percentage }}%</span>
          </div>
          <n-progress
            type="line"
            :status="downloadProgress.percentage === 100 ? 'success' : 'info'"
            :percentage="downloadProgress.percentage"
            :show-indicator="false"
          />
        </div>

        <!-- 视频内容 -->
        <div v-if="pagedGroupedVideos.length === 0" class="empty-state">
          暂无视频数据，请先访问商品视频页面
        </div>
        
        <div v-else class="video-content">
          <product-group
            v-for="group in pagedGroupedVideos"
            :key="group.goodsId"
            :group="group"
            :selected-videos="selectedVideos"
            @update:selected="handleVideoSelection"
          />
        </div>
      </div>

      <!-- 固定在底部的分页控件 -->
      <div v-if="totalPages > 1" class="pagination-section">
        <n-pagination
          v-model:page="uiState.currentPage"
          :page-count="totalPages"
          size="medium"
          :show-size-picker="false"
          :show-quick-jumper="true"
          :prefix="() => `共 ${allVideos.length} 个视频`"
        />
      </div>
    </div>

    <!-- 设置弹窗 -->
    <settings-modal
      v-model:show="showSettingsModal"
      v-model:config="performanceConfig"
    />
  </n-modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  NModal, NInput, NButton, NCheckbox, NProgress, NPagination 
} from 'naive-ui'
import ProductGroup from './ProductGroup.vue'
import SettingsModal from './SettingsModal.vue'
import { useVideoData } from '../composables/useVideoData'
import { useDownload } from '../composables/useDownload'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['update:show'])

// Composables
const {
  allVideos,
  pagedGroupedVideos,
  selectedVideos,
  uiState,
  performanceConfig,
  totalPages,
  selectedCount,
  toggleSelectAll
} = useVideoData()

const { downloadProgress, handleDownloadSelected } = useDownload()

// 本地状态
const showSettingsModal = ref(false)

// 计算属性
const isVisible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

// 方法
const handleVideoSelection = (videoId, selected) => {
  if (selected) {
    selectedVideos.value.add(videoId)
  } else {
    selectedVideos.value.delete(videoId)
  }
}

const handleDownload = () => {
  const selectedVideoData = allVideos.value.filter(video => 
    selectedVideos.value.has(video.video_id) && video.has_play_url
  )
  
  if (selectedVideoData.length === 0) {
    console.warn('请先选择可下载的视频')
    return
  }

  handleDownloadSelected(selectedVideoData, performanceConfig.value)
}

const getDownloadButtonText = () => {
  if (!downloadProgress.value.isDownloading) {
    return `打包下载 (${selectedCount.value})`
  }
  
  const phase = downloadProgress.value.phase
  if (phase === 'download') {
    return `下载中 (${downloadProgress.value.current}/${downloadProgress.value.total})`
  } else if (phase === 'compress') {
    return `压缩中 (${downloadProgress.value.currentBatch}/${downloadProgress.value.totalBatches})`
  } else {
    return '处理中...'
  }
}
</script>

<style scoped>
.modal-content {
  height: 700px;
  display: flex;
  flex-direction: column;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 8px;
}

.toolbar {
  margin-bottom: 16px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.stats-and-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats {
  font-size: 14px;
  color: #666;
}

.progress-section {
  margin-bottom: 16px;
  padding: 12px;
  background-color: #f0f8ff;
  border-radius: 6px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: #333;
}

.video-content {
  padding: 0 4px;
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #999;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.pagination-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  border-top: 1px solid #f0f0f0;
  background-color: #fafafa;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .stats-and-actions {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .actions {
    justify-content: space-between;
  }
}
</style>