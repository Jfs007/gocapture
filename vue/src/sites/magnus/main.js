import { createApp } from 'vue';
import App from './App.vue';
import styles from './styles/style.css?inline';

(function bootstrapDevAssistant() {
    const APP_KEY = '__MAGNUS_DEV_ASSISTANT__';
    const LEGACY_APP_KEY = '__MAGNUS_ELEMENT_INSPECTOR__';
    const sidePanelConfig = window.__MAGNUS_SIDE_PANEL__ || null;
    const isSidePanel = !!sidePanelConfig;
    const HOST_ID = 'magnus-dev-assistant-root';
    const oldApp = window[APP_KEY];
    const legacyApp = window[LEGACY_APP_KEY];

    if (oldApp && typeof oldApp.destroy === 'function') {
        oldApp.destroy();
    }
    if (legacyApp && legacyApp !== oldApp && typeof legacyApp.destroy === 'function') {
        legacyApp.destroy();
        window[LEGACY_APP_KEY] = null;
    }

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = isSidePanel
        ? [
            'position:fixed',
            'inset:0',
            'z-index:1',
            'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif'
        ].join(';')
        : [
            'position:fixed',
            'inset:0',
            'z-index:2147483647',
            'pointer-events:none',
            'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif'
        ].join(';');

    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    const mountEl = document.createElement('div');

    shadowRoot.appendChild(styleEl);
    shadowRoot.appendChild(mountEl);
    (document.documentElement || document.body).appendChild(host);

    const api = {
        host,
        shadowRoot,
        app: null,
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
            if (host.parentNode) host.parentNode.removeChild(host);
            if (window[APP_KEY] === api) {
                window[APP_KEY] = null;
            }
        }
    };

    api.sidePanel = isSidePanel;
    api.sidePanelConfig = sidePanelConfig;

    const app = createApp(App, { api });
    api.app = app;
    window[APP_KEY] = api;
    app.mount(mountEl);
})();
