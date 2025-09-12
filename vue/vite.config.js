import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { getCurrentEntry } = require('./build/util.js'); // 引入 CJS util
const entry = getCurrentEntry();
console.log(entry, 'entry');
export default defineConfig({
  plugins: [vue()],

  build: {
    rollupOptions: {
      input: getCurrentEntry(), // 绝对路径对象
      output: {
        format: 'iife',
        entryFileNames: (chunkInfo) => {
          // // 热更新模式下的特殊路径处理
          // if (process.env.HOT_RELOAD_MODE === 'app') {
          //   if (chunkInfo.name === 'shared-lib') {
          //     return 'shared/md-ui-component.js';
          //   } else if (chunkInfo.name === 'compass') {
          //     return 'sites/compass.jinritemai.com.js';
          //   }
          // }
          return '[name]/index.js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        globals: { mdChrome: '_require("mdChrome")' }
      },
      external: ['mdChrome']
    },
    // 根据模式决定输出目录
    outDir: '../package/app',
    emptyOutDir: false,
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    target: 'chrome89',
    sourcemap: false,
    cssMinify: process.env.NODE_ENV === 'production',
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 0
  },

  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },

  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false
  },

  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  }
});
