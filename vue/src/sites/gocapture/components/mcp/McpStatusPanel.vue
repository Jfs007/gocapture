<template>
  <div v-if="visible" class="mda-mcp-overlay" @click.self="$emit('close')">
    <section class="mda-mcp-panel" role="dialog" aria-label="MCP 状态">
      <header class="mda-mcp-head">
        <span class="mda-mcp-title">MCP 服务</span>
        <div class="mda-mcp-head-actions">
          <button class="mda-mcp-btn" type="button" :disabled="loading" @click="reload">
            {{ loading ? '处理中…' : '重新加载' }}
          </button>
          <button class="mda-mcp-btn" type="button" :disabled="loading" @click="refresh">
            {{ loading ? '刷新中…' : '刷新' }}
          </button>
          <button class="mda-mcp-btn" type="button" @click="$emit('close')">关闭</button>
        </div>
      </header>

      <div class="mda-mcp-body">
        <div v-if="error" class="mda-mcp-error">读取失败：{{ error }}</div>

        <div class="mda-mcp-config">
          <div><strong>用户配置</strong><code>{{ config.user || '~/.gocapture/mcp.json' }}</code></div>
          <div><strong>项目配置</strong><code>{{ config.project || '<projectRoot>/.mcp.json' }}</code></div>
        </div>

        <div class="mda-mcp-section-title">已登记的 MCP（{{ servers.length }}）</div>
        <div v-if="!servers.length" class="mda-mcp-empty">
          暂无。请在项目根放 <code>.mcp.json</code> 或 <code>~/.gocapture/mcp.json</code> 后重新绑定项目。
        </div>
        <ul v-else class="mda-mcp-servers">
          <li v-for="server in servers" :key="server.name" class="mda-mcp-server">
            <div class="mda-mcp-server-head">
              <span class="mda-mcp-dot" :class="server.status === 'ready' ? 'is-ready' : 'is-failed'" />
              <span class="mda-mcp-server-name">{{ server.name }}</span>
              <span class="mda-mcp-server-status">{{ server.status === 'ready' ? `就绪 · ${server.toolCount} 个工具` : (server.status === 'failed' ? '失败' : server.status) }}</span>
              <button v-if="server.status === 'ready'" class="mda-mcp-mini-btn" type="button" :disabled="loading" @click="stop(server.name)">停止</button>
            </div>
            <div v-if="server.error" class="mda-mcp-server-error">{{ server.error }}</div>
            <ul v-if="server.tools && server.tools.length" class="mda-mcp-tools">
              <li v-for="tool in server.tools" :key="tool" class="mda-mcp-tool">{{ tool }}</li>
            </ul>
          </li>
        </ul>

        <div class="mda-mcp-section-title">日志</div>
        <div class="mda-mcp-logs">
          <div v-if="!logs.length" class="mda-mcp-empty">暂无日志</div>
          <div v-for="(log, index) in logs" :key="index" class="mda-mcp-log">
            <span class="mda-mcp-log-time">{{ formatTime(log.at) }}</span>
            <span class="mda-mcp-log-line">{{ log.line }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useMcpStatus } from '../../app/services/use-mcp-status';

const props = defineProps<{ visible: boolean }>();
defineEmits<{ (event: 'close'): void }>();

const { servers, logs, config, loading, error, refresh, reload, stop, startPolling, stopPolling } = useMcpStatus();

watch(() => props.visible, open => {
  if (open) startPolling();
  else stopPolling();
}, { immediate: true });

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return '';
  }
}
</script>
