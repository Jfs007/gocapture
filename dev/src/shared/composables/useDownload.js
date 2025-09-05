// 下载功能组合式函数

import { ref } from 'vue'
import { useLibs } from '../utils/libs'

export function useDownload() {
  const { JSZip, saveAs, checkLibs } = useLibs()
  
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

  // 下载单个视频文件
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

  // 处理单个批次的下载和压缩
  const processBatch = async (batchVideos, batchNumber, timestamp, startingCompletedCount, performanceConfig) => {
    const JSZipClass = JSZip()
    const saveAsFunc = saveAs()
    
    if (!JSZipClass || !saveAsFunc) {
      throw new Error('压缩库未加载')
    }

    const zip = new JSZipClass()
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
          zip.file(fileName, result.blob)
          currentBatchSize += result.blob.size
          successCount++
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
      saveAsFunc(content, zipFileName)
      console.log(`✅ [批次${batchNumber}] 压缩包下载完成: ${zipFileName}`)
    }

    return { successCount, failCount }
  }

  // 主下载函数
  const handleDownloadSelected = async (selectedVideoData, performanceConfig) => {
    if (!selectedVideoData || selectedVideoData.length === 0) {
      console.warn('没有选中的视频')
      return
    }

    // 检查必需的库
    if (!checkLibs(['JSZip', 'saveAs'])) {
      console.error('缺少必需的下载库')
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
    downloadVideoFile
  }
}