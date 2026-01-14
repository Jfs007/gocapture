(function () {
    // 监听chrome的事件然后转发出去 background/popup/option -> content-script -> web page
    chrome.runtime.onMessage.addListener((function (e, t, m) {
        // window.postMessage(e, "*")
    }));
    const manifest = chrome.runtime.getManifest();
    chrome.runtime.id && localStorage.setItem("MdPluginId", chrome.runtime.id);
    chrome.runtime.id && localStorage.setItem("MdPluginName", manifest.name);
    const { env, site } = manifest.devlopment_env || {};
    chrome.runtime.sendMessage({ cmd: "start" }, () => {
        window.postMessage({ cmd: "install-setup", url: site }, site);
    });

})();

(function () {

    function getPropertyCall(obj, path) {
        const parts = Array.isArray(path) ? path : String(path).split(".");
        let ctx = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            ctx = ctx[parts[i]];
            if (typeof ctx !== "object" || ctx === null) return;
        }
        const fnName = parts[parts.length - 1];

        const fn = ctx[fnName];
        if (typeof fn === "function") {
            // 绑定上下文，保证 this 正确
            return fn.bind(ctx);
        }

        return fn; // 如果是属性值，不是函数，就直接返回
    }
    const _chrome = {

    }
    window.addEventListener("message", async (e) => {
        const cmd = e.data.cmd;
        const sender = e.data.sender || { name: 'web-page' };
        if (!(sender.name == 'web-page' || sender.name == 'iframe')) return;
        if (cmd != 'chrome') return;
        const params = e.data.params || [];
        const call = e.data.call;
        const callback = e.data.callback;
        const func = getPropertyCall(chrome, call);
        if (callback == 1) {
            func(params[0], (result) => {
                window.postMessage({ result, sender: { id: sender.id, name: 'content-script' } })
            })
            return;
        }
        let result = await func(params[0]);
        window.postMessage({ result, sender: { id: sender.id, name: 'content-script' } })
    })


})();

