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
          </div>
          
          <div class="stats-and-actions">
            <span class="stats">
              当前显示 {{ pagedGroupedVideos.length }} / 
              共 {{ groupedVideos.length }} 个商品 (第 {{ uiState.currentPage }}/{{ totalPages }} 页)
            </span>
            
            <div class="actions">
              <n-checkbox
                :checked="allSelectedChecked"
                :indeterminate="allSelectedIndeterminate"
                @update:checked="$emit('toggle-all-selection')"
              >
                全选可下载 ({{ selectedCount }}/{{ downloadableCount }}{{ downloadableCount < totalCount ? `, 总共${totalCount}` : '' }})
              </n-checkbox>

              <n-button
                type="success"
                size="small"
                :loading="downloadProgress.isDownloading"
                :disabled="selectedCount === 0 || downloadProgress.isDownloading"
                @click="$emit('download-selected')"
              >
                {{ getDownloadButtonText() }}
              </n-button>

              <n-button
                type="default"
                size="small"
                @click="$emit('show-settings')"
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
          <div v-for="group in pagedGroupedVideos" :key="group.goodsId" class="product-group">
            <!-- 商品标题和全选 -->
            <div class="product-header">
              <span class="product-title">
                📦 {{ group.productName }} ({{ group.videos.length }}个视频)
              </span>
              <n-checkbox
                :checked="isProductAllSelected(group.goodsId)"
                :indeterminate="isProductPartialSelected(group.goodsId)"
                @update:checked="() => $emit('toggle-product-selection', group.goodsId)"
              >
                全选
              </n-checkbox>
            </div>

            <!-- 视频卡片网格 -->
            <div v-if="group.videos.length > 0" class="video-grid">
              <video-card
                v-for="video in group.videos"
                :key="video.video_id"
                :video="video"
                :selected="isVideoSelected(video.video_id)"
                @update:selected="(selected) => $emit('video-selection-change', video.video_id, selected)"
              />
            </div>
            
            <div v-else class="empty-state">
              该商品暂无视频数据
            </div>
          </div>
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
          :prefix="() => `共 ${groupedVideos.length} 个商品`"
        />
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  NModal, NInput, NButton, NCheckbox, NProgress, NPagination 
} from 'naive-ui'
import VideoCard from './VideoCard.vue'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  groupedVideos: {
    type: Array,
    default: () => []
  },
  pagedGroupedVideos: {
    type: Array,
    default: () => []
  },
  allVideos: {
    type: Array,
    default: () => []
  },
  selectedVideos: {
    type: Set,
    default: () => new Set()
  },
  downloadProgress: {
    type: Object,
    default: () => ({
      isDownloading: false,
      current: 0,
      total: 0,
      currentFileName: '',
      percentage: 0,
      phase: 'download',
      currentBatch: 0,
      totalBatches: 0
    })
  },
  uiState: {
    type: Object,
    default: () => ({
      currentPage: 1,
      searchKeyword: ''
    })
  },
  totalPages: {
    type: Number,
    default: 1
  },
  selectedCount: {
    type: Number,
    default: 0
  },
  isProductAllSelected: {
    type: Function,
    default: () => false
  },
  isProductPartialSelected: {
    type: Function,
    default: () => false
  },
  isVideoSelected: {
    type: Function,
    default: () => false
  }
})

// Emits
const emit = defineEmits([
  'update:show',
  'toggle-all-selection',
  'toggle-product-selection', 
  'video-selection-change',
  'download-selected',
  'show-settings'
])

// 计算属性
const isVisible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const downloadableCount = computed(() => {
  return props.allVideos.filter(v => v.has_play_url).length
})

const totalCount = computed(() => {
  return props.allVideos.length
})

const allSelectedChecked = computed(() => {
  const downloadable = downloadableCount.value
  return downloadable > 0 && props.selectedCount === downloadable
})

const allSelectedIndeterminate = computed(() => {
  const downloadable = downloadableCount.value
  return props.selectedCount > 0 && props.selectedCount < downloadable
})

// 方法
const getDownloadButtonText = () => {
  if (!props.downloadProgress.isDownloading) {
    return `打包下载 (${props.selectedCount})`
  }
  
  const phase = props.downloadProgress.phase
  if (phase === 'download') {
    return `下载中 (${props.downloadProgress.current}/${props.downloadProgress.total})`
  } else if (phase === 'compress') {
    return `压缩中 (${props.downloadProgress.currentBatch}/${props.downloadProgress.totalBatches})`
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

.product-group {
  margin-bottom: 24px;
}

.product-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  margin-bottom: 12px;
  border-bottom: 1px solid #e8e8e8;
}

.product-title {
  font-size: 15px;
  font-weight: bold;
  color: #333;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
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
  
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
}
</style>