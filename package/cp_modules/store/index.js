
!function () {
    _exports.module['md.storage'] = {
        local: {
            get(keys) {
                if(chrome && chrome.storage && chrome.storage.local) {
                    return chrome.storage.local.get(keys);
                }
                return new Promise((resolve) => {
                    const id = Date.now() + Math.random() + ':md.local.get';
                    function handler(e) {
                        const msg = e.data;
                        const sender = msg.sender || { };
                        if (sender.id === id && sender.name == 'content-script') {
                            window.removeEventListener("message", handler);
                            resolve(msg.result);
                        }
                    }
                    window.addEventListener("message", handler);
                    window.postMessage({
                        params: [keys],
                        cmd: "chrome",
                        sender: { id, name: 'web-page' },
                        call: 'storage.local.get'
                    }, "*");
                });
            },

            set(items) {
                if(chrome && chrome.storage && chrome.storage.local) {
                    return chrome.storage.local.set(items);
                }
                return new Promise((resolve) => {
                    const id = Date.now() + Math.random() + ':md.local.set';
                    function handler(e) {
                        const msg = e.data;
                        const sender = msg.sender || { };
                        if (sender.id === id && sender.name == 'content-script') {
                            window.removeEventListener("message", handler);
                            resolve(msg.result);
                        }
                    }
                    window.addEventListener("message", handler);
                    window.postMessage({
                        sender: { id, name: 'web-page' },
                        params: [items],
                        cmd: "chrome",
                        call: 'storage.local.set'
                    }, "*");
                });
            }
        }
    };


}()

!function () {
    const storage = _require('md.storage');
    const _modules = {};
    const store = {
        registerModule(name, definition) {
            if (!definition.state) throw new Error(`${name} module must have state`);
            if (!definition.mutations) throw new Error(`${name} module must have mutations`);
            _modules[name] = definition;
        },

        async get(path) {
            const [moduleName, key] = path.split('/');
            const mod = _modules[moduleName];
            if (!mod) throw new Error(`Module "${moduleName}" not registered`);

            const res = await storage.local.get([moduleName]);
            const saved = res[moduleName] || {};
            const defaults = mod.state;

            // 合并本地数据和默认数据（保留已保存的，补齐缺的）
            const mergedState = Object.assign(defaults, saved);
            // 修复缺失字段
            if (JSON.stringify(saved) !== JSON.stringify(mergedState)) {
                await storage.local.set({ [moduleName]: mergedState });
            }

            return key ? mergedState[key] : mergedState;
        },
        async init() {
            const keys = Object.keys(_modules);
            if (keys.length === 0) return;

            const localData = await storage.local.get(keys);

            const toInit = {};
            for (const name of keys) {
                if (localData[name] === undefined) {
                    toInit[name] = { ..._modules[name].state };
                }
            }

            if (Object.keys(toInit).length > 0) {
                await storage.local.set(toInit);

            }
        },


        async commit(path, payload) {
            const [moduleName, mutationName] = path.split('/');
            const mod = _modules[moduleName];
            if (!mod) throw new Error(`Module "${moduleName}" not registered`);
            const mutation = mod.mutations[mutationName];
            if (!mutation) throw new Error(`Mutation "${mutationName}" not found in "${moduleName}"`);

            const res = await storage.local.get([moduleName]);
            const state = res[moduleName] || { ...mod.state };
            mutation(state, payload);
            await storage.local.set({ [moduleName]: state });
            return state;
        }
    };
    _exports.module['chromeRedux'] = store;

}();





