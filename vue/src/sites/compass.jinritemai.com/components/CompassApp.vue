<template>
  <div>
    <!-- 悬浮工具箱 -->
    <FloatingToolbox
      :all-videos="allVideos"
      :selected-count="selectedCount"
      :download-progress="downloadProgress"
      @get-videos="handleGetVideos"
      @download-selected="handleDownloadSelected"
      @show-settings="showSettings = true"
    />

    <!-- 视频数据模态框 -->
    <VideoModal
      v-model:show="showVideoModal"
      :grouped-videos="groupedVideos"
      :paged-grouped-videos="pagedGroupedVideos"
      :all-videos="allVideos"
      :selected-videos="selectedVideos"
      :download-progress="downloadProgress"
      :ui-state="uiState"
      :total-pages="totalPages"
      :selected-count="selectedCount"
      :is-product-all-selected="isProductAllSelected"
      :is-product-partial-selected="isProductPartialSelected"
      :is-video-selected="isVideoSelected"
      @toggle-all-selection="handleToggleAllSelection"
      @toggle-product-selection="handleToggleProductSelection"
      @video-selection-change="handleVideoSelectionChange"
      @download-selected="handleDownloadSelected"
      @show-settings="showSettings = true"
    />

    <!-- 设置模态框 -->
    <SettingsModal
      v-model:show="showSettings"
      v-model:config="downloadConfig"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import FloatingToolbox from './FloatingToolbox.vue'
import VideoModal from './VideoModal.vue'
import SettingsModal from './SettingsModal.vue'

// 响应式数据
const allVideos = ref([])
const selectedVideos = ref(new Set())
const showVideoModal = ref(false)
const showSettings = ref(false)

// 下载进度状态
const downloadProgress = reactive({
  isDownloading: false,
  current: 0,
  total: 0,
  currentFileName: '',
  percentage: 0,
  phase: 'download',
  currentBatch: 0,
  totalBatches: 0
})

// UI状态
const uiState = reactive({
  currentPage: 1,
  searchKeyword: ''
})

// 下载配置
const downloadConfig = ref({
  concurrentLimit: 3,
  batchDelay: 100,
  compressionLevel: 6,
  maxFilesPerZip: 15,
  maxZipSize: 100 * 1024 * 1024,
  productsPerPage: 10,
  enableVirtualScroll: true
})

// 计算属性
const filteredVideos = computed(() => {
  if (!uiState.searchKeyword.trim()) {
    return allVideos.value
  }
  
  const keyword = uiState.searchKeyword.toLowerCase()
  return allVideos.value.filter(video => {
    const title = (video.video_name || video.title || '').toLowerCase()
    const author = (video.author_name || '').toLowerCase()
    return title.includes(keyword) || author.includes(keyword)
  })
})

const groupedVideos = computed(() => {
  const groups = {}
  filteredVideos.value.forEach(video => {
    const goodsId = video.goodsId
    if (!groups[goodsId]) {
      groups[goodsId] = {
        goodsId,
        productName: video.productName || `商品 ${goodsId}`,
        videos: []
      }
    }
    groups[goodsId].videos.push(video)
  })
  return Object.values(groups)
})

const totalPages = computed(() => {
  return Math.ceil(groupedVideos.value.length / downloadConfig.value.productsPerPage)
})

const pagedGroupedVideos = computed(() => {
  const startIndex = (uiState.currentPage - 1) * downloadConfig.value.productsPerPage
  const endIndex = startIndex + downloadConfig.value.productsPerPage
  return groupedVideos.value.slice(startIndex, endIndex)
})

const selectedCount = computed(() => {
  return Array.from(selectedVideos.value).filter(videoId => {
    const video = allVideos.value.find(v => v.video_id === videoId)
    return video && video.has_play_url
  }).length
})

// 方法
const isVideoSelected = (videoId) => {
  return selectedVideos.value.has(videoId)
}

const isProductAllSelected = (goodsId) => {
  const productVideos = allVideos.value.filter(v => 
    v.goodsId === goodsId && v.has_play_url
  )
  if (productVideos.length === 0) return false
  
  return productVideos.every(v => selectedVideos.value.has(v.video_id))
}

const isProductPartialSelected = (goodsId) => {
  const productVideos = allVideos.value.filter(v => 
    v.goodsId === goodsId && v.has_play_url
  )
  if (productVideos.length === 0) return false
  
  const selectedInProduct = productVideos.filter(v => selectedVideos.value.has(v.video_id))
  return selectedInProduct.length > 0 && selectedInProduct.length < productVideos.length
}

const handleGetVideos = async () => {
  try {
    console.log('🎬 开始获取当前页面视频数据...')
    
    // 模拟获取视频数据的逻辑
    // 实际实现中会从eventBridge或全局状态获取
    if (window._videoDataCollector) {
      const videos = window._videoDataCollector.getAllVideos()
      allVideos.value = videos
      console.log(`✅ 获取到 ${videos.length} 个视频`)
    } else {
      console.warn('⚠️ 视频数据收集器未初始化')
    }
    
    showVideoModal.value = true
  } catch (error) {
    console.error('❌ 获取视频数据失败:', error)
  }
}

const handleToggleAllSelection = () => {
  const downloadableVideos = allVideos.value.filter(v => v.has_play_url)
  
  if (selectedCount.value === downloadableVideos.length) {
    // 全部取消选择
    selectedVideos.value.clear()
  } else {
    // 全部选择
    downloadableVideos.forEach(video => {
      selectedVideos.value.add(video.video_id)
    })
  }
}

const handleToggleProductSelection = (goodsId) => {
  const productVideos = allVideos.value.filter(v => 
    v.goodsId === goodsId && v.has_play_url
  )
  
  if (isProductAllSelected(goodsId)) {
    // 取消选择该商品的所有视频
    productVideos.forEach(video => {
      selectedVideos.value.delete(video.video_id)
    })
  } else {
    // 选择该商品的所有视频
    productVideos.forEach(video => {
      selectedVideos.value.add(video.video_id)
    })
  }
}

const handleVideoSelectionChange = (videoId, selected) => {
  if (selected) {
    selectedVideos.value.add(videoId)
  } else {
    selectedVideos.value.delete(videoId)
  }
}

const handleDownloadSelected = async () => {
  if (selectedCount.value === 0) {
    console.warn('⚠️ 没有选择要下载的视频')
    return
  }

  if (downloadProgress.isDownloading) {
    console.warn('⚠️ 正在下载中，请等待完成')
    return
  }

  try {
    console.log('🚀 开始批量下载视频...')
    
    const selectedVideosList = allVideos.value.filter(video => 
      selectedVideos.value.has(video.video_id) && video.has_play_url
    )
    
    // 使用下载管理器进行批量下载
    if (window._downloadManager) {
      await window._downloadManager.downloadVideos(
        selectedVideosList,
        downloadConfig.value,
        downloadProgress
      )
    } else {
      console.error('❌ 下载管理器未初始化')
    }
    
  } catch (error) {
    console.error('❌ 批量下载失败:', error)
    downloadProgress.isDownloading = false
  }
}

// 监听页面变化重置到第一页
watch(() => uiState.searchKeyword, () => {
  uiState.currentPage = 1
})

// 生命周期
onMounted(() => {
  console.log('🎉 CompassApp 组件已挂载')
  
  // 监听全局事件
  if (window._eventBridge) {
    window._eventBridge.on('videoDataUpdated', (videos) => {
      allVideos.value = videos
      console.log(`📺 视频数据已更新: ${videos.length} 个视频`)
    })
    
    window._eventBridge.on('downloadProgress', (progress) => {
      Object.assign(downloadProgress, progress)
    })
  }
})

onUnmounted(() => {
  console.log('👋 CompassApp 组件已卸载')
  
  // 清理事件监听
  if (window._eventBridge) {
    window._eventBridge.off('videoDataUpdated')
    window._eventBridge.off('downloadProgress')
  }
})
</script>

<style scoped>
/* 组件容器样式 */
</style>