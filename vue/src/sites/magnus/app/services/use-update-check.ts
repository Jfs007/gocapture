import { onMounted, ref } from 'vue';
import { sourceServerJson } from './source-service';

export interface UpdateInfo {
  name: string;
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  // 轮询 /api/version 直到服务报出「不同于当前」的版本 = 新版已重启就绪。
  async function waitForNewVersion(oldVersion: string, maxSeconds = 90): Promise<boolean> {
    for (let i = 0; i < maxSeconds; i += 1) {
      try {
        const data = await sourceServerJson('/api/version', { timeoutMs: 1500 });
        if (data && data.version && data.version !== oldVersion) return true;
      } catch {
        // 更新/重启期间探测失败属正常
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
    const ok = await waitForNewVersion(oldVersion);
    if (ok) {
      applyMessage.value = '更新完成，正在刷新…';
      location.reload();
    } else {
      applying.value = false;
      applyMessage.value = '';
      // 没等到新版本（可能未安装为常驻服务、需手动重启）——重新探测一次，让条幅按真实状态显示。
      void check();
    }
  }

  onMounted(() => { void check(); });

  return { info, applying, applyMessage, check, apply };
}
