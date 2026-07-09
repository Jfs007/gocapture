import { onMounted, ref } from 'vue';
import { sourceServerJson } from './source-service';

export interface UpdateInfo {
  name: string;
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}

interface UpdateStatus {
  status: 'idle' | 'running' | 'succeeded' | 'failed';
  error?: string;
  logs?: string[];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function reloadThroughSidePanelHost(timeoutMs = 4000): Promise<boolean> {
  if (typeof window === 'undefined' || window.parent === window) return Promise.resolve(false);
  const requestId = `update-reload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new Promise(resolve => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };
    const onMessage = (event: MessageEvent) => {
      const message = event.data || {};
      if (message.type !== 'magnus.sidepanel.reload.result' || message.requestId !== requestId) return;
      finish(!!message.ok);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    window.addEventListener('message', onMessage);
    window.parent.postMessage({
      type: 'magnus.sidepanel.reload',
      requestId,
      reason: 'update-complete'
    }, '*');
  });
}

async function reloadAfterUpdate() {
  const delegated = await reloadThroughSidePanelHost();
  if (delegated) return;
  window.location.reload();
}

// 检查本地服务是否有新版；「更新」= 触发服务端 npm 全局更新 + 自重启，然后等新版本起来再刷新页面拿新 UI。
export function useUpdateCheck() {
  const info = ref<UpdateInfo | null>(null);
  const applying = ref(false);
  const applyMessage = ref('');

  async function check() {
    try {
      const data = await sourceServerJson('/api/update/check', { timeoutMs: 6000 });
      info.value = data && data.updateAvailable ? (data as UpdateInfo) : null;
    } catch {
      info.value = null;
    }
  }

  async function readStatus(): Promise<UpdateStatus | null> {
    try {
      return await sourceServerJson('/api/update/status', { timeoutMs: 1500 }) as UpdateStatus;
    } catch {
      return null;
    }
  }

  // 轮询 /api/version 直到服务报出「不同于当前」的版本 = 新版已重启就绪；同时读取更新状态，失败时立即停止 loading。
  async function waitForNewVersion(oldVersion: string, maxSeconds = 90): Promise<boolean> {
    for (let i = 0; i < maxSeconds; i += 1) {
      try {
        const data = await sourceServerJson('/api/version', { timeoutMs: 1500 });
        if (data && data.version && data.version !== oldVersion) return true;
      } catch {
        // 更新/重启期间探测失败属正常
      }
      const status = await readStatus();
      if (status?.status === 'failed') {
        const lastLog = status.logs?.slice(-1)[0] || '';
        throw new Error(status.error || lastLog || '更新失败');
      }
      if (status?.status === 'running') {
        const lastLog = status.logs?.slice(-1)[0];
        applyMessage.value = lastLog ? `更新中：${lastLog}` : '更新中，服务将自动重启…';
      } else if (status?.status === 'succeeded') {
        applyMessage.value = '更新完成，等待服务重启…';
      }
      await sleep(1000);
    }
    return false;
  }

  async function apply() {
    if (applying.value || !info.value) return;
    const oldVersion = info.value.current;
    applying.value = true;
    applyMessage.value = '正在下载更新…';
    try {
      await sourceServerJson('/api/update/apply', { method: 'POST', body: {}, timeoutMs: 8000 });
    } catch {
      // apply 触发后服务可能中途重启导致本请求失败，属正常
    }
    applyMessage.value = '更新中，服务将自动重启…';
    try {
      const ok = await waitForNewVersion(oldVersion);
      if (ok) {
        applyMessage.value = '更新完成，正在刷新…';
        await reloadAfterUpdate();
      } else {
        applying.value = false;
        applyMessage.value = '未检测到服务自动重启，请运行 magnus restart 后重试。';
        void check();
      }
    } catch (error) {
      applying.value = false;
      applyMessage.value = `更新失败：${error instanceof Error ? error.message : String(error)}`;
      void check();
    }
  }

  onMounted(() => { void check(); });

  return { info, applying, applyMessage, check, apply };
}
