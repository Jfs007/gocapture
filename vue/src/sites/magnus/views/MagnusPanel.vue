<template>
  <main class="mda-root">
    <section
      class="mda-panel"
      aria-label="Magnus"
    >
      <header class="mda-head">
        <div class="mda-head-main">
          <div class="mda-title">
            <img class="mda-title-logo" :src="magnusLogo" alt="Magnus">
          </div>
          <div class="mda-subtitle">{{ pageHost }}</div>
        </div>
        <div class="mda-head-actions">
          <span
            class="mda-head-icon"
            role="button"
            tabindex="0"
            title="重新绑定当前页面"
            aria-label="重新绑定当前页面"
            @click="rebindSidePanel"
            @keydown.enter.prevent="rebindSidePanel"
            @keydown.space.prevent="rebindSidePanel"
          >
            <MagnusIcon name="refresh" :size="19" />
          </span>
          <span
            class="mda-head-icon"
            role="button"
            tabindex="0"
            title="打开设置"
            aria-label="打开设置"
            @click="openSettings"
            @keydown.enter.prevent="openSettings"
            @keydown.space.prevent="openSettings"
          >
            <MagnusIcon name="cog" :size="20" />
          </span>
        </div>
      </header>

      <div v-if="serviceOnline === false" class="mda-service-down" role="alert">
        <span class="mda-service-down-icon">⚠</span>
        <div class="mda-service-down-main">
          <div class="mda-service-down-title">本地服务不可达</div>
          <div class="mda-service-down-hint">
            正在探测 <code>{{ serviceHealthUrl || '/health' }}</code>
            <template v-if="serviceHealthMessage">，失败原因：{{ serviceHealthMessage }}</template>
          </div>
          <div class="mda-service-down-hint">如果服务已启动，请运行 <code>magnus status</code> 检查端口是否一致。</div>
        </div>
        <button class="mda-service-down-retry" type="button" :disabled="retryChecking" @click="retryHealth">
          {{ retryChecking ? '检查中…' : '重试' }}
        </button>
      </div>

      <div v-else-if="updateInfo?.updateAvailable" class="mda-update-bar" role="status">
        <span class="mda-update-icon">⬆</span>
        <div class="mda-update-main">
          <div class="mda-update-title">{{ updateApplying ? '更新中…' : `发现新版本 v${updateInfo.latest}` }}</div>
          <div class="mda-update-hint">{{ updateMessage || `当前 v${updateInfo.current}，可一键更新（服务会自动重启）` }}</div>
        </div>
        <button v-if="!updateApplying" class="mda-update-btn" type="button" @click="applyUpdate">更新</button>
        <span v-else class="mda-update-spinner" aria-hidden="true" />
      </div>

      <div class="mda-body mda-chat-body">
        <input
          ref="fileInputRef"
          class="mda-file-input"
          type="file"
          webkitdirectory
          multiple
          @change="onFileInputChange"
        >
        <ChatThread />
        <ComposerPanel />
      </div>
      <div v-if="projectChecking" class="mda-project-checking" role="status" aria-live="polite">
        <div class="mda-project-checking-box">
          <div class="mda-project-checking-spinner" />
          <div>
            <div class="mda-project-checking-title">正在检查项目</div>
            <div class="mda-project-checking-text">{{ projectCheckingText }}</div>
          </div>
        </div>
      </div>
      <McpStatusPanel :visible="mcpPanelOpen" @close="appUiStore.setMcpPanelOpen(false)" />
    </section>
  </main>
</template>

<script setup lang="ts">
import ChatThread from '../components/chat/ChatThread.vue';
import ComposerPanel from '../components/composer/ComposerPanel.vue';
import MagnusIcon from '../components/common/MagnusIcon.vue';
import McpStatusPanel from '../components/mcp/McpStatusPanel.vue';
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { createMagnusRuntime } from '../app/runtime/create-runtime';
import { useServiceHealth } from '../app/services/use-service-health';
import { useUpdateCheck } from '../app/services/use-update-check';
import { useAppUiStore } from '../stores/app-ui.store';
import { useProjectStore } from '../stores/project.store';
import magnusLogo from '../resources/logo.jpg';

const props = defineProps<{
  api: Record<string, any>;
}>();
const projectStore = useProjectStore();
const appUiStore = useAppUiStore();
const { serviceOnline, serviceHealthMessage, serviceHealthUrl, mcpPanelOpen } = storeToRefs(appUiStore);
const { probe: probeHealth } = useServiceHealth();
const retryChecking = ref(false);
async function retryHealth() {
  retryChecking.value = true;
  try {
    await probeHealth();
  } finally {
    retryChecking.value = false;
  }
}

const { info: updateInfo, applying: updateApplying, applyMessage: updateMessage, apply: applyUpdate } = useUpdateCheck();
const projectChecking = computed(() => {
  return !!projectStore.current && projectStore.serviceStatus === 'loading';
});
const projectCheckingText = computed(() => {
  return projectStore.serviceMessage || '正在读取配置并生成项目上下文...';
});

const {
  fileInputRef,
  onFileInputChange,
  openSettings,
  rebindSidePanel,
  pageHost
} = createMagnusRuntime(props.api);
</script>
