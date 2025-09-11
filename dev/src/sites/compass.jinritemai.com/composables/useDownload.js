// 下载功能组合式函数 - 完整版

import { ref } from 'vue'
import { CR } from '../utils/stateManager.js'

export function useDownload() {
  // 下载进度状态
  const downloadProgress = ref({
    isDownloading: false,
    current: 0,
    total: 0,
    currentFileName: '',
    percentage: 0,
    phase: 'download', // 'download' | 'compress' | 'complete'
    currentBatch: 0,
    totalBatches: 0
  })

  // 获取已下载的视频记录
  const getDownloadedVideos = async () => {
    const data = await CR.get('DOWNLOADED_VIDEOS')
    return data?.downloadedVideoIds || {}
  }

  // 获取已下载的商品记录  
  const getDownloadedProducts = async () => {
    const data = await CR.get('DOWNLOADED_PRODUCTS')
    return data?.downloadedProductIds || {}
  }

  // 保存已下载的视频
  const saveDownloadedVideo = async (videoId) => {
    await CR.commit('DOWNLOADED_VIDEOS/ADD_DOWNLOADED_VIDEO', videoId)
  }

  // 批量保存已下载的视频
  const saveDownloadedVideos = async (videoIds) => {
    await CR.commit('DOWNLOADED_VIDEOS/ADD_DOWNLOADED_VIDEOS', videoIds)
  }

  // 保存已下载的商品
  const saveDownloadedProduct = async (productId) => {
    await CR.commit('DOWNLOADED_PRODUCTS/ADD_DOWNLOADED_PRODUCT', productId)
  }

  // 从 blob 获取视频尺寸
  const getVideoDimensionsFromBlob = async (blob) => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata)
        video.removeEventListener('error', onError)
        if (video.src) {
          URL.revokeObjectURL(video.src)
        }
        video.src = ''
      }
      
      const onLoadedMetadata = () => {
        const dimensions = {
          width: video.videoWidth,
          height: video.videoHeight
        }
        cleanup()
        resolve(dimensions)
      }
      
      const onError = () => {
        cleanup()
        resolve({ width: 0, height: 0 })
      }
      
      video.addEventListener('loadedmetadata', onLoadedMetadata)
      video.addEventListener('error', onError)
      
      const blobUrl = URL.createObjectURL(blob)
      video.src = blobUrl
      
      // 超时处理
      setTimeout(() => {
        cleanup()
        resolve({ width: 0, height: 0 })
      }, 5000)
    })
  }

  // 下载单个视频文件并返回处理结果
  const downloadVideoFile = async (url, fileName, timeout = 30000) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url, true)
      xhr.responseType = 'blob'
      xhr.timeout = timeout

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve({
            success: true,
            blob: xhr.response,
            fileName
          })
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`))
        }
      }

      xhr.onerror = () => reject(new Error('网络错误'))
      xhr.ontimeout = () => reject(new Error('请求超时'))
      
      xhr.send()
    })
  }

  // 下载单个商品的所有视频
  const handleDownloadProduct = async (goodsId, videoInfos, eventBridge) => {
    const videos = videoInfos[goodsId] || []
    const downloadableVideos = videos.filter(video => video.video_play_url)

    if (downloadableVideos.length === 0) {
      eventBridge.updateDownloadProgress(goodsId, '无可下载视频', '#999')
      setTimeout(() => {
        eventBridge.setDownloadingState(goodsId, false)
      }, 2000)
      return
    }

    // 设置下载状态
    eventBridge.setDownloadingState(goodsId, true)
    eventBridge.updateDownloadProgress(goodsId, '准备中...')

    try {
      // 等待库加载
      while (!window.JSZip || !window.saveAs) {
        console.log('⏳ 等待压缩库加载...')
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const zip = new window.JSZip()
      const productInfo = window.__PRODUCT_INFO__[goodsId] || {}
      const productName = productInfo.name?.replace(/[/\\:*?"<>|]/g, '_') || `商品_${goodsId}`
      let successCount = 0
      const totalCount = downloadableVideos.length

      console.log(`📦 开始下载商品 ${productName} 的 ${totalCount} 个视频...`)

      // 分批下载，避免并发过高
      const BATCH_SIZE = 3
      for (let i = 0; i < downloadableVideos.length; i += BATCH_SIZE) {
        const batch = downloadableVideos.slice(i, i + BATCH_SIZE)
        const batchPromises = batch.map(async (video) => {
          try {
            eventBridge.updateDownloadProgress(goodsId, `下载中 ${successCount + 1}/${totalCount}`)

            const response = await fetch(video.video_play_url)
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }

            const blob = await response.blob()
            const dimensions = await getVideoDimensionsFromBlob(blob)
            const sizeStr = dimensions.width > 0 && dimensions.height > 0 
              ? `${dimensions.width}x${dimensions.height}_` 
              : ''
            const fileName = `${sizeStr}${video.author_name || 'unknown'}_${video.video_id}.mp4`.replace(/[/\\:*?"<>|]/g, '_')
            
            zip.file(fileName, blob)
            await saveDownloadedVideo(video.video_id)
            successCount++
            
            console.log(`✅ 下载完成: ${fileName}`)
            return true
          } catch (error) {
            console.error(`❌ 下载失败: ${video.video_id}`, error)
            return false
          }
        })

        await Promise.all(batchPromises)
        
        // 批次间短暂休息
        if (i + BATCH_SIZE < downloadableVideos.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      if (successCount > 0) {
        // 生成压缩包
        eventBridge.updateDownloadProgress(goodsId, '压缩中...')
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
        const content = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 1 }
        })

        const filename = `${productName}_${successCount}个视频_${timestamp}.zip`
        window.saveAs(content, filename)

        // 保存商品下载记录
        await saveDownloadedProduct(goodsId)

        // 成功状态
        eventBridge.updateDownloadProgress(goodsId, `已下载 ${successCount}个`, '#52c41a')
        console.log(`🎉 商品 ${productName} 下载完成！成功: ${successCount}个`)
      } else {
        throw new Error('没有成功下载任何视频')
      }

      // 3秒后恢复按钮状态
      setTimeout(() => {
        eventBridge.setDownloadingState(goodsId, false)
      }, 3000)

    } catch (error) {
      console.error('❌ 商品视频下载失败:', error)
      eventBridge.updateDownloadProgress(goodsId, '下载失败', '#ff4d4f')
      
      setTimeout(() => {
        eventBridge.setDownloadingState(goodsId, false)
      }, 3000)
    }
  }

  // 处理单个批次的下载和压缩
  const processBatch = async (batchVideos, batchNumber, timestamp, startingCompletedCount, performanceConfig) => {
    if (!window.JSZip || !window.saveAs) {
      throw new Error('压缩库未加载')
    }

    const zip = new window.JSZip()
    let successCount = 0
    let failCount = 0
    let completedInBatch = 0
    let currentBatchSize = 0

    // 下载文件的异步函数
    const downloadFile = async (video, index) => {
      const fileName = `${video.video_name || `视频${index + 1}`}_${video.video_id}.mp4`
      
      try {
        const result = await downloadVideoFile(video.video_play_url, fileName)
        
        if (result.success && result.blob.size > 0) {
          // 获取视频尺寸
          const dimensions = await getVideoDimensionsFromBlob(result.blob)
          const sizeStr = dimensions.width > 0 && dimensions.height > 0 
            ? `_${dimensions.width}x${dimensions.height}` 
            : ''
          
          const productInfo = window.__PRODUCT_INFO__[video.goodsId]
          const productName = productInfo?.name?.replace(/[/\\:*?"<>|]/g, '_') || `商品_${video.goodsId}`
          const finalFileName = `${video.author_name || 'unknown'}_${video.video_id}${sizeStr}.mp4`.replace(/[/\\:*?"<>|]/g, '_')
          
          zip.folder(productName).file(finalFileName, result.blob)
          currentBatchSize += result.blob.size
          successCount++
          
          // 保存已下载记录
          await saveDownloadedVideo(video.video_id)
        } else {
          failCount++
        }
        
        return { success: true, fileName, video }
      } catch (error) {
        console.error(`❌ 下载失败 [${fileName}]:`, error)
        failCount++
        return { success: false, fileName, video, error }
      } finally {
        completedInBatch++
        
        // 更新总体进度 - 下载阶段占70%
        const globalCompleted = startingCompletedCount + completedInBatch
        const downloadPhaseProgress = (globalCompleted / downloadProgress.value.total) * 70
        downloadProgress.value = {
          ...downloadProgress.value,
          current: globalCompleted,
          currentFileName: `[批次${batchNumber}] ${fileName}`,
          percentage: Math.round(downloadPhaseProgress),
          phase: 'download'
        }
      }
    }

    // 并发下载当前批次
    const concurrentLimit = performanceConfig.value.concurrentLimit
    const promises = []
    
    for (let i = 0; i < batchVideos.length; i += concurrentLimit) {
      const batch = batchVideos.slice(i, i + concurrentLimit)
      const batchPromises = batch.map((video, batchIndex) => 
        downloadFile(video, i + batchIndex)
      )
      promises.push(...batchPromises)
      
      // 等待当前小批次完成后再继续
      await Promise.all(batchPromises)
      
      // 批次间延迟
      if (performanceConfig.value.batchDelay > 0 && i + concurrentLimit < batchVideos.length) {
        await new Promise(resolve => setTimeout(resolve, performanceConfig.value.batchDelay))
      }
    }

    // 生成并下载当前批次的压缩包
    if (successCount > 0) {
      console.log(`📦 [批次${batchNumber}] 生成压缩包... (${(currentBatchSize/1024/1024).toFixed(1)}MB)`)

      // 压缩进度更新 - 压缩阶段占30%，从70%开始
      const downloadPhaseProgress = 70
      const currentBatchProgress = (batchNumber - 1) / downloadProgress.value.totalBatches
      const compressionProgress = downloadPhaseProgress + (currentBatchProgress * 30)
      downloadProgress.value = {
        ...downloadProgress.value,
        currentFileName: `生成压缩包 ${batchNumber}/${downloadProgress.value.totalBatches}...`,
        percentage: Math.round(compressionProgress),
        phase: 'compress',
        currentBatch: batchNumber
      }

      // 使用更快的压缩设置
      const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: performanceConfig.value.compressionLevel },
        streamFiles: true
      })

      const zipFileName = `商品视频_批次${batchNumber}_${timestamp}.zip`
      window.saveAs(content, zipFileName)
      console.log(`✅ [批次${batchNumber}] 压缩包下载完成: ${zipFileName}`)
    }

    return { successCount, failCount }
  }

  // 主下载函数 - 分批打包下载
  const handleDownloadSelected = async (selectedVideoData, performanceConfig) => {
    if (!selectedVideoData || selectedVideoData.length === 0) {
      console.warn('没有选中的视频')
      return
    }

    // 检查必需的库
    if (!window.JSZip || !window.saveAs) {
      console.error('缺少必需的下载库: JSZip, saveAs')
      return
    }

    try {
      const maxFilesPerZip = performanceConfig.value.maxFilesPerZip
      const totalBatches = Math.ceil(selectedVideoData.length / maxFilesPerZip)

      // 初始化进度状态
      downloadProgress.value = {
        isDownloading: true,
        current: 0,
        total: selectedVideoData.length,
        currentFileName: '准备分批下载...',
        percentage: 0,
        phase: 'download',
        currentBatch: 0,
        totalBatches
      }

      console.log(`🗜️ 开始分批下载 ${selectedVideoData.length} 个视频，分为 ${totalBatches} 个压缩包...`)

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      let globalCompletedCount = 0
      let totalSuccessCount = 0
      let totalFailCount = 0

      // 分批处理
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * maxFilesPerZip
        const end = Math.min(start + maxFilesPerZip, selectedVideoData.length)
        const batchVideos = selectedVideoData.slice(start, end)

        console.log(`📦 处理第 ${batchIndex + 1}/${totalBatches} 个压缩包 (${batchVideos.length} 个文件)...`)

        const { successCount, failCount } = await processBatch(
          batchVideos, 
          batchIndex + 1, 
          timestamp, 
          globalCompletedCount,
          performanceConfig
        )

        totalSuccessCount += successCount
        totalFailCount += failCount
        globalCompletedCount += batchVideos.length

        // 批次间延迟
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      // 完成所有下载
      downloadProgress.value = {
        ...downloadProgress.value,
        currentFileName: '所有压缩包下载完成！',
        percentage: 100,
        phase: 'complete'
      }

      console.log(`🎉 分批下载完成！总计成功: ${totalSuccessCount}, 失败: ${totalFailCount}`)
      
      // 延迟重置状态
      setTimeout(() => {
        downloadProgress.value.isDownloading = false
      }, 3000)

    } catch (error) {
      console.error('❌ 分批下载失败:', error)
      downloadProgress.value.isDownloading = false
    }
  }

  return {
    downloadProgress,
    handleDownloadSelected,
    handleDownloadProduct,
    downloadVideoFile,
    getDownloadedVideos,
    getDownloadedProducts,
    saveDownloadedVideo,
    saveDownloadedVideos,
    saveDownloadedProduct,
    getVideoDimensionsFromBlob
  }
}