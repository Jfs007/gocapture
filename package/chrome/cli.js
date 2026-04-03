(function () {
   window._exports = window._exports || {};
   window._exports.module = Object.assign({}, window._exports.module || {});
   window._require = (name) => { return window._exports.module[name]; }
   window._exports.module['mdChrome'] = {};



}());

(function () {
   if (window.top == window.self) return;
   chrome.runtime = {
      sendMessage(_, params, callback) {
         const id = Date.now() + Math.random() + ':chrome.runtime.sendMessage';
         function handler(e) {
            const msg = e.data;
            const sender = msg.sender || {};
            if (sender.id === id && sender.name == 'content-script') {
               window.removeEventListener("message", handler);
               callback(msg.result)
            }
         }
         window.addEventListener("message", handler);
         
         window.postMessage({
            params: [params],
            cmd: "chrome",
            callback: 1,
            sender: { id, name: 'iframe' },
            call: 'runtime.sendMessage'
         }, "*");
      }
   }
})()