import { onMounted, onScopeDispose, ref } from 'vue';
import { pingSourceServer } from './source-service';
import { useAppUiStore } from '../../stores/app-ui.store';

// 探活本地服务：挂载即探一次，之后定时轮询；把在线/离线写进 app-ui store（serviceOnline）。
// 离线时轮询快一点（好让用户一启动服务就自动恢复），在线时慢一点省资源。
export function useServiceHealth() {
  const appUi = useAppUiStore();
  const probing = ref(false);
  let timer: number | null = null;

  async function probe(): Promise<boolean> {
    if (probing.value) return appUi.serviceOnline === true;
    probing.value = true;
    try {
      const online = await pingSourceServer();
      appUi.setServiceOnline(online);
      schedule(online ? 15000 : 4000);
      return online;
    } finally {
      probing.value = false;
    }
  }

  function schedule(delay: number) {
    stop();
    timer = window.setTimeout(probe, delay);
  }

  function stop() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  onMounted(() => { void probe(); });
  onScopeDispose(stop);

  return { probe };
}
