(function(){
    const mdChrome = _require('mdChrome');
    
    // 模块加载缓存
    const moduleCache = {};
    
    /**
     * 注入脚本文件
     * @param {string|Array} scriptPath - 脚本路径或路径数组
     */
    async function injectScript(scriptPath) {
        const paths = Array.isArray(scriptPath) ? scriptPath : [scriptPath];
        
        for (const path of paths) {
            try {
                console.log(`💉 注入脚本: ${path}`);
                const mdPluginId = localStorage.getItem('MdPluginId');
                await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(mdPluginId, {
                        cmd: 'inject',
                        type: 2,
                        fileNames: [path]
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                console.log(`✅ 脚本注入成功: ${path}`);
            } catch (error) {
                console.error(`❌ 脚本注入失败: ${path}`, error);
                throw error;
            }
        }
    }
    
    /**
     * 注入代码字符串
     * @param {string} code - 要注入的代码
     */
    function injectCode(code) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                cmd: 'inject',
                params: {
                    type: 'eval',
                    value: code
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    /**
     * 从cp_modules加载模块
     * @param {string} moduleName - 模块名称
     */
    async function requireModule(moduleName) {
        // 如果已经加载过，直接返回
        if (moduleCache[moduleName]) {
            return;
        }
        
        try {
            console.log(`📦 加载模块: ${moduleName}`);
            
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    cmd: 'importModule',
                    moduleName: moduleName,
                    action: 'import'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response ? response.error : 'Unknown error'));
                    }
                });
            });
            
            // 标记为已加载
            moduleCache[moduleName] = true;
            console.log(`✅ 模块加载成功: ${moduleName}`);
            
        } catch (error) {
            console.error(`❌ 模块加载失败: ${moduleName}`, error);
            throw error;
        }
    }
    
    /**
     * 导入多个模块
     * @param {string[]} moduleNames - 模块名称数组
     */
    async function requireModules(moduleNames) {
        const results = await Promise.allSettled(
            moduleNames.map(name => requireModule(name))
        );
        
        const failed = results
            .map((result, index) => ({ result, name: moduleNames[index] }))
            .filter(({ result }) => result.status === 'rejected');
            
        if (failed.length > 0) {
            console.error('❌ 部分模块加载失败:', failed);
            throw new Error(`Failed to load modules: ${failed.map(f => f.name).join(', ')}`);
        }
        
        console.log(`✅ 批量加载完成: ${moduleNames.join(', ')}`);
    }
    
    /**
     * 获取已加载的模块列表
     */
    function getLoadedModules() {
        return Object.keys(moduleCache);
    }
    
    /**
     * 清理模块缓存
     * @param {string} [moduleName] - 可选的特定模块名
     */
    function clearModuleCache(moduleName) {
        if (moduleName) {
            delete moduleCache[moduleName];
            console.log(`🗑️ 清理模块缓存: ${moduleName}`);
        } else {
            Object.keys(moduleCache).forEach(key => delete moduleCache[key]);
            console.log('🗑️ 清理所有模块缓存');
        }
    }

   
    
    // 导出API
    mdChrome.web = {
        injectScript,
        injectCode, 
        requireModule,
        requireModules,
        getLoadedModules,
        clearModuleCache
    };
})();