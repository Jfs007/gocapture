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
        <div v-if="message.title" class="mda-message-title">{{ message.title }}</div>
        <div v-if="message.text" class="mda-message-text">{{ message.text }}</div>
        <pre v-if="message.pre" class="mda-message-pre">{{ message.pre }}</pre>
        <details v-if="message.logs && message.logs.length" class="mda-log-flow">
          <summary>{{ message.logTitle || '查看检索日志' }}</summary>
          <ol>
            <li
              v-for="(log, logIndex) in message.logs"
              :key="logIndex"
              :class="{ 'is-candidate-log': isCandidateLog(log) }"
            >
              <template v-if="isCandidateLog(log)">
                <span>{{ candidatePrefix(log) }}</span>
                <button class="mda-log-file-link" type="button" @click="api.openSourceFile(candidateFile(log))">
                  {{ candidateFile(log) }}
                </button>
              </template>
              <template v-else>{{ log }}</template>
            </li>
          </ol>
        </details>
        <div v-if="message.action === 'choose-project'" class="mda-message-actions">
          <button class="mda-btn mda-btn-primary" type="button" :disabled="sourceServiceStatus === 'loading'" @click="api.chooseProject">
            {{ sourceServiceStatus === 'loading' ? '选择中' : '选择源码' }}
          </button>
        </div>
        <div v-if="message.action === 'copy-prompt'" class="mda-message-actions">
          <button class="mda-btn" type="button" @click="api.copyPrompt">复制提示词</button>
        </div>
      </div>
    </article>

    <div v-if="sourceServiceError" class="mda-warning">{{ sourceServiceError }}</div>
    <div v-if="candidateError" class="mda-warning">{{ candidateError }}</div>
  </section>
</template>

<script setup>
import { useApi, useForm } from '../ctx';

const messages = useForm('chatMessages');
const sourceServiceStatus = useForm('sourceServiceStatus');
const sourceServiceError = useForm('sourceServiceError');
const candidateError = useForm('candidateError');
const api = useApi();

function avatarText(role) {
  if (role === 'user') return '你';
  if (role === 'agent') return '模型';
  return '系统';
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
