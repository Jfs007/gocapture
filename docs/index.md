---
layout: home

hero:
  name: GoCapture
  text: 从浏览器选区到本地开发 Agent
  tagline: 定位页面对应源码，并将明确的修改上下文交给 Coding Agent。
  actions:
    - theme: brand
      text: 开始阅读
      link: /guide/
    - theme: alt
      text: 查看 API
      link: /api/web

features:
  - title: 页面通信桥
    details: package/chrome/web.js 将 mdChrome.web 注入到页面主世界，前端代码可以通过 cmd、send、once 等方法调用扩展能力。
  - title: 动态脚本加载
    details: package/js/service-worker.js 根据 app/config.json 过滤站点、iframe、权限和版本，再把脚本注入到目标页面。
  - title: 本地源码与 Agent
    details: source-server 管理项目绑定、源码证据和 Agent 任务，让浏览器选区可以进入真实开发流程。
---
