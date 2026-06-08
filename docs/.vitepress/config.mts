import { defineConfig } from 'vitepress'

const docsEnv = process.env.DOCS_ENV || 'prod'
const isDevBuild = docsEnv === 'dev'

export default defineConfig({
  title: 'Chrome Extension Scaffold',
  description: 'A scaffold for script injection and extension bridge communication.',
  lang: 'zh-CN',
  cleanUrls: true,
  outDir: isDevBuild ? '.vitepress/dist-dev' : '.vitepress/dist',
  vite: {
    define: {
      __DOCS_ENV__: JSON.stringify(docsEnv)
    }
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/web' },
      { text: 'Examples', link: '/examples/' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: '开始', link: '/guide/' },
            { text: '快速上手', link: '/guide/quick-start' },
            { text: '架构', link: '/guide/architecture' },
            { text: '动态配置', link: '/guide/config' }
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
      message: `Released under the MIT License. Build env: ${docsEnv}.`,
      copyright: 'Copyright © 2026'
    }
  }
})
