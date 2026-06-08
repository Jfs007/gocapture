---
layout: home

hero:
  name: Chrome Extension Scaffold
  text: Web bridge and script injection toolkit
  tagline: 用 Chrome MV3 扩展把前端页面、注入脚本和 service worker 连接起来。
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
  - title: 无业务脚手架
    details: 当前 package/app 配置已清空，只保留扩展基础能力和中性示例，适合作为新项目工程化模板。
---
