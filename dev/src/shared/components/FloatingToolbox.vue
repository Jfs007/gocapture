<template>
  <div
    class="floating-toolbox"
    :style="toolboxStyle"
    @mousedown="handleMouseDown"
  >
    <div class="toolbox-content">
      <n-button
        type="primary"
        size="small"
        @click="handleGetVideos"
      >
        获取当前视频
      </n-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { NButton } from 'naive-ui'

// 工具箱位置状态
const position = ref({ x: 20, y: 100 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

// 样式计算
const toolboxStyle = computed(() => ({
  position: 'fixed',
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  zIndex: 10000,
  backgroundColor: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: '6px',
  padding: '8px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  cursor: isDragging.value ? 'grabbing' : 'grab',
  userSelect: 'none'
}))

// 拖拽处理
const handleMouseDown = (e) => {
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (e) => {
  if (!isDragging.value) return
  
  position.value = {
    x: e.clientX - dragOffset.value.x,
    y: e.clientY - dragOffset.value.y
  }
}

const handleMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 事件发射
const emit = defineEmits(['open-modal'])

const handleGetVideos = () => {
  console.log('获取当前视频')
  emit('open-modal')
}
</script>

<style scoped>
.floating-toolbox {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.toolbox-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>