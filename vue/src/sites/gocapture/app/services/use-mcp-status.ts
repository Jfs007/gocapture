import { onScopeDispose, ref } from 'vue';
import { sourceServerJson } from './source-service';

export interface McpServerStatus {
  name: string;
  status: 'ready' | 'failed' | string;
  toolCount: number;
  tools: string[];
  error?: string;
  updatedAt?: string;
}

export interface McpLogLine {
  at: string;
  line: string;
}

export interface McpConfigPaths {
  user?: string;
  project?: string;
}

// 读取本地服务的 MCP 状态（/api/agent/mcp/status）：已登记的 server、工具、日志。可轮询。
export function useMcpStatus() {
  const servers = ref<McpServerStatus[]>([]);
  const logs = ref<McpLogLine[]>([]);
  const config = ref<McpConfigPaths>({});
  const loading = ref(false);
  const error = ref('');
  let timer: number | null = null;

  async function refresh() {
    loading.value = true;
    error.value = '';
    try {
      const data = await sourceServerJson('/api/agent/mcp/status', { timeoutMs: 5000 });
      servers.value = Array.isArray(data.servers) ? data.servers : [];
      logs.value = Array.isArray(data.logs) ? data.logs : [];
      config.value = data.config && typeof data.config === 'object' ? data.config : {};
    } catch (err: any) {
      error.value = err?.message || String(err);
    } finally {
      loading.value = false;
    }
  }

  async function reload() {
    loading.value = true;
    error.value = '';
    try {
      const data = await sourceServerJson('/api/agent/mcp/reload', {
        method: 'POST',
        body: {},
        timeoutMs: 35000
      });
      servers.value = Array.isArray(data.servers) ? data.servers : [];
      logs.value = Array.isArray(data.logs) ? data.logs : [];
    } catch (err: any) {
      error.value = err?.message || String(err);
    } finally {
      loading.value = false;
    }
  }

  async function stop(name: string) {
    loading.value = true;
    error.value = '';
    try {
      const data = await sourceServerJson('/api/agent/mcp/stop', {
        method: 'POST',
        body: { name },
        timeoutMs: 8000
      });
      servers.value = Array.isArray(data.servers) ? data.servers : [];
      logs.value = Array.isArray(data.logs) ? data.logs : [];
    } catch (err: any) {
      error.value = err?.message || String(err);
    } finally {
      loading.value = false;
    }
  }

  function startPolling(intervalMs = 2000) {
    stopPolling();
    void refresh();
    timer = window.setInterval(refresh, intervalMs);
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  onScopeDispose(stopPolling);

  return { servers, logs, config, loading, error, refresh, reload, stop, startPolling, stopPolling };
}
