import { createApp } from 'vue';
import App from './App.vue';
import { createGoCaptureBootstrap } from './app/runtime/bootstrap';
import styles from './styles/index.scss?inline';

(function bootstrapGoCaptureSidePanel() {
  const APP_KEY = '__GOCAPTURE_DEV_ASSISTANT__';
  const ROOT_ID = 'gocapture-side-panel-root';
  const sidePanelConfig = window.__GOCAPTURE_SIDE_PANEL__ || {};
  const oldApp = window[APP_KEY];

  if (oldApp && typeof oldApp.destroy === 'function') {
    oldApp.destroy();
  }

  const bootstrap = createGoCaptureBootstrap();
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  const mountEl = document.createElement('div');
  mountEl.id = ROOT_ID;
  document.body.appendChild(mountEl);

  const api = {
    host: mountEl,
    app: null,
    sidePanel: true,
    sidePanelConfig,
    bootstrap,
    start() {},
    stop() {},
    toggle() {},
    clear() {},
    getSelected() {
      return null;
    },
    destroy() {
      if (api.app) {
        api.app.unmount();
        api.app = null;
      }
      if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      if (mountEl.parentNode) mountEl.parentNode.removeChild(mountEl);
      if (window[APP_KEY] === api) {
        window[APP_KEY] = null;
      }
    }
  };

  const app = createApp(App, { api });
  app.use(bootstrap.pinia);
  api.app = app;
  window[APP_KEY] = api;
  app.mount(mountEl);
})();
