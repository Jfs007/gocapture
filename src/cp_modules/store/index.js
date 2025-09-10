


!function () {
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

            const res = await chrome.storage.local.get([moduleName]);
            const saved = res[moduleName] || {};
            const defaults = mod.state;

            // 合并本地数据和默认数据（保留已保存的，补齐缺的）
            const mergedState = Object.assign(defaults, saved);
            // 修复缺失字段
            if (JSON.stringify(saved) !== JSON.stringify(mergedState)) {
                await chrome.storage.local.set({ [moduleName]: mergedState });
            }

            return key ? mergedState[key] : mergedState;
        },
        async init() {
            const keys = Object.keys(_modules);
            if (keys.length === 0) return;

            const localData = await chrome.storage.local.get(keys);

            const toInit = {};
            for (const name of keys) {
                if (localData[name] === undefined) {
                    toInit[name] = { ..._modules[name].state };
                }
            }

            if (Object.keys(toInit).length > 0) {
                await chrome.storage.local.set(toInit);
                
            }
        },
        

        async commit(path, payload) {
            const [moduleName, mutationName] = path.split('/');
            const mod = _modules[moduleName];
            if (!mod) throw new Error(`Module "${moduleName}" not registered`);
            const mutation = mod.mutations[mutationName];
            if (!mutation) throw new Error(`Mutation "${mutationName}" not found in "${moduleName}"`);

            const res = await chrome.storage.local.get([moduleName]);
            const state = res[moduleName] || { ...mod.state };
            mutation(state, payload);
            await chrome.storage.local.set({ [moduleName]: state });
            return state;
        }
    };
    _exports.module['store'] = store;

}();





