import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://testad.itaored.com',
        changeOrigin: true
        // 不使用 rewrite，保留 /api 前缀
      }
    }
  }
})
