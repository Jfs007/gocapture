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
        </div>
        <div v-if="hasLogs(message) && isLogExpanded(message.id, message.logExpanded)" class="mda-message-logs">
          <div
            v-for="(log, logIndex) in message.logs"
            :key="logIndex"
            class="mda-message-log-item"
            :class="{ 'is-candidate-log': isCandidateLog(log) }"
          >
            <template v-if="isCandidateLog(log)">
              <span class="mda-log-file-label">{{ candidatePrefix(log) }}</span>
              <button class="mda-log-file-link" type="button" @click="api.openSourceFile(candidateFile(log))">
                {{ candidateFile(log) }}
              </button>
            </template>
            <pre v-else-if="isMultilineLog(log)" class="mda-message-log-pre">{{ log }}</pre>
            <template v-else>{{ log }}</template>
          </div>
        </div>
        <div class="mda-message-content" :class="{ 'has-work': showMessageWork(message) }">
          <div v-if="message.title" class="mda-message-title">{{ message.title }}</div>
          <div v-if="message.text" class="mda-message-text">{{ message.text }}</div>
          <pre v-if="message.pre" class="mda-message-pre">{{ message.pre }}</pre>
          <div v-if="message.action === 'choose-project'" class="mda-message-actions">
            <button class="mda-btn mda-btn-primary" type="button" :disabled="sourceServiceStatus === 'loading'" @click="api.chooseProject">
              {{ sourceServiceStatus === 'loading' ? '选择中' : '选择源码' }}
            </button>
          </div>
          <div v-if="message.action === 'copy-prompt'" class="mda-message-actions">
            <button class="mda-btn" type="button" @click="api.copyPrompt">复制提示词</button>
          </div>
        </div>
      </div>
    </article>

    <div v-if="sourceServiceError" class="mda-warning">{{ sourceServiceError }}</div>
    <div v-if="candidateError" class="mda-warning">{{ candidateError }}</div>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useApi, useForm } from '../ctx';

const messages = useForm('chatMessages');
const sourceServiceStatus = useForm('sourceServiceStatus');
const sourceServiceError = useForm('sourceServiceError');
const candidateError = useForm('candidateError');
const api = useApi();
const nowTick = ref(Date.now());
const logOpenState = ref({});
let clockTimer = 0;

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

function isCandidateLog(log) {
  return /^候选\s+\d+:\s+/.test(log) || /^文件:\s+/.test(log);
}

function isMultilineLog(log) {
  return typeof log === 'string' && /\n/.test(log);
}

function candidatePrefix(log) {
  const match = String(log || '').match(/^(候选\s+\d+:\s+|文件:\s+)/);
  return match ? match[1] : '';
}

function candidateFile(log) {
  return String(log || '').replace(/^(候选\s+\d+:\s+|文件:\s+)/, '').trim();
}
</script>
