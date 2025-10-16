(function () {

    
    chrome.runtime.sendMessage({ cmd: "start" });
    // 监听chrome的事件然后转发出去 background/popup/option -> content-script -> web page
    chrome.runtime.onMessage.addListener((function (e, t, m) {
        window.postMessage(e, "*")
    }));
    chrome.runtime.id && localStorage.setItem("MdPluginId", chrome.runtime.id);
    chrome.runtime.id && localStorage.setItem("MdPluginName", chrome.runtime.getManifest().name);


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
        async do({ params, call }) {
            const func = getPropertyCall(chrome, call);
            
            return await func(...params);
        }
    }
    window.addEventListener("message", async (e) => {
        const cmd = e.data.cmd;
        const sender = e.data.sender || { name: 'web-page' };
        if(sender.name != 'web-page') return;
        let result = null;
        if (cmd == 'chrome') { 
            result = await _chrome.do(e.data);
        }
        window.postMessage({ result, sender: { id: sender.id, name: 'content-script' }  })
    })

})();
