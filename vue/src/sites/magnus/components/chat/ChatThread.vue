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
            <MagnusIcon name="copy" :size="15" />
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
            <button class="mda-btn mda-btn-primary" type="button" :disabled="connectAgentStore.loading" @click="connectCodex">
              {{ connectAgentStore.loading ? '检查中...' : '连接 Codex' }}
            </button>
          </div>
          <div v-if="message.action === 'locator-settings'" class="mda-message-actions">
            <button class="mda-inline-text-btn" type="button" @click="commands.openSettings('locator')">
              配置 Locator 专用模型
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
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useMagnusCommands } from '../../app/runtime/commands';
import { useChatStore } from '../../stores/chat.store';
import { useProjectStore } from '../../stores/project.store';
import { useSearchStore } from '../../stores/search.store';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import { buildLogChain, serializeLogs } from '../../app/presenters/log-chain';
import MagnusIcon from '../common/MagnusIcon.vue';

const commands = useMagnusCommands();
const chatStore = useChatStore();
const projectStore = useProjectStore();
const searchStore = useSearchStore();
const connectAgentStore = useConnectAgentStore();
const messages = computed(() => chatStore.messages);
const sourceServiceStatus = computed(() => projectStore.serviceStatus);
const sourceServiceError = computed(() => projectStore.serviceError);
const candidateError = computed(() => searchStore.error);
const nowTick = ref(Date.now());
const logOpenState = ref({});
const logNodeOpenState = ref({});
let clockTimer = 0;

async function connectCodex() {
  await connectAgentStore.connectDefaultAgent(projectStore.current?.path || '');
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
  if (role === 'agent') return '模型';
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
