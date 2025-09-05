<template>
  <div class="product-group">
    <!-- 商品标题和全选 -->
    <div class="product-header">
      <span class="product-title">
        📦 {{ group.productName }} ({{ group.videos.length }}个视频)
      </span>
      <n-checkbox
        :checked="isAllSelected"
        :indeterminate="isPartialSelected"
        @update:checked="handleToggleAll"
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
        @update:selected="(selected) => handleVideoSelection(video.video_id, selected)"
      />
    </div>
    
    <div v-else class="empty-state">
      该商品暂无视频数据
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NCheckbox } from 'naive-ui'
import VideoCard from './VideoCard.vue'

// Props
const props = defineProps({
  group: {
    type: Object,
    required: true
  },
  selectedVideos: {
    type: Set,
    required: true
  }
})

// Emits
const emit = defineEmits(['update:selected'])

// 计算属性
const isAllSelected = computed(() => {
  const downloadableVideos = props.group.videos.filter(v => v.has_play_url)
  return downloadableVideos.length > 0 && downloadableVideos.every(video => 
    props.selectedVideos.has(video.video_id)
  )
})

const isPartialSelected = computed(() => {
  const downloadableVideos = props.group.videos.filter(v => v.has_play_url)
  const selectedCount = downloadableVideos.filter(video => 
    props.selectedVideos.has(video.video_id)
  ).length
  return selectedCount > 0 && selectedCount < downloadableVideos.length
})

// 方法
const isVideoSelected = (videoId) => {
  return props.selectedVideos.has(videoId)
}

const handleVideoSelection = (videoId, selected) => {
  emit('update:selected', videoId, selected)
}

const handleToggleAll = () => {
  const downloadableVideos = props.group.videos.filter(v => v.has_play_url)
  const allSelected = isAllSelected.value
  
  downloadableVideos.forEach(video => {
    emit('update:selected', video.video_id, !allSelected)
  })
}
</script>

<style scoped>
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

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
  background-color: #f9f9f9;
  border-radius: 8px;
}

@media (max-width: 768px) {
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
}
</style>