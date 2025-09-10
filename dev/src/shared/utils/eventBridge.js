// 事件桥接器，用于处理 web-hook.js 的消息通信

import { reactive } from 'vue'

export class EventBridge {
  constructor() {
    this.listeners = new Map()
    this.videoInfos = reactive({})
    this.setupWebRequestListener()
  }

  setupWebRequestListener() {
    // API拦截配置 - 复用现有逻辑
    const api_hook = {
      'shop/product/product_rank/video_bring_good': (res) => {
        const list = res?.result?.data?.data_result || [];
        list.map(item => {
          const goodsId = item.product_info.id;
          this.videoInfos[goodsId] = item.video_list || [];
          // 存储商品信息
          if (!window.__PRODUCT_INFO__) {
            window.__PRODUCT_INFO__ = {};
          }
          window.__PRODUCT_INFO__[goodsId] = item.product_info;
        });
        
        console.log('📊 视频数据更新:', this.videoInfos);
        this.emit('videoDataUpdate', this.videoInfos);
      },
    };

    // 监听web-hook响应 - 完全复用现有逻辑
    window.addEventListener('message', (event) => {
      const { type, data } = event.data;
      if (type === 'WEB_REQUEST_RESPONSE') {
        const url = data ? data.url : '';
        const matchUrl = Object.keys(api_hook).find(pattern => {
          return url.indexOf(pattern) > -1;
        });
        if (matchUrl) {
          const hook = api_hook[matchUrl];
          if (hook) {
            hook(data);
          }
        }
      }
    });
  }

  // 事件发射器
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }

  // 移除监听器
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
}

// 全局单例
export const eventBridge = new EventBridge()