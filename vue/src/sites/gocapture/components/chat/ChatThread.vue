<template>
  <section class="mda-chat-thread" aria-label="页面改造对话">
    <article
      v-for="message in messages"
      :key="message.id"
      class="mda-chat-message"
      :class="`is-${message.role}`"
    >
      <div class="mda-message-avatar">{{ avatarText(message.role) }}</div>
      <div class="mda-message-bubble">
        <div v-if="showMessageWork(message)" class="mda-message-work">
          <button
            v-if="hasLogs(message)"
            class="mda-message-work-toggle"
            type="button"
            :aria-expanded="String(isLogExpanded(message.id, message.logExpanded))"
            @click="toggleLog(message.id, message.logExpanded)"
          >
            <span class="mda-message-work-label">{{ messageWorkLabel(message) }}</span>
            <i class="mda-message-work-caret" :class="{ 'is-open': isLogExpanded(message.id, message.logExpanded) }" />
          </button>
          <div v-else class="mda-message-work-label">{{ messageWorkLabel(message) }}</div>
          <button
            v-if="hasLogs(message)"
            class="mda-message-log-copy"
            type="button"
            title="复制全部日志"
            aria-label="复制全部日志"
            @click="copyAllLogs(message.logs)"
          >
            <GoCaptureIcon name="copy" :size="15" />
          </button>
        </div>
        <div v-if="hasLogs(message) && isLogExpanded(message.id, message.logExpanded)" class="mda-message-logs">
          <div class="mda-log-chain" role="list" aria-label="Agent 调用链">
            <div
              v-for="(node, logIndex) in logChain(message.logs)"
              :key="node.id"
              class="mda-log-node"
              :class="`is-${node.kind}`"
              role="listitem"
            >
              <span class="mda-log-node-marker" aria-hidden="true" />
              <div class="mda-log-node-body">
                <button
                  v-if="node.expandable"
                  class="mda-log-node-head is-expandable"
                  type="button"
                  :aria-expanded="String(isNodeExpanded(message.id, logIndex, node.kind))"
                  @click="toggleNode(message.id, logIndex, node.kind)"
                >
                  <span class="mda-log-node-actor">{{ node.actor }}</span>
                  <span class="mda-log-node-title">{{ node.title }}</span>
                  <i class="mda-message-work-caret" :class="{ 'is-open': isNodeExpanded(message.id, logIndex, node.kind) }" />
                </button>
                <div v-else class="mda-log-node-head">
                  <span class="mda-log-node-actor">{{ node.actor }}</span>
                  <span class="mda-log-node-title">{{ node.title }}</span>
                </div>
                <template v-if="isCandidateLog(node.raw)">
                  <div class="mda-message-log-item is-candidate-log">
                    <span class="mda-log-file-label">{{ candidatePrefix(node.raw) }}</span>
                    <button class="mda-log-file-link" type="button" @click="commands.openSourceFile(candidateFile(node.raw))">
                      {{ candidateFile(node.raw) }}
                    </button>
                  </div>
                </template>
                <pre
                  v-else-if="node.expandable && isNodeExpanded(message.id, logIndex, node.kind)"
                  class="mda-message-log-pre"
                >{{ node.raw }}</pre>
              </div>
            </div>
          </div>
        </div>
        <div class="mda-message-content" :class="{ 'has-work': showMessageWork(message) }">
          <div v-if="message.title" class="mda-message-title">{{ message.title }}</div>
          <div v-if="message.text" class="mda-message-text">{{ message.text }}</div>
          <pre v-if="message.pre" class="mda-message-pre">{{ message.pre }}</pre>
          <div v-if="message.action === 'choose-project'" class="mda-message-actions">
            <button class="mda-btn mda-btn-primary" type="button" :disabled="sourceServiceStatus === 'loading'" @click="commands.selectProject">
              {{ sourceServiceStatus === 'loading' ? '选择中' : '选择源码' }}
            </button>
          </div>
          <div v-if="message.action === 'copy-prompt'" class="mda-message-actions">
            <button class="mda-btn" type="button" @click="commands.copyPrompt">复制提示词</button>
          </div>
          <div v-if="message.action === 'connect-agent'" class="mda-message-actions">
            <button class="mda-btn mda-btn-primary" type="button" :disabled="connectAgentStore.loading" @click="openAgentPicker">
              {{ connectAgentStore.loading ? '检查中...' : '关联开发 Agent' }}
            </button>
          </div>
          <div v-if="message.action === 'agent-settings'" class="mda-project-config-actions">
            <button class="mda-project-config-card is-locator-step" type="button" @click="commands.openSettings('locator')">
              <span class="mda-project-config-main">
                <em>可选职责 · 前置定位</em>
                <strong>Locator</strong>
                <small>未配置时由开发 Agent 直接定位</small>
              </span>
              <b>配置</b>
              <span class="mda-locator-card-help">
                为什么配置 Locator？
                <span class="mda-locator-help-tip" role="tooltip">
                  Locator 可先用成本更低的模型定位源码，再把精确位置交给关联 Agent，减少主 Agent 的检索轮次和 Token 消耗。
                </span>
              </span>
            </button>
            <button class="mda-project-config-card" type="button" @click="openAgentPicker">
              <span class="mda-project-config-main">
                <em>主要职责 · 开发执行</em>
                <strong>开发 Agent</strong>
                <small>{{ activeAgentLabel }}</small>
              </span>
              <b>重新选择</b>
            </button>
          </div>
          <time
            v-if="message.createdAt"
            class="mda-message-time"
            :datetime="messageDateTime(message.createdAt)"
            :title="messageFullTime(message.createdAt)"
          >{{ messageTime(message.createdAt) }}</time>
        </div>
      </div>
    </article>

    <div v-if="sourceServiceError" class="mda-warning">{{ sourceServiceError }}</div>
    <div v-if="candidateError" class="mda-warning">{{ candidateError }}</div>

    <Teleport to="body">
      <div
        v-if="connectAgentStore.threadPickerVisible"
        class="mda-thread-picker-backdrop"
        role="presentation"
        @click.self="connectAgentStore.closeThreadPicker"
      >
        <section class="mda-thread-picker" role="dialog" aria-modal="true" aria-label="选择开发 Agent">
          <header class="mda-thread-picker-head">
            <div>
              <h2>选择开发 Agent</h2>
              <p>Agent 与当前项目关联；支持任务绑定的 Agent 会继续使用所选任务上下文。</p>
            </div>
            <button
              class="mda-thread-picker-close"
              type="button"
              aria-label="关闭"
              @click="connectAgentStore.closeThreadPicker"
            >
              <GoCaptureIcon name="close" :size="18" />
            </button>
          </header>

          <div class="mda-agent-provider-grid" aria-label="可用 Agent">
            <button
              v-for="provider in connectAgentStore.providers"
              :key="provider.id"
              class="mda-agent-provider-card"
              :class="{ 'is-selected': connectAgentStore.pickerProviderId === provider.id }"
              type="button"
              :disabled="connectAgentStore.loading"
              @click="chooseAgent(provider.id)"
            >
              <span class="mda-agent-provider-icon">
                <GoCaptureIcon name="agent" :size="22" />
              </span>
              <span class="mda-agent-provider-main">
                <strong>{{ provider.name }}</strong>
                <small>{{ providerSummary(provider) }}</small>
              </span>
              <span class="mda-agent-provider-state" :class="{ 'is-connected': provider.connected }">
                {{ provider.connected ? '已连接' : provider.installed ? '可连接' : '未安装' }}
              </span>
            </button>
          </div>

          <div v-if="connectAgentStore.threadLoading" class="mda-thread-picker-state">正在读取 Agent 任务…</div>
          <template v-else-if="connectAgentStore.pickerProvider?.supportsThreadBinding">
            <ThreadGroup
              title="当前项目"
              :empty-text="`${connectAgentStore.pickerProvider.name} 中还没有这个项目的任务`"
              :threads="connectAgentStore.threadGroups.project"
              :binding-id="connectAgentStore.bindingThreadId"
              @bind="bindAgentThread"
            />
            <ThreadGroup
              title="最近"
              :empty-text="`没有可绑定的最近任务，请先在 ${connectAgentStore.pickerProvider.name} 中新建任务`"
              :threads="connectAgentStore.threadGroups.recent"
              :binding-id="connectAgentStore.bindingThreadId"
              @bind="bindAgentThread"
            />
          </template>
          <div v-else-if="connectAgentStore.pickerProvider?.connected" class="mda-agent-provider-note">
            {{ connectAgentStore.pickerProvider.name }} 已关联。首次发送开发需求时会为当前项目建立并保存会话。
          </div>
          <p v-if="connectAgentStore.connectionError" class="mda-thread-picker-error">
            {{ connectAgentStore.connectionError }}
          </p>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useGoCaptureCommands } from '../../app/runtime/commands';
import { useChatStore } from '../../stores/chat.store';
import { useProjectStore } from '../../stores/project.store';
import { useSearchStore } from '../../stores/search.store';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import { buildLogChain, serializeLogs } from '../../app/presenters/log-chain';
import GoCaptureIcon from '../common/GoCaptureIcon.vue';
import ThreadGroup from './ThreadGroup.vue';

const commands = useGoCaptureCommands();
const chatStore = useChatStore();
const projectStore = useProjectStore();
const searchStore = useSearchStore();
const connectAgentStore = useConnectAgentStore();
const messages = computed(() => chatStore.messages);
const sourceServiceStatus = computed(() => projectStore.serviceStatus);
const sourceServiceError = computed(() => projectStore.serviceError);
const candidateError = computed(() => searchStore.error);
const activeAgentLabel = computed(() => {
  const provider = connectAgentStore.activeProvider;
  if (!provider) return '选择 Agent';
  return `${provider.name}${provider.projectThreadName ? ` · ${provider.projectThreadName}` : ''}`;
});
const nowTick = ref(Date.now());
const logOpenState = ref({});
const logNodeOpenState = ref({});
let clockTimer = 0;

async function openAgentPicker() {
  await connectAgentStore.openAgentPicker(projectStore.current?.path || '');
}

async function chooseAgent(providerId) {
  await connectAgentStore.chooseProvider(providerId);
}

async function bindAgentThread(threadId) {
  await connectAgentStore.bindThread(projectStore.current?.path || '', threadId);
}

function providerSummary(provider) {
  if (!provider.installed) return provider.message || '未检测到本地 CLI';
  if (provider.projectThreadName) return provider.projectThreadName;
  if (provider.supportsThreadBinding) return '选择一个项目任务继续对话';
  return provider.message || '首次开发时建立项目会话';
}

watch(messages, nextMessages => {
  const nextState = {};
  for (const message of nextMessages || []) {
    if (!message?.id) continue;
    if (Object.prototype.hasOwnProperty.call(logOpenState.value, message.id)) {
      nextState[message.id] = logOpenState.value[message.id];
    } else {
      nextState[message.id] = !!message.logExpanded;
    }
  }
  logOpenState.value = nextState;
}, { immediate: true });

onMounted(() => {
  clockTimer = window.setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  window.clearInterval(clockTimer);
});

function avatarText(role) {
  if (role === 'user') return '你';
  if (role === 'agent') return 'Agent';
  return '系统';
}

function hasLogs(message) {
  return Array.isArray(message?.logs) && message.logs.length > 0;
}

function showMessageWork(message) {
  return message?.role !== 'user' && (hasLogs(message) || Number(message?.durationStartedAt || 0) > 0);
}

function isLogExpanded(id, fallback) {
  if (!id) return !!fallback;
  return Object.prototype.hasOwnProperty.call(logOpenState.value, id) ? logOpenState.value[id] : !!fallback;
}

function toggleLog(id, fallback) {
  logOpenState.value = {
    ...logOpenState.value,
    [id]: !isLogExpanded(id, fallback)
  };
}

function logChain(logs) {
  return buildLogChain(logs || []);
}

function nodeKey(messageId, index) {
  return `${messageId}:${index}`;
}

function nodeDefaultExpanded(kind) {
  return kind === 'llm-output' || kind === 'tool-call' || kind === 'decision' || kind === 'error';
}

function isNodeExpanded(messageId, index, kind) {
  const key = nodeKey(messageId, index);
  return Object.prototype.hasOwnProperty.call(logNodeOpenState.value, key)
    ? logNodeOpenState.value[key]
    : nodeDefaultExpanded(kind);
}

function toggleNode(messageId, index, kind) {
  const key = nodeKey(messageId, index);
  logNodeOpenState.value = {
    ...logNodeOpenState.value,
    [key]: !isNodeExpanded(messageId, index, kind)
  };
}

function copyAllLogs(logs) {
  commands.copyText(serializeLogs(logs || []));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function messageDurationMs(message) {
  const startedAt = Number(message?.durationStartedAt || 0);
  if (!startedAt) return 0;
  const finishedAt = Number(message?.durationFinishedAt || 0);
  return Math.max(0, (finishedAt || nowTick.value) - startedAt);
}

function messageWorkLabel(message) {
  const duration = messageDurationMs(message);
  return `${message?.durationActive ? '处理中' : '已处理'} ${formatDuration(duration)}`;
}

function messageDate(value) {
  const date = new Date(Number(value || 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function messageTime(value) {
  const date = messageDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

function messageFullTime(value) {
  const date = messageDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

function messageDateTime(value) {
  return messageDate(value)?.toISOString() || '';
}

function isCandidateLog(log) {
  return /^候选\s+\d+:\s+/.test(log) || /^文件:\s+/.test(log);
}

function candidatePrefix(log) {
  const match = String(log || '').match(/^(候选\s+\d+:\s+|文件:\s+)/);
  return match ? match[1] : '';
}

function candidateFile(log) {
  return String(log || '').replace(/^(候选\s+\d+:\s+|文件:\s+)/, '').trim();
}
</script>
