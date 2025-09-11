// 视频数据管理组合式函数

import { ref, computed, onMounted } from 'vue'
import { eventBridge } from '../utils/eventBridge'
import { CR } from '../utils/stateManager.js'

export function useVideoData() {
  // 响应式数据
  const videoInfos = eventBridge.videoInfos
  const selectedVideos = ref(new Set())
  
  // 已下载的视频和商品记录
  const downloadedVideos = ref({})
  const downloadedProducts = ref({})

  // UI状态
  const uiState = ref({
    currentPage: 1,
    searchKeyword: '',
    showAllProducts: true
  })

  // 性能配置
  const performanceConfig = ref({
    concurrentLimit: 3,
    batchDelay: 100,
    compressionLevel: 6,
    maxFilesPerZip: 15,
    maxZipSize: 100 * 1024 * 1024,
    videosPerPage: 50,
    enableVirtualScroll: true
  })

  // 加载已下载记录
  const loadDownloadedRecords = async () => {
    try {
      const videosData = await CR.get('DOWNLOADED_VIDEOS')
      if (videosData?.downloadedVideoIds) {
        downloadedVideos.value = videosData.downloadedVideoIds
        console.log('📋 加载已下载视频记录:', Object.keys(downloadedVideos.value).length, '个')
      }
      
      const productsData = await CR.get('DOWNLOADED_PRODUCTS')
      if (productsData?.downloadedProductIds) {
        downloadedProducts.value = productsData.downloadedProductIds
        console.log('📋 加载已下载商品记录:', Object.keys(downloadedProducts.value).length, '个')
      }
    } catch (error) {
      console.warn('加载下载记录失败:', error)
    }
  }

  // 初始化时加载记录
  onMounted(() => {
    loadDownloadedRecords()
  })

  // 按商品分组的视频数据
  const groupedVideos = computed(() => {
    const groups = []
    const entries = Object.entries(videoInfos)
    
    const maxProducts = uiState.value.showAllProducts ? entries.length : Math.min(entries.length, 10)
    const limitedEntries = entries.slice(0, maxProducts)
    
    limitedEntries.forEach(([goodsId, videoList]) => {
      const productInfo = window.__PRODUCT_INFO__?.[goodsId] || {}

      let filteredVideos = videoList
      if (uiState.value.searchKeyword) {
        const keyword = uiState.value.searchKeyword.toLowerCase()
        filteredVideos = videoList.filter(video => 
          (video.video_name || '').toLowerCase().includes(keyword) ||
          (video.author_name || '').toLowerCase().includes(keyword)
        )
      }

      const videos = filteredVideos.map(video => {
        const videoUrl = video.video_play_url
          ? video.video_play_url
          : `https://www.douyin.com/video/${video.video_id}`

        return {
          goodsId,
          productName: productInfo.name || `商品 ${goodsId}`,
          ...video,
          video_url: videoUrl,
          has_play_url: !!video.video_play_url,
          is_downloaded: !!downloadedVideos.value[video.video_id]
        }
      })

      if (videos.length > 0) {
        groups.push({
          goodsId,
          productName: productInfo.name || `商品 ${goodsId}`,
          videos,
          totalVideos: filteredVideos.length
        })
      }
    })

    return groups
  })

  // 所有视频的扁平数组
  const allVideos = computed(() => {
    const videos = []
    groupedVideos.value.forEach(group => {
      videos.push(...group.videos)
    })
    return videos
  })

  // 分页后的视频数据
  const pagedGroupedVideos = computed(() => {
    const videosPerPage = performanceConfig.value.videosPerPage
    const startIndex = (uiState.value.currentPage - 1) * videosPerPage
    const endIndex = startIndex + videosPerPage
    const pagedVideos = allVideos.value.slice(startIndex, endIndex)

    const groupsMap = new Map()
    pagedVideos.forEach(video => {
      const { goodsId } = video
      const originalGroup = groupedVideos.value.find(g => g.goodsId === goodsId)
      if (!groupsMap.has(goodsId)) {
        groupsMap.set(goodsId, {
          goodsId,
          productName: originalGroup?.productName || `商品 ${goodsId}`,
          videos: [],
          totalVideos: originalGroup?.totalVideos || 0
        })
      }
      groupsMap.get(goodsId).videos.push(video)
    })

    return Array.from(groupsMap.values())
  })

  // 总页数
  const totalPages = computed(() => {
    return Math.ceil(allVideos.value.length / performanceConfig.value.videosPerPage)
  })

  // 选中数量
  const selectedCount = computed(() => {
    return selectedVideos.value.size
  })

  // 视频选择方法
  const isVideoSelected = (videoId) => {
    return selectedVideos.value.has(videoId)
  }

  const toggleVideoSelection = (videoId) => {
    if (selectedVideos.value.has(videoId)) {
      selectedVideos.value.delete(videoId)
    } else {
      selectedVideos.value.add(videoId)
    }
  }

  // 商品级选择方法
  const isProductAllSelected = (goodsId) => {
    const productVideos = groupedVideos.value.find(g => g.goodsId === goodsId)?.videos || []
    return productVideos.length > 0 && productVideos.every(video => 
      selectedVideos.value.has(video.video_id)
    )
  }

  const isProductPartialSelected = (goodsId) => {
    const productVideos = groupedVideos.value.find(g => g.goodsId === goodsId)?.videos || []
    const selectedCount = productVideos.filter(video => 
      selectedVideos.value.has(video.video_id)
    ).length
    return selectedCount > 0 && selectedCount < productVideos.length
  }

  const toggleProductSelection = (goodsId) => {
    const productVideos = groupedVideos.value.find(g => g.goodsId === goodsId)?.videos || []
    const isAllSelected = isProductAllSelected(goodsId)
    
    if (isAllSelected) {
      productVideos.forEach(video => {
        selectedVideos.value.delete(video.video_id)
      })
    } else {
      productVideos.forEach(video => {
        if (video.has_play_url) {
          selectedVideos.value.add(video.video_id)
        }
      })
    }
  }

  // 全选方法
  const toggleSelectAll = () => {
    const downloadableVideos = allVideos.value.filter(v => v.has_play_url)
    const allSelected = downloadableVideos.every(v => selectedVideos.value.has(v.video_id))
    
    if (allSelected) {
      downloadableVideos.forEach(v => selectedVideos.value.delete(v.video_id))
    } else {
      downloadableVideos.forEach(v => selectedVideos.value.add(v.video_id))
    }
  }

  // 分页控制
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages.value) {
      uiState.value.currentPage = page
    }
  }

  return {
    // 数据
    videoInfos,
    groupedVideos,
    pagedGroupedVideos,
    allVideos,
    selectedVideos,
    downloadedVideos,
    downloadedProducts,
    
    // 状态
    uiState,
    performanceConfig,
    
    // 计算属性
    totalPages,
    selectedCount,
    
    // 方法
    isVideoSelected,
    toggleVideoSelection,
    isProductAllSelected,
    isProductPartialSelected,
    toggleProductSelection,
    toggleSelectAll,
    goToPage,
    loadDownloadedRecords
  }
}