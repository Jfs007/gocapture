import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  
  // 构建配置
  build: {
    rollupOptions: {
      input: {
        // 共享组件库 (会被其他入口引用)
        'md-ui-component': resolve(__dirname, 'src/sites/shared-lib/index.js'),
        // 各站点入口
        'compass.jinritemai.com': resolve(__dirname, 'src/sites/compass/index.js')
        // 可以继续添加其他站点: 'other-site.com': resolve(__dirname, 'src/sites/other/index.js')
      },
      output: {
        // inlineDynamicImports: false,
        // 不同类型文件使用不同命名
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'md-ui-component') {
            return '[name].js' // 共享库保持简单命名
          }
          return '[name].js' // 站点文件
        },
        chunkFileNames: 'chunks/[name]-[hash].js', // 代码分割的chunk文件
        format: 'iife', // Chrome扩展兼容格式
        // 外部化依赖，使用现有的_require系统
        globals: {
          'mdChrome': '_require("mdChrome")'
        },
        // 最小化输出
        compact: true
      },
      // 外部依赖不打包
      external: ['mdChrome']
    },
    // 直接输出到chrome-extension/js目录
    outDir: '../chrome-extension/js',
    emptyOutDir: false, // 不清空输出目录，保留其他文件
    
    // 优化配置 - 减少文件大小
    minify: 'esbuild', // 使用esbuild压缩，更快更小
    target: 'chrome89', // 针对Chrome优化
    
    // 关闭source map和其他调试工具
    sourcemap: false,
    
    // CSS优化
    cssMinify: true,
    
    // 启用代码分割以避免重复
    chunkSizeWarningLimit: 1000,
    
    // 优化依赖
    assetsInlineLimit: 0 // 不内联资源，保持文件独立
  },

  // 开发服务器配置
  server: {
    port: 3000,
    open: false
  },

  // 路径别名
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },

  // 环境变量
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // 移除Vue开发工具
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false
  },

  // 移除开发时的HMR代码
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  }
})