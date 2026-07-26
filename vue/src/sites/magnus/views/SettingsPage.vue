<template>
  <main class="mda-settings-page">
    <input
      ref="fileInputRef"
      class="mda-file-input"
      type="file"
      webkitdirectory
      multiple
      @change="onFileInputChange"
    >
    <MemorySettingsPanel
      mode="page"
      :model-runtime="state.model"
      @back="goBack"
      @select-project="chooseProjectAndReload"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import MemorySettingsPanel from '../components/settings/MemorySettingsPanel.vue';
import { createMagnusRuntimeState } from '../app/runtime/create-runtime-state';
import { sourceServerJson } from '../app/services/source-service';
import { readLatestPanelBinding } from '../app/infrastructure/side-panel.adapter';
import { useMemoryStore } from '../stores/memory.store';
import type { MagnusRuntimeContext } from '../app/runtime/context';

const props = defineProps<{
  api: Record<string, any>;
}>();
const panelTicket = ref('');
const initialParams = new URLSearchParams(window.location.search);
const initialRecent = readLatestPanelBinding() || {};
const targetPageHref = ref(initialParams.get('pageUrl') || initialRecent?.page?.url || '');

const runtime: MagnusRuntimeContext = {
  api: {
    ...props.api,
    sidePanel: false
  },
  currentPageHref: targetPageHref,
  sidePanelConfig: computed(() => ({
    ...(props.api.sidePanelConfig || {}),
    panelTicket: panelTicket.value
  })),
  routePagePath: computed(() => window.location.pathname),
  pageHost: computed(() => 'settings')
};

const state = createMagnusRuntimeState(runtime);
const memory = useMemoryStore();
const fileInputRef = state.source.fileInputRef;
const onFileInputChange = state.source.onFileInputChange;

onMounted(async () => {
  await ensurePanelTicket();
  state.bridge.connectSidePanelBridge();
  await state.source.restoreSavedProject();
  await memory.load();
});

onBeforeUnmount(() => {
  state.bridge.disconnectSidePanelBridge();
});

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.close();
}

async function chooseProjectAndReload() {
  await state.source.chooseProject();
  await memory.load();
}

async function ensurePanelTicket() {
  if (panelTicket.value) return;
  const params = new URLSearchParams(window.location.search);
  const recent = readLatestPanelBinding() || {};
  const workspaceId = params.get('workspaceId') || recent.workspaceId || '';
  const tabId = Number(params.get('tabId') || recent.browserTabId || 0);
  const windowId = Number(params.get('windowId') || recent.windowId || 0);
  if (!workspaceId && !tabId) {
    panelTicket.value = params.get('panelTicket') || '';
    return;
  }
  const result = await sourceServerJson('/api/panel/bind', {
    method: 'POST',
    body: {
      workspaceId,
      tabId,
      windowId,
      page: recent.page || null
    },
    timeoutMs: 5000,
    timeoutMessage: '设置页绑定当前页面超时'
  });
  panelTicket.value = result?.panelTicket || '';
  const pageUrl = result?.snapshot?.page?.url || recent?.page?.url || params.get('pageUrl') || '';
  if (pageUrl) targetPageHref.value = pageUrl;
}
</script>
