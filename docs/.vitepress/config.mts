import { defineConfig } from 'vitepress'

const docsEnv = process.env.DOCS_ENV || 'prod'
const isDevBuild = docsEnv === 'dev'
const docsBase = process.env.GOCAPTURE_DOCS_BASE || (isDevBuild ? '/' : '/gocapture/')

export default defineConfig({
  title: 'GoCapture',
  description: '从浏览器选区直接连接本地源码与开发 Agent。',
  lang: 'zh-CN',
  base: docsBase,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: `${docsBase}logo.png` }]
  ],
  cleanUrls: true,
  outDir: isDevBuild ? '.vitepress/dist-dev' : '.vitepress/dist',
  vite: {
    define: {
      __DOCS_ENV__: JSON.stringify(docsEnv)
    }
  },
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: '快速开始', link: '/guide/quick-start' },
      { text: '使用指南', link: '/guide/' },
      { text: 'Gitee', link: 'https://gitee.com/senruo/magnus' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '使用 GoCapture',
          items: [
            { text: '产品概览', link: '/guide/' },
            { text: '快速上手', link: '/guide/quick-start' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API',
          items: [
            { text: 'mdChrome.web', link: '/api/web' },
            { text: 'Service Worker Commands', link: '/api/service-worker' }
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: '调用示例', link: '/examples/' }
          ]
        }
      ]
    },
    search: {
      provider: 'local'
    },
    footer: {
      message: 'GoCapture 使用 MIT License 发布。',
      copyright: 'Copyright © 2026 GoCapture'
    }
  }
})
