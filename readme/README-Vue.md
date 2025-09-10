我需要开发一个的是一个chrome插件开发脚手架，基于这个背景，我需要实现以下几点。

1. chrome.runtime.getURL只能在content-script和background.js调用，无法在被chrome.scripting.executeScript注入的脚本使用， 所以放弃现在的mdChrome.web.injectScript 实现方式 即src/chrome/web.js 改用 js/service-worker.js的 injectCmd 注入文件/代码 原来的调用方式更新 需要你实现一个能直接在被动态注入的代码里调用的函数injectScript。  
2. 开创cp_moduless 类似于 node_modules 通过1提到新加载方式加载
