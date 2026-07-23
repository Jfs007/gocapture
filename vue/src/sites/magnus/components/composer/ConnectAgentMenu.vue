<template>
  <div ref="rootRef" class="mda-add-menu">
    <button
      ref="triggerRef"
      class="mda-add-trigger"
      type="button"
      title="添加"
      aria-label="添加"
      :aria-expanded="visible"
      @click="toggle"
    >
      <MagnusIcon name="add" :size="22" />
    </button>

    <PopoverPanel
      :visible="visible"
      :anchor-rect="anchorRect"
      :width="360"
      :max-height="300"
      placement="top"
    >
      <div class="mda-add-panel">
        <div class="mda-add-panel-title">添加</div>
        <div class="mda-add-section-title">连接</div>
        <button
          class="mda-connect-agent-row"
          type="button"
          :disabled="busy"
          @click="toggleCodexConnection"
        >
          <span class="mda-connect-agent-icon">C</span>
          <span class="mda-connect-agent-copy">
            <strong>Codex</strong>
            <span>{{ codexDescription }}</span>
          </span>
          <span class="mda-connect-agent-action" :class="`is-${codex?.state || 'checking'}`">
            {{ codexAction }}
          </span>
        </button>
        <div v-if="errorText" class="mda-connect-agent-error">
          {{ errorText }}
        </div>
      </div>
    </PopoverPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
  connectAgent,
  disconnectAgent,
  listConnectAgents,
} from '../../app/services/connect-agent.service';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import MagnusIcon from '../common/MagnusIcon.vue';
import PopoverPanel from '../common/PopoverPanel.vue';

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const visible = ref(false);
const anchorRect = ref<DOMRect | null>(null);
const connectAgentStore = useConnectAgentStore();
const { providers, loading: busy, connectionError: errorText } = storeToRefs(connectAgentStore);

const codex = computed(() => providers.value.find(provider => provider.id === 'codex') || null);
const codexDescription = computed(() => {
  if (busy.value) return codex.value?.state === 'connected' ? '正在断开…' : '正在检查并连接…';
  return codex.value?.message || '检查 Codex 环境后连接';
});
const codexAction = computed(() => {
  if (busy.value) return '处理中';
  if (codex.value?.connected) return '断开';
  if (codex.value?.state === 'login-required') return '需登录';
  if (codex.value?.state === 'unavailable') return '未安装';
  if (codex.value?.state === 'error') return '重试';
  return '连接';
});

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointerDown, true);
  window.addEventListener('resize', updateAnchorRect);
  window.addEventListener('scroll', updateAnchorRect, true);
  refreshProviders(false);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
  window.removeEventListener('resize', updateAnchorRect);
  window.removeEventListener('scroll', updateAnchorRect, true);
});

async function toggle() {
  visible.value = !visible.value;
  if (!visible.value) return;
  errorText.value = '';
  await nextTick();
  updateAnchorRect();
  await refreshProviders(true);
}

function updateAnchorRect() {
  anchorRect.value = triggerRef.value?.getBoundingClientRect() || null;
}

async function refreshProviders(refresh: boolean) {
  busy.value = true;
  try {
    connectAgentStore.setProviders(await listConnectAgents(refresh));
  } catch (error: any) {
    errorText.value = error?.message || '无法检查 Codex 连接状态';
  } finally {
    busy.value = false;
  }
}

async function toggleCodexConnection() {
  if (busy.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    const provider = codex.value?.connected
      ? await disconnectAgent('codex')
      : await connectAgent('codex');
    connectAgentStore.upsertProvider(provider);
  } catch (error: any) {
    errorText.value = error?.message || 'Codex 连接失败';
    await refreshProviders(false);
  } finally {
    busy.value = false;
  }
}

function handleOutsidePointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!visible.value || !target) return;
  if (rootRef.value?.contains(target)) return;
  const panel = document.querySelector('.mda-add-panel');
  if (panel?.contains(target)) return;
  visible.value = false;
}
</script>
