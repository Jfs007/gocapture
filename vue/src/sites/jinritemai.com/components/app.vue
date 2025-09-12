<template>
  <div class="jinritemai-floating-toolbox" :style="floatingStyle">
    <div class="toolbox-header" @mousedown="startDrag">
      <span class="toolbox-title">一键搬品工具</span>
      <div class="toolbox-actions">
        <button class="minimize-btn" @click="toggleMinimize">
          {{ isMinimized ? '□' : '_' }}
        </button>
      </div>
    </div>
    
    <div v-if="!isMinimized" class="toolbox-content">
      <!-- 抖音登录状态 -->
      <div class="status-section">
        <div class="status-item">
          <span class="status-label">抖音状态：</span>
          <span :class="['status-value', douyinStatus.connected ? 'status-connected' : 'status-disconnected']">
            {{ douyinStatus.text }}
          </span>
        </div>
        <div v-if="!douyinStatus.connected" class="login-tips">
          请先登录抖音，然后点击刷新状态
          <br>
          <small>需要在抖音相关页面（douyin.com）获取登录信息</small>
        </div>
        <div v-if="douyinStatus.lastCollected" class="last-collected">
          上次获取：{{ douyinStatus.lastCollected }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <n-space vertical>
          <n-button 
            type="primary" 
            size="large" 
            block
            :loading="isProcessing"
            :disabled="!douyinStatus.connected"
            @click="handleOneClickMove"
          >
            {{ isProcessing ? '处理中...' : '一键搬品' }}
          </n-button>
          
          <n-button 
            size="medium" 
            block
            :loading="isCheckingStatus"
            @click="refreshDouyinStatus"
          >
            {{ isCheckingStatus ? '检查中...' : '刷新抖音状态' }}
          </n-button>
          
          <n-button 
            v-if="isDouyinDomain"
            size="small" 
            type="info"
            block
            :loading="isCollectingCookies"
            @click="collectDouyinCookies"
          >
            {{ isCollectingCookies ? '获取中...' : '获取当前页面Cookie' }}
          </n-button>
        </n-space>
      </div>

      <!-- 进度显示 -->
      <div v-if="progress.show" class="progress-section">
        <div class="progress-label">{{ progress.text }}</div>
        <n-progress
          type="line"
          :percentage="progress.percentage"
          :status="progress.status"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

// 响应式数据
const isMinimized = ref(false)
const isDragging = ref(false)
const isProcessing = ref(false)
const isCheckingStatus = ref(false)
const isCollectingCookies = ref(false)

// 悬浮窗位置
const position = reactive({
  x: window.innerWidth - 320,
  y: 100
})

// 抖音登录状态
const douyinStatus = reactive({
  connected: false,
  text: '未登录',
  cookies: null,
  lastCollected: null
})

// 进度信息
const progress = reactive({
  show: false,
  text: '',
  percentage: 0,
  status: 'active'
})

// 拖拽相关
const dragStart = reactive({ x: 0, y: 0 })

// 计算属性
const floatingStyle = computed(() => ({
  position: 'fixed',
  left: `${position.x}px`,
  top: `${position.y}px`,
  zIndex: 9999,
  userSelect: 'none'
}))

// 检查是否为抖音域名
const isDouyinDomain = computed(() => {
  const currentDomain = window.location.hostname
  return currentDomain.includes('douyin.com') || currentDomain.includes('bytedance.com')
})

// 抖音Cookie管理功能 (站点内实现)
const douyinCookieManager = {
  COOKIE_KEY: 'douyin_cookies_jinritemai',
  
  // 从localStorage获取已保存的cookie
  getCookies() {
    try {
      const stored = localStorage.getItem(this.COOKIE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('获取Cookie失败:', error)
      return null
    }
  },
  
  // 保存cookie到localStorage
  saveCookies(cookies) {
    try {
      localStorage.setItem(this.COOKIE_KEY, JSON.stringify(cookies))
      return true
    } catch (error) {
      console.error('保存Cookie失败:', error)
      return false
    }
  },
  
  // 从当前页面收集Cookie
  async collectCookies() {
    try {
      const currentDomain = window.location.hostname
      const isDouyinDomain = currentDomain.includes('douyin.com') || 
                           currentDomain.includes('bytedance.com')

      if (!isDouyinDomain) {
        throw new Error('当前页面不是抖音域名，无法获取抖音Cookie')
      }

      const cookies = {}
      const cookieString = document.cookie

      if (!cookieString) {
        throw new Error('未找到Cookie信息')
      }

      // 解析cookie字符串
      cookieString.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=')
        if (name && value) {
          cookies[name] = decodeURIComponent(value)
        }
      })

      // 检查必要的cookie字段
      const requiredFields = ['sessionid', 'uid']
      const missingFields = requiredFields.filter(field => !cookies[field])
      
      if (missingFields.length > 0) {
        throw new Error(`缺少必要的Cookie字段: ${missingFields.join(', ')}`)
      }

      // 添加收集时间
      cookies.collected_at = Date.now()
      cookies.domain = currentDomain

      // 保存到localStorage
      this.saveCookies(cookies)

      console.log('✅ 抖音Cookie收集成功:', {
        sessionid: cookies.sessionid ? '***已获取***' : '未获取',
        uid: cookies.uid || '未获取',
        domain: cookies.domain,
        collected_at: new Date(cookies.collected_at).toLocaleString()
      })

      return cookies

    } catch (error) {
      console.error('❌ 抖音Cookie收集失败:', error)
      throw error
    }
  },
  
  // 验证cookie是否有效
  validateCookies(cookies = null) {
    try {
      const cookieData = cookies || this.getCookies()
      
      if (!cookieData) {
        return { valid: false, reason: '未找到Cookie数据' }
      }

      // 检查cookie是否过期（24小时）
      const collectedAt = cookieData.collected_at
      const now = Date.now()
      const expireTime = 24 * 60 * 60 * 1000 // 24小时

      if (!collectedAt || (now - collectedAt) > expireTime) {
        return { valid: false, reason: 'Cookie已过期' }
      }

      // 检查必要字段
      if (!cookieData.sessionid || !cookieData.uid) {
        return { valid: false, reason: 'Cookie数据不完整' }
      }

      return { valid: true, reason: 'Cookie有效' }

    } catch (error) {
      console.error('验证Cookie失败:', error)
      return { valid: false, reason: '验证失败: ' + error.message }
    }
  },
  
  // 获取状态信息
  getStatus() {
    const cookies = this.getCookies()
    
    if (!cookies) {
      return {
        connected: false,
        text: '未登录',
        reason: '未找到Cookie信息',
        lastCollected: null
      }
    }

    const validation = this.validateCookies(cookies)
    
    return {
      connected: validation.valid,
      text: validation.valid ? '已登录' : validation.reason,
      cookies: validation.valid ? cookies : null,
      lastCollected: cookies.collected_at ? new Date(cookies.collected_at).toLocaleString() : null
    }
  }
}

// 方法
const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value
}

const startDrag = (e) => {
  isDragging.value = true
  dragStart.x = e.clientX - position.x
  dragStart.y = e.clientY - position.y
  
  document.addEventListener('mousemove', drag)
  document.addEventListener('mouseup', stopDrag)
}

const drag = (e) => {
  if (!isDragging.value) return
  
  position.x = Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragStart.x))
  position.y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragStart.y))
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', drag)
  document.removeEventListener('mouseup', stopDrag)
}

// 刷新抖音状态
const refreshDouyinStatus = async () => {
  isCheckingStatus.value = true
  
  try {
    const status = douyinCookieManager.getStatus()
    
    douyinStatus.connected = status.connected
    douyinStatus.text = status.text
    douyinStatus.cookies = status.cookies
    douyinStatus.lastCollected = status.lastCollected
    
    console.log('🔄 抖音状态已更新:', status)
    
  } catch (error) {
    console.error('检查抖音状态失败:', error)
    douyinStatus.connected = false
    douyinStatus.text = '检查失败'
    douyinStatus.cookies = null
    douyinStatus.lastCollected = null
  } finally {
    isCheckingStatus.value = false
  }
}

// 收集当前页面的抖音Cookie
const collectDouyinCookies = async () => {
  isCollectingCookies.value = true
  
  try {
    const cookies = await douyinCookieManager.collectCookies()
    
    // 更新状态
    await refreshDouyinStatus()
    
    const loadsh = _require('loadsh')
    if (loadsh && loadsh.showToast) {
      loadsh.showToast({
        message: '✅ 抖音Cookie获取成功！'
      })
    }
    
    console.log('✅ 抖音Cookie获取成功:', cookies)
    
  } catch (error) {
    console.error('❌ 获取抖音Cookie失败:', error)
    
    const loadsh = _require('loadsh')
    if (loadsh && loadsh.showToast) {
      loadsh.showToast({
        message: `❌ 获取失败: ${error.message}`
      })
    }
  } finally {
    isCollectingCookies.value = false
  }
}

// 一键搬品处理
const handleOneClickMove = async () => {
  if (!douyinStatus.connected) {
    const loadsh = _require('loadsh')
    if (loadsh && loadsh.showToast) {
      loadsh.showToast({
        message: '请先登录抖音！'
      })
    }
    return
  }
  
  isProcessing.value = true
  progress.show = true
  progress.text = '开始处理...'
  progress.percentage = 0
  progress.status = 'active'
  
  try {
    // 获取当前页面的商品信息
    const CR = _require('chromeRedux')
    const appData = await CR.get('DOUYIN_GOODS2')
    
    if (!appData || !appData.goodsInfo) {
      throw new Error('未找到商品信息，请先访问商品页面')
    }
    
    updateProgress('获取商品信息...', 20)
    
    // 检查必要信息
    const { goodsInfo } = appData
    if (!goodsInfo.mainImages?.length) {
      throw new Error('商品主图信息不完整')
    }
    
    updateProgress('准备上传到抖音...', 40)
    
    // 这里调用实际的搬品逻辑
    await processGoodsTransfer(goodsInfo)
    
    updateProgress('完成！', 100)
    progress.status = 'success'
    
    const loadsh = _require('loadsh')
    if (loadsh && loadsh.showToast) {
      loadsh.showToast({
        message: '搬品完成！'
      })
    }
    
    setTimeout(() => {
      progress.show = false
    }, 3000)
    
  } catch (error) {
    console.error('搬品失败:', error)
    progress.text = `失败: ${error.message}`
    progress.status = 'exception'
    
    const loadsh = _require('loadsh')
    if (loadsh && loadsh.showToast) {
      loadsh.showToast({
        message: `搬品失败: ${error.message}`
      })
    }
    
    setTimeout(() => {
      progress.show = false
    }, 5000)
  } finally {
    isProcessing.value = false
  }
}

// 更新进度
const updateProgress = (text, percentage) => {
  progress.text = text
  progress.percentage = percentage
}

// 处理商品转移（实际的搬品逻辑）
const processGoodsTransfer = async (goodsInfo) => {
  const loadsh = _require('loadsh')
  
  // 验证商品信息完整性
  if (!goodsInfo) {
    throw new Error('商品信息为空')
  }
  
  if (!goodsInfo.mainImages?.length) {
    throw new Error('商品主图信息缺失')
  }
  
  if (!goodsInfo.baseInfo?.title_info?.title) {
    throw new Error('商品标题信息缺失')
  }
  
  updateProgress('验证抖音Cookie...', 50)
  
  // 验证抖音Cookie
  const cookies = douyinCookieManager.getCookies()
  const validation = douyinCookieManager.validateCookies(cookies)
  if (!validation.valid) {
    throw new Error(`抖音Cookie验证失败: ${validation.reason}`)
  }
  
  updateProgress('准备商品数据...', 60)
  
  // 准备商品基础信息
  const productData = {
    title: goodsInfo.baseInfo.title_info.title,
    safeTitle: goodsInfo.baseInfo.title_info.safeTitle || goodsInfo.baseInfo.title_info.title.replace(/\//g, ""),
    mainImages: goodsInfo.mainImages,
    detailImages: goodsInfo.detailImages || [],
    categoryIds: goodsInfo.categoryIds || [],
    skuInfo: goodsInfo.skuInfo || {}
  }
  
  updateProgress('生成商品链接...', 70)
  
  // 构建抖音商品创建链接
  const createUrl = 'https://fxg.jinritemai.com/ffa/g/create'
  
  // 设置状态为准备上传
  const CR = _require('chromeRedux')
  await CR.commit('DOUYIN_GOODS2/SET_STEP', 'AI_PUT_GOODS_INFO')
  
  updateProgress('打开商品创建页面...', 80)
  
  // 在新窗口中打开抖音商品创建页面
  const newWindow = window.open(createUrl, '_blank')
  
  if (!newWindow) {
    throw new Error('无法打开新窗口，请检查浏览器弹窗设置')
  }
  
  updateProgress('商品创建页面已打开...', 90)
  
  // 显示提示信息
  if (loadsh && loadsh.showToast) {
    loadsh.showToast({
      message: `商品创建页面已打开，将自动填充：\n标题：${productData.title.slice(0, 20)}...\n主图：${productData.mainImages.length}张\n详图：${productData.detailImages.length}张`,
      duration: 5000
    })
  }
  
  // 记录搬品操作
  console.log('🚀 一键搬品操作完成:', {
    title: productData.title,
    mainImageCount: productData.mainImages.length,
    detailImageCount: productData.detailImages.length,
    categoryIds: productData.categoryIds,
    timestamp: new Date().toLocaleString()
  })
}

// 生命周期
onMounted(() => {
  console.log('🎉 一键搬品工具已加载')
  // 初始化时检查抖音状态
  refreshDouyinStatus()
})

onUnmounted(() => {
  document.removeEventListener('mousemove', drag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style>
.jinritemai-floating-toolbox {
  width: 300px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e8e8e8;
  overflow: hidden;
}

.jinritemai-floating-toolbox .toolbox-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 12px;
  cursor: move;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
}

.jinritemai-floating-toolbox .toolbox-title {
  font-size: 13px;
  font-weight: 500;
}

.jinritemai-floating-toolbox .toolbox-actions {
  display: flex;
  gap: 4px;
}

.jinritemai-floating-toolbox .minimize-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 14px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.jinritemai-floating-toolbox .minimize-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.jinritemai-floating-toolbox .toolbox-content {
  padding: 16px;
}

.jinritemai-floating-toolbox .status-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.jinritemai-floating-toolbox .status-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.jinritemai-floating-toolbox .status-label {
  font-size: 12px;
  color: #666;
  margin-right: 8px;
}

.jinritemai-floating-toolbox .status-value {
  font-size: 12px;
  font-weight: 500;
}

.jinritemai-floating-toolbox .status-connected {
  color: #52c41a;
}

.jinritemai-floating-toolbox .status-disconnected {
  color: #ff4d4f;
}

.jinritemai-floating-toolbox .login-tips {
  font-size: 11px;
  color: #999;
  line-height: 1.4;
}

.jinritemai-floating-toolbox .last-collected {
  font-size: 10px;
  color: #666;
  margin-top: 4px;
  padding: 4px;
  background: #f0f0f0;
  border-radius: 3px;
}

.jinritemai-floating-toolbox .action-section {
  margin-bottom: 16px;
}

.jinritemai-floating-toolbox .progress-section {
  padding: 12px;
  background: #f0f2f5;
  border-radius: 6px;
}

.jinritemai-floating-toolbox .progress-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}
</style>