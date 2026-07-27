<template>
  <section class="mda-thread-group">
    <h3>{{ title }}</h3>
    <div v-if="threads.length" class="mda-thread-list">
      <button
        v-for="thread in threads"
        :key="thread.id"
        class="mda-thread-row"
        type="button"
        :disabled="!!bindingId"
        @click="$emit('bind', thread.id)"
      >
        <span class="mda-thread-row-main">
          <strong>{{ thread.name || thread.preview || '未命名任务' }}</strong>
          <span>{{ thread.preview || thread.cwd || thread.id }}</span>
        </span>
        <span class="mda-thread-row-meta">
          <time>{{ formatThreadTime(thread.updatedAt) }}</time>
          <span>{{ bindingId === thread.id ? '绑定中…' : '绑定' }}</span>
        </span>
      </button>
    </div>
    <p v-else class="mda-thread-group-empty">{{ emptyText }}</p>
  </section>
</template>

<script setup lang="ts">
import type { ConnectAgentThread } from '../../app/services/connect-agent.service';

defineProps<{
  title: string;
  emptyText: string;
  threads: ConnectAgentThread[];
  bindingId: string;
}>();

defineEmits<{
  (event: 'bind', threadId: string): void;
}>();

function formatThreadTime(seconds: number) {
  if (!seconds) return '';
  return new Date(seconds * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
</script>
