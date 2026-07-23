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
        <div v-for="provider in providers" :key="provider.id" class="mda-connect-agent-item">
          <button
            class="mda-connect-agent-row"
            type="button"
            :disabled="busy || pendingId === provider.id"
            @click="toggleConnection(provider)"
          >
            <span class="mda-connect-agent-icon">{{ providerIcon(provider.id) }}</span>
            <span class="mda-connect-agent-copy">
              <strong>{{ provider.name }}</strong>
              <span>{{ providerDescription(provider) }}</span>
            </span>
            <span class="mda-connect-agent-action" :class="`is-${provider.state || 'checking'}`">
              {{ providerAction(provider) }}
            </span>
          </button>

          <div v-if="authFormId === provider.id" class="mda-cca-auth" @click.stop>
            <div class="mda-cca-tabs">
              <button
                type="button"
                class="mda-cca-tab"
                :class="{ 'is-active': authMode === 'subscription' }"
                @click.stop="authMode = 'subscription'"
              >订阅登录</button>
              <button
                type="button"
                class="mda-cca-tab"
                :class="{ 'is-active': authMode === 'apikey' }"
                @click.stop="authMode = 'apikey'"
              >API Key</button>
            </div>
            <input
              v-model="authInput"
              class="mda-cca-input"
              :type="authMode === 'apikey' ? 'password' : 'text'"
              :placeholder="authMode === 'apikey' ? 'sk-ant-…' : '订阅令牌（可留空）'"
              @keydown.enter.stop="submitAuth(provider)"
              @click.stop
            />
            <p class="mda-cca-hint">
              {{ authMode === 'apikey'
                ? '粘贴 Anthropic API Key。'
                : '留空则用你已在终端登录的 Claude；或粘贴 `claude setup-token` 生成的令牌。' }}
            </p>
            <div class="mda-cca-actions">
              <button type="button" class="mda-cca-btn is-ghost" @click.stop="cancelAuth">取消</button>
              <button
                type="button"
                class="mda-cca-btn is-primary"
                :disabled="pendingId === provider.id"
                @click.stop="submitAuth(provider)"
              >{{ pendingId === provider.id ? '连接中…' : '授权并连接' }}</button>
            </div>
          </div>
        </div>
        <div v-if="errorText" class="mda-connect-agent-error">
          {{ errorText }}
        </div>
      </div>
    </PopoverPanel>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
  connectAgent,
  disconnectAgent,
  listConnectAgents,
  type ConnectAgentAuth,
  type ConnectAgentProvider,
} from '../../app/services/connect-agent.service';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import MagnusIcon from '../common/MagnusIcon.vue';
import PopoverPanel from '../common/PopoverPanel.vue';

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const visible = ref(false);
const anchorRect = ref<DOMRect | null>(null);
const pendingId = ref('');
const authFormId = ref('');
const authMode = ref<'subscription' | 'apikey'>('subscription');
const authInput = ref('');
const connectAgentStore = useConnectAgentStore();
const { providers, loading: busy, connectionError: errorText } = storeToRefs(connectAgentStore);

const PROVIDER_ICONS: Record<string, string> = { codex: 'C', claude: '✦' };
function providerIcon(id: string) {
  return PROVIDER_ICONS[id] || (id ? id[0].toUpperCase() : '·');
}
function providerDescription(provider: ConnectAgentProvider) {
  if (pendingId.value === provider.id) return provider.connected ? '正在断开…' : '正在检查并连接…';
  return provider.message || `检查 ${provider.name} 环境后连接`;
}
function providerAction(provider: ConnectAgentProvider) {
  if (pendingId.value === provider.id) return '处理中';
  if (provider.connected) return '断开';
  if (provider.state === 'login-required') return '需登录';
  if (provider.state === 'unavailable') return '未安装';
  if (provider.state === 'error') return '重试';
  return '连接';
}

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
    errorText.value = error?.message || '无法检查连接状态';
  } finally {
    busy.value = false;
  }
}

function toggleConnection(provider: ConnectAgentProvider) {
  if (busy.value || pendingId.value) return;
  // 已连接 → 断开；需要授权且未连 → 展开授权表单；无授权项(如 Codex) → 直接连接。
  if (provider.connected) { void runToggle(provider); return; }
  if (provider.authModes && provider.authModes.length) { openAuth(provider); return; }
  void runToggle(provider);
}

function openAuth(provider: ConnectAgentProvider) {
  if (authFormId.value === provider.id) { authFormId.value = ''; return; }
  authFormId.value = provider.id;
  authMode.value = (provider.authMode as 'subscription' | 'apikey') || 'subscription';
  authInput.value = '';
  errorText.value = '';
}

function cancelAuth() {
  authFormId.value = '';
  authInput.value = '';
}

function submitAuth(provider: ConnectAgentProvider) {
  const value = authInput.value.trim();
  const auth: ConnectAgentAuth = authMode.value === 'apikey'
    ? { mode: 'apikey', apiKey: value }
    : { mode: 'subscription', oauthToken: value };
  void runToggle(provider, auth);
}

async function runToggle(provider: ConnectAgentProvider, auth?: ConnectAgentAuth) {
  if (pendingId.value) return;
  pendingId.value = provider.id;
  errorText.value = '';
  try {
    const next = provider.connected
      ? await disconnectAgent(provider.id)
      : await connectAgent(provider.id, auth);
    connectAgentStore.upsertProvider(next);
    authFormId.value = '';
  } catch (error: any) {
    errorText.value = error?.message || `${provider.name} 连接失败`;
    await refreshProviders(false);
  } finally {
    pendingId.value = '';
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

