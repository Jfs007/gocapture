<template>
  <div
    class="floating-toolbox"
    :style="toolboxStyle"
    @mousedown="handleMouseDown"
  >
    <div class="toolbox-content">
      <div class="toolbox-title">视频数据工具</div>
      
      <div class="toolbox-actions" @mousedown="(e) => e.stopPropagation()">
        <n-space vertical size="small">
          <n-button
            type="primary"
            size="small"
            block
            @click="$emit('get-videos')"
          >
            获取当前视频 ({{ allVideos.length }})
          </n-button>
          
          <n-button
            type="default"
            size="small"
            block
            @click="handleExportCSV"
            :disabled="allVideos.length === 0"
          >
            导出CSV
          </n-button>
          
          <n-button
            type="success"
            size="small"
            block
            :loading="downloadProgress.isDownloading"
            @click="$emit('download-selected')"
            :disabled="selectedCount === 0 || downloadProgress.isDownloading"
          >
            {{ getDownloadButtonText() }}
          </n-button>
          
          <n-button
            type="default"
            size="small"
            block
            @click="$emit('show-settings')"
          >
            ⚙️ 设置
          </n-button>
        </n-space>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { NButton, NSpace } from 'naive-ui'

// Props
const props = defineProps({
  allVideos: {
    type: Array,
    default: () => []
  },
  selectedCount: {
    type: Number,
    default: 0
  },
  downloadProgress: {
    type: Object,
    default: () => ({
      isDownloading: false,
      current: 0,
      total: 0,
      phase: 'download',
      currentBatch: 0,
      totalBatches: 0
    })
  }
})

// Emits
const emit = defineEmits(['get-videos', 'download-selected', 'show-settings'])

// 工具箱位置状态
const position = ref({ x: window.innerWidth - 200, y: 100 })
const isDragging = ref(false)

// 样式计算
const toolboxStyle = computed(() => ({
  position: 'fixed',
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  width: '180px',
  backgroundColor: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: '6px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  zIndex: 9999,
  padding: '12px',
  cursor: isDragging.value ? 'grabbing' : 'grab',
  pointerEvents: 'auto'
}))

// 拖拽处理
const handleMouseDown = (e) => {
  isDragging.value = true
  const startX = e.clientX - position.value.x
  const startY = e.clientY - position.value.y
  
  const handleMouseMove = (e) => {
    if (isDragging.value) {
      position.value = {
        x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - startX)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - startY))
      }
    }
  }
  
  const handleMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 获取下载按钮文本
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

// 导出CSV功能
const handleExportCSV = () => {
  const videos = props.allVideos
  if (videos.length === 0) {
    console.warn('暂无视频数据可导出')
    return
  }

  const headers = ['商品ID', '视频ID', '视频标题', '作者', '作者ID', '发布时间', '视频链接', '原视频链接', '视频类型', '视频封面']
  const rows = videos.map(video => [
    video.goodsId || '',
    video.video_id || '',
    video.video_name || video.title || '',
    video.author_name || '',
    video.author_id || '',
    video.publish_ts ? new Date(video.publish_ts * 1000).toLocaleString('zh-CN') : '',
    video.video_url || '',
    `https://www.douyin.com/video/${video.video_id}`,
    video.has_play_url ? '可播放' : '跳转链接',
    video.video_img || ''
  ])

  // 简单的CSV导出
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n')
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  link.href = URL.createObjectURL(blob)
  link.download = `商品视频数据_${timestamp}.csv`
  link.click()
  
  console.log(`✅ 导出成功：${videos.length}条数据`)
}
</script>

<style scoped>
.floating-toolbox {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.toolbox-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbox-title {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  text-align: center;
}

.toolbox-actions {
  display: flex;
  flex-direction: column;
}
</style>