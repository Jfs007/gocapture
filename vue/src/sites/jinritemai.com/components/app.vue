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

    <div class="toolbox-content" v-if="!isMinimized">
      <!-- 工具状态 -->
      <div class="status-section">
        <div class="status-item">
          <span class="status-label">工具状态：</span>
          <span class="status-value status-connected">就绪</span>
        </div>
        <div class="login-tips">
          点击搬品按钮开始操作
        </div>
      </div>
      <!-- 操作按钮 -->
      <div class="action-section">
        <NButton
          class="btn-large"
          type="primary"
          @click="handleOneClickMove"
        >
          一键搬品
        </NButton>
      </div>
    </div>

    <!-- 等待登录模态框 - 使用NModal -->
    <NModal v-model:show="loginModal.show" :mask-closable="false" preset="card" title="等待抖音登录" style="width: 400px;">
      <div class="modal-content">
        <div class="loading-spinner">⟳</div>
        <div class="modal-text">
          <p>请在新打开的抖音页面完成登录</p>
          <p>登录成功后点击"确认登录"按钮</p>
        </div>
      </div>
      <template #footer>
        <div class="modal-footer">
          <NButton @click="cancelLogin" secondary>取消</NButton>
          <NButton @click="confirmLogin" type="primary">确认登录</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<script setup>
// 使用全局的Vue响应式API，确保同一个Vue实例
const { ref, reactive, computed, onMounted, onUnmounted } = window.MdUiComponent;
const { NButton, NModal } = window.MdUiComponent.NaiveUI;

// Vue响应式状态管理
const isMinimized = ref(false);
const isDragging = ref(false);
const loginModal = reactive({ show: false });

// 拖拽状态
const position = reactive({ x: 20, y: 100 });
const dragStart = reactive({ x: 0, y: 0 });

// 计算样式
const floatingStyle = computed(() => ({
  position: 'fixed',
  left: `${position.x}px`,
  top: `${position.y}px`,
  zIndex: 9999
}));

// 收起/展开功能
const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value;
  console.log('✅ 最小化状态已更新:', isMinimized.value);
}

// 一键搬品处理
const handleOneClickMove = () => {
  console.log('🎯 点击一键搬品，显示弹窗');

  // 打开抖音精选页面
  

  // 显示等待登录弹窗
  loginModal.show = true;
  // window.open('https://www.douyin.com/jingxuan', '_blank');
}

// 取消登录
const cancelLogin = () => {
  console.log('取消登录');
  loginModal.show = false;
}

// 确认登录
const confirmLogin = async () => {
  console.log('🔄 确认登录');
  loginModal.show = false;
  // 这里可以添加后续的搬品逻辑
  const loadsh = _require('loadsh');
  const mdChrome = _require("mdChrome");
  const cookies = await mdChrome.web.cmd({
    cmd: 'getCookie',
    myDomain: '.douyin.com'
  });
  const HAOHUO_HREF = location.href;
  const url = new URL(HAOHUO_HREF);
  const product_id = url.searchParams.get("id");
  // https://live.douyin.com/aweme/v1/web/ecom/product/sku/list/
  const res = await mdChrome.web.cmd({
    cmd: "ajax",
    data: `product_id=${product_id}`,
    method: "POST",
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Content-Type":  "application/x-www-form-urlencoded; charset=UTF-8",
      "md-header-Origin": "https://live.douyin.com",
      "md-header-referer": "https://live.douyin.com/",
      cookie: cookies.cookiesStr
    },
    url: "https://live.douyin.com/aweme/v1/web/ecom/product/sku/list/"
  });

  const res2 = await mdChrome.web.cmd({
    cmd: "ajax",
    data: `promotion_ids=${product_id}&ec_promotion_id=${product_id}`,
    method: "POST",
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Content-Type":  "application/x-www-form-urlencoded; charset=UTF-8",
      "md-header-Origin": "https://live.douyin.com",
      "md-header-referer": "https://live.douyin.com/",
      cookie: cookies.cookiesStr
    },
    url: "https://live.douyin.com/ecom/product/detail/saas/pc/"
  });
  console.log(res, res2, 'res');
  if (loadsh && loadsh.showToast) {
    loadsh.showToast({
      message: '登录成功，开始搬品操作！'
    });
  }
}

const startDrag = (e) => {
  isDragging.value = true
  dragStart.x = e.clientX - position.x
  dragStart.y = e.clientY - position.y
  document.addEventListener('mousemove', drag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

const drag = (e) => {
  if (!isDragging.value) return

  position.x = Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragStart.x))
  position.y = Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragStart.y))
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', drag)
  document.removeEventListener('mouseup', stopDrag)
}


// 生命周期
onMounted(() => {
  console.log('🎉 一键搬品工具已加载')
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

.jinritemai-floating-toolbox .login-tips {
  font-size: 11px;
  color: #999;
  line-height: 1.4;
}

.jinritemai-floating-toolbox .action-section {
  margin-bottom: 16px;
}

/* NModal 内容样式 */
.modal-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.loading-spinner {
  font-size: 24px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.modal-text {
  flex: 1;
}

.modal-text p {
  /* margin: 8px 0; */
  font-size: 14px;
  color: #666;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-large {
  width: 100%;
}
</style>