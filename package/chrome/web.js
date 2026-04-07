(function () {
    const mdChrome = _require('mdChrome');

    // 模块加载缓存
    const filesCache = {};

    const maxRetry = 1;
    const scriptQueue = {};

    function getQueue(path) {
        if (!scriptQueue[path]) {
            scriptQueue[path] = {
                success: [],
                error: [],
                pending: false,
                retryCount: 0,
            };
        }
        return scriptQueue[path];
    }

    function clearQueue(path) {
        const q = scriptQueue[path];
        if (!q) return;
        q.success = [];
        q.error = [];
        q.pending = false;
        q.retryCount = 0;
    }

    function resolveAll(path, result) {
        const q = scriptQueue[path];
        if (!q || !q.success.length) return;
        q.success.forEach(fn => fn(result));
        clearQueue(path);
    }

    function rejectAll(path, err) {
        const q = scriptQueue[path];
        if (!q || !q.error.length) return;
        q.error.forEach(fn => fn(err));
        clearQueue(path);
    }

    /**
     * 注入脚本文件
     * @param {string|Array} scriptPath - 脚本路径或路径数组
     */
    async function injectScript(scriptPath) {
        return injectScript2(scriptPath);
    }

    function invalidateScriptCache(scriptPath) {
        const paths = Array.isArray(scriptPath) ? scriptPath : [scriptPath];
        paths.filter(Boolean).forEach((p) => {
            delete filesCache[p];
        });
    }

    async function loadScript(path) {
        const q = getQueue(path);
        const mdPluginId = localStorage.getItem('MdPluginId');
        try {
            console.log(`💉 注入脚本: ${path}`);
            const res = await new Promise((resolve, reject) => {

                chrome.runtime.sendMessage(mdPluginId, {
                    cmd: 'inject',
                    type: 2,
                    fileNames: [path]
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    resolve(response);
                });
            });
            filesCache[path] = true;
            q.pending = false;
            q.retryCount = 0;
            console.log(`✅ 脚本注入成功: ${path}`);
            resolveAll(path, res);
        } catch (err) {
            q.pending = false;
            q.retryCount++;
            if (q.retryCount < maxRetry) {
                await loadScript(path);
                return;
            }
            console.error(`❌ 脚本注入失败: ${path}`, err);
            rejectAll(path, err);
        }
    }

    function enqueue(path, options) {
        return new Promise((resolve, reject) => {
            if (!path) {
                resolve();
                return;
            }
            const force = !!(options && options.force);
            if (force) {
                // 如果当前没有在注入中，则允许强制重新注入
                const q0 = getQueue(path);
                if (!q0.pending) {
                    delete filesCache[path];
                }
            }
            if (filesCache[path] === true) {
                resolve();
                return;
            }
            const q = getQueue(path);
            q.success.push(resolve);
            q.error.push(reject);
            if (q.pending) return;
            q.pending = true;
            loadScript(path);
        });
    }

    async function injectScript2(scriptPath, options) {
        const paths = Array.isArray(scriptPath) ? scriptPath : [scriptPath];
        const unique = Array.from(new Set(paths.filter(Boolean)));
        await Promise.all(unique.map(p => enqueue(p, options)));
    }

    async function cmd(params) {
        const mdPluginId = localStorage.getItem('MdPluginId');
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(mdPluginId, params, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }

            });
        })
    }


    // page-bus.ts
    function _on(evtName, callback) {
        const id = Date.now() + Math.random() + ':chrome.runtime.sendMessage.bus';
        return new Promise((resolve) => {
            const handler = (e) => {
                const msg = e.data;
                const sender = msg.sender || {};
                if (sender.id === id && sender.name == 'content-script') {
                    window.removeEventListener("message", handler);
                    callback(msg.result)
                }
            }
            window.addEventListener('message', handler)
            window.postMessage({
                params: [{
                    cmd: 'event-wait',
                    name: evtName,
                }],
                cmd: "chrome",
                callback: 1,
                sender: { id, name: 'web-page' },
                call: 'runtime.sendMessage'
            }, "*");
        })
    }

    function _once(evtName, callback) {
        const id = Date.now() + Math.random() + ':chrome.runtime.sendMessage.bus.once';
        return new Promise((resolve) => {
            const handler = (e) => {
                const msg = e.data;
                const sender = msg.sender || {};
                if (sender.id === id && sender.name == 'content-script') {
                    window.removeEventListener("message", handler);
                    callback(msg.result)
                    resolve(msg.result)
                }
            }
            window.addEventListener('message', handler)
            window.postMessage({
                params: [{
                    cmd: 'event-once',
                    name: evtName,
                }],
                cmd: "chrome",
                callback: 1,
                sender: { id, name: 'web-page' },
                call: 'runtime.sendMessage'
            }, "*");
        })
    }

    function _off(evtName, callback) {
        window.postMessage({
            params: [{
                cmd: 'event-off',
                name: evtName,
                callback: callback
            }],
            cmd: "chrome",
            callback: 1,
            sender: { name: 'web-page' },
            call: 'runtime.sendMessage'
        }, '*')
    }

    function _send(evtName, payload) {
        window.postMessage({
            params: [{
                cmd: 'event-emit',
                name: evtName,
                payload: payload
            }],
            cmd: "chrome",
            callback: 1,
            sender: { name: 'web-page' },
            call: 'runtime.sendMessage'
        }, '*')
    };

    function _activeTab(tabId) {
        return cmd({
            cmd: 'activeTab',
            tabId: tabId
        });
    }

    // 导出API
    mdChrome.web = {
        name: 'ldd-pro',
        on: _on,
        once: _once,
        off: _off,
        send: _send,
        activeTab: _activeTab,
        cmd,
        injectScript,
        injectScript2,
        invalidateScriptCache,
    };
})();