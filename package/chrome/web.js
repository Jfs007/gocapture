(function(){
    const mdChrome = _require('mdChrome');
    
    // 模块加载缓存
    const filesCache = {};
    
    /**
     * 注入脚本文件
     * @param {string|Array} scriptPath - 脚本路径或路径数组
     */
    async function injectScript(scriptPath) {
        let paths = Array.isArray(scriptPath) ? scriptPath : [scriptPath];
        paths = paths.filter(path => { return !filesCache[path] });
        const mdPluginId = localStorage.getItem('MdPluginId');
        for (const path of paths) {
            try {
                filesCache[path] = path;
                console.log(`💉 注入脚本: ${path}`);
                await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(mdPluginId, {
                        cmd: 'inject',
                        type: 2,
                        fileNames: [path]
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            delete filesCache[path];
                            resolve(response);
                        }
                    });
                });
                
                console.log(`✅ 脚本注入成功: ${path}`);
            } catch (error) {
                console.error(`❌ 脚本注入失败: ${path}`, error);
                 delete filesCache[path];
                throw error;
            }
        }
    }
    
    
   
    
   
   

   
    
    // 导出API
    mdChrome.web = {
        injectScript,
       
    };
})();