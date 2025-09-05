<template>
  <div
    class="video-card"
    :class="{ 'selected': isSelected }"
    @click="handleClick"
  >
    <!-- 选择复选框 -->
    <div class="selection-area" @click.stop>
      <n-checkbox
        :checked="isSelected"
        :disabled="!video.has_play_url"
        @update:checked="handleSelectionChange"
      />
    </div>

    <!-- 视频封面 -->
    <div class="video-cover">
      <img
        v-if="video.cover_url"
        :src="video.cover_url"
        :alt="video.video_name || '视频封面'"
        @error="handleImageError"
      />
      <div v-else class="placeholder-cover">
        📹
      </div>
      
      <!-- 状态标签 -->
      <div class="status-badge" :class="{ 'downloadable': video.has_play_url }">
        {{ video.has_play_url ? '可下载' : '仅链接' }}
      </div>
    </div>

    <!-- 视频信息 -->
    <div class="video-info">
      <div class="video-title">
        {{ video.video_name || '无标题' }}
      </div>
      
      <div class="video-meta">
        <div class="author">
          👤 {{ video.author_name || '未知作者' }}
        </div>
        
        <div v-if="video.publish_ts" class="publish-date">
          🕒 {{ formatDate(video.publish_ts) }}
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons" @click.stop>
      <n-button
        size="small"
        type="primary"
        @click="handlePlay"
      >
        {{ video.has_play_url ? '播放' : '查看' }}
      </n-button>
      
      <n-button
        size="small"
        type="default"
        @click="handleViewOriginal"
      >
        原视频
      </n-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NCheckbox, NButton } from 'naive-ui'

// Props
const props = defineProps({
  video: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['update:selected'])

// 计算属性
const isSelected = computed(() => props.selected)

// 方法
const handleClick = () => {
  if (props.video.has_play_url) {
    emit('update:selected', !isSelected.value)
  }
}

const handleSelectionChange = (checked) => {
  emit('update:selected', checked)
}

const handlePlay = () => {
  window.open(props.video.video_url, '_blank')
}

const handleViewOriginal = () => {
  window.open(`https://www.douyin.com/video/${props.video.video_id}`, '_blank')
}

const handleImageError = (e) => {
  e.target.style.display = 'none'
}

const formatDate = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.video-card {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fff;
  position: relative;
}

.video-card:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
}

.video-card.selected {
  border-color: #1890ff;
  background-color: #f6ffed;
}

.selection-area {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}

.video-cover {
  position: relative;
  width: 100%;
  height: 120px;
  margin-bottom: 8px;
  border-radius: 6px;
  overflow: hidden;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-cover {
  font-size: 32px;
  color: #999;
}

.status-badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  color: #fff;
  background-color: #999;
}

.status-badge.downloadable {
  background-color: #52c41a;
}

.video-info {
  margin-bottom: 12px;
}

.video-title {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: #333;
}

.video-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.author, .publish-date {
  font-size: 11px;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.action-buttons .n-button {
  flex: 1;
}
</style>