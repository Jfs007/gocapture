import { createApp } from 'vue';
import App from './App.vue';
import { createMagnusBootstrap } from './app/bootstrap';
import styles from './styles/style.css?inline';

(function bootstrapMagnusSidePanel() {
  const APP_KEY = '__MAGNUS_DEV_ASSISTANT__';
  const ROOT_ID = 'magnus-side-panel-root';
  const sidePanelConfig = window.__MAGNUS_SIDE_PANEL__ || {};
  const oldApp = window[APP_KEY];

  if (oldApp && typeof oldApp.destroy === 'function') {
    oldApp.destroy();
  }

  const bootstrap = createMagnusBootstrap();
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
