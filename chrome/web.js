
(function(){
    const mdChrome = _require('mdChrome');
    function injectScript(scriptPath){
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(scriptPath);
        script.onload = function(){ this.remove(); };
        script.onerror = function(e){ console.error("❌ 插入失败", e); };
        document.documentElement.appendChild(script);
    }
    mdChrome.web = {
        injectScript
    }



    
})();