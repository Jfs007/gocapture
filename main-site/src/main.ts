import { createApp } from 'vue'
import App from './App.vue'
import './style/index.css'
let app: any = null;

const mountApp = (env: Record<string, any> = {}) => {
    if (app) return;
    window.__PLG__ENV__ = env;
    app = createApp(App)
    app.mount('#app');
    window.__HIDE_GLOBAL_LOADER__ && window.__HIDE_GLOBAL_LOADER__();
}

window.addEventListener('message', (e) => {
    if (e.data.cmd == 'install-setup' && !app) {
        mountApp(e.data.env || {});
    }
})

if (import.meta.env.DEV) {
    mountApp({ env: 'local-preview' });
}
