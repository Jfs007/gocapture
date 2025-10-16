(function(){
    const scripts = ["assets/scripts/0.web-request.js","assets/scripts/jsonp.js","assets/scripts/route-watch.js"];
    function injectScript(scriptPath){
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(scriptPath);
        script.onload = function(){ this.remove(); };
        script.onerror = function(e){ console.error("❌ 插入失败", e); };
        document.documentElement.appendChild(script);
    }
    scripts.map(injectScript);
})();