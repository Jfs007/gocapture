import { createApp } from 'vue'
import App from './App.vue'
import './style/index.css'
let app: any = null;

window.addEventListener('message', (e) => {
    
    if (e.data.cmd == 'install-setup' && !app) {
        const env = e.data.env || {};
        window.__PLG__ENV__ = env;
        app = createApp(App)
        app.mount('#app')
    }
})


