
(function(){
    const mdChrome = _require('mdChrome');
    
    // 预加载的模块代码缓存
    const moduleCache = {};
    
    /**
     * 通过service-worker获取文件内容并注入
     * @param {string} scriptPath - 脚本路径
     */
    async function fetchAndInjectScript(scriptPath) {
        try {
            // 通过service-worker的executeScript获取文件内容
            const response = await new Promise((resolve, reject) => {
                // 发送消息到service worker请求文件内容
                window.postMessage({
                    type: 'FETCH_SCRIPT_CONTENT',
                    scriptPath: scriptPath
                }, '*');
                
                // 监听响应
                const handleMessage = (event) => {
                    if (event.data.type === 'SCRIPT_CONTENT_RESPONSE' && event.data.scriptPath === scriptPath) {
                        window.removeEventListener('message', handleMessage);
                        if (event.data.success) {
                            resolve(event.data.content);
                        } else {
                            reject(new Error(event.data.error));
                        }
                    }
                };
                
                window.addEventListener('message', handleMessage);
                
                // 设置超时
                setTimeout(() => {
                    window.removeEventListener('message', handleMessage);
                    reject(new Error(`脚本获取超时: ${scriptPath}`));
                }, 10000);
            });
            
            // 直接执行代码
            console.log(`💉 执行脚本: ${scriptPath}`);
            eval(response);
            console.log(`✅ 脚本执行成功: ${scriptPath}`);
            
        } catch (error) {
            console.error(`❌ 脚本执行失败: ${scriptPath}`, error);
            throw error;
        }
    }
    
    /**
     * 新的injectScript实现 - 通过内容获取
     * @param {string|Array} scriptPath - 脚本路径或路径数组
     */
    function injectScript(scriptPath) {
        const paths = Array.isArray(scriptPath) ? scriptPath : [scriptPath];
        return Promise.all(paths.map(path => fetchAndInjectScript(path)));
    }
    
    /**
     * 注入代码字符串
     * @param {string} code - 要注入的代码
     */
    function injectCode(code) {
        return new Promise((resolve, reject) => {
            try {
                console.log('💉 执行动态代码');
                eval(code);
                resolve();
            } catch (error) {
                console.error('❌ 代码执行失败:', error);
                reject(error);
            }
        });
    }
    
    /**
     * 从cp_modules加载模块 - 内联方式
     * @param {string} moduleName - 模块名称
     */
    function requireModule(moduleName) {
        // 如果已经加载过，直接返回
        if (moduleCache[moduleName]) {
            return Promise.resolve();
        }
        
        // 内联的模块代码 - 在构建时生成
        const moduleCode = getInlineModuleCode(moduleName);
        
        if (moduleCode) {
            try {
                eval(moduleCode);
                moduleCache[moduleName] = true;
                console.log(`✅ cp_modules模块加载成功: ${moduleName}`);
                return Promise.resolve();
            } catch (error) {
                console.error(`❌ cp_modules模块加载失败: ${moduleName}`, error);
                return Promise.reject(error);
            }
        } else {
            // fallback到文件加载方式
            const modulePath = `cp_modules/${moduleName}/index.js`;
            return injectScript(modulePath);
        }
    }
    
    /**
     * 获取内联模块代码
     * @param {string} moduleName - 模块名称
     */
    function getInlineModuleCode(moduleName) {
        // 内联模块代码映射 - 自动生成，请勿手动修改
        const inlineModules = {
            'loadsh': '!function(){function simulateInput(selector,value){const input = typeof selector === \'string\' ? document.querySelector(selector): selector;if(!input)return;const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,\'value\').set;nativeInputValueSetter.call(input,value);input.dispatchEvent(new Event(\'input\',{bubbles: true}));input.dispatchEvent(new Event(\'change\',{bubbles: true}));}function base64ToFile(base64,fileName){const arr = base64.split(\',\');const mime = arr[0].match(/:(.*?);/)[1];const bstr = atob(arr[1]);let n = bstr.length;const u8arr = new Uint8Array(n);while(n--){u8arr[n] = bstr.charCodeAt(n);}return new File([u8arr],fileName,{type: mime});}function simulateUpload(uploader,opts = []){const dt = new DataTransfer();opts.map(opt =>{const{name,blob}= opt;const file = new File([blob],name,{type: blob.type});dt.items.add(file);});uploader.files = dt.files;uploader.dispatchEvent(new Event(\'change\',{bubbles: true}));}function imageToBlob(url){return new Promise((resolve,reject)=>{const img = new Image()img.crossOrigin = \'anonymous\' img.src = url img.onload =()=>{const canvas = document.createElement(\'canvas\')canvas.width = img.naturalWidth canvas.height = img.naturalHeight const ctx = canvas.getContext(\'2d\')ctx.drawImage(img,0,0)canvas.toBlob(blob =>{if(blob){resolve(blob)}else{reject(new Error(\'Canvas toBlob failed\'))}},\'image/jpeg\')}img.onerror =(error)=>{reject(new Error(\'Image load error\'))}})}function getProperty(obj,name){name = Array.isArray(name)? [...name] :(name + \'\').split(\".\");for(var i = 0;i < name.length - 1;i++){obj = obj[name[i]];if(typeof obj !== \"object\" || !obj)return;}return obj[name.pop()];}function showToast(options ={},callback =()=>{}){let{message,duration,position}= options;duration = duration || 1500;const existing = document.getElementById(\'lddui-top-tip-toast\');if(existing)existing.remove();const tip = document.createElement(\'div\');tip.id = \'lddui-top-tip-toast\';tip.innerText = message;Object.assign(tip.style,{position: \'fixed\',top: position ? position.top : \'20px\',left: \'50%\',transform: \'translateX(-50%)\',background: \'rgba(0,0,0,0.8)\',color: \'#fff\',padding: \'10px 20px\',borderRadius: \'6px\',fontSize: \'14px\',zIndex: 999999999,boxShadow: \'0 2px 8px rgba(0,0,0,0.2)\',transition: \'opacity 0.3s ease\',opacity: \'1\'});document.body.appendChild(tip);if(duration == -1)return;setTimeout(()=>{tip.style.opacity = \'0\';setTimeout(()=>{tip.remove();callback && callback()},300);},duration);}_exports.module[\'loadsh\'] ={showToast,getProperty,simulateInput,base64ToFile,simulateUpload,imageToBlob}}()',
            'store': '!function(){const _modules ={};const store ={registerModule(name,definition){if(!definition.state)throw new Error(`${name}module must have state`);if(!definition.mutations)throw new Error(`${name}module must have mutations`);_modules[name] = definition;},async get(path){const [moduleName,key] = path.split(\'/\');const mod = _modules[moduleName];if(!mod)throw new Error(`Module \"${moduleName}\" not registered`);const res = await chrome.storage.local.get([moduleName]);const saved = res[moduleName] ||{};const defaults = mod.state;const mergedState = Object.assign(defaults,saved);if(JSON.stringify(saved)!== JSON.stringify(mergedState)){await chrome.storage.local.set({[moduleName]: mergedState});}return key ? mergedState[key] : mergedState;},async init(){const keys = Object.keys(_modules);if(keys.length === 0)return;const localData = await chrome.storage.local.get(keys);const toInit ={};for(const name of keys){if(localData[name] === undefined){toInit[name] ={..._modules[name].state};}}if(Object.keys(toInit).length > 0){await chrome.storage.local.set(toInit);}},async commit(path,payload){const [moduleName,mutationName] = path.split(\'/\');const mod = _modules[moduleName];if(!mod)throw new Error(`Module \"${moduleName}\" not registered`);const mutation = mod.mutations[mutationName];if(!mutation)throw new Error(`Mutation \"${mutationName}\" not found in \"${moduleName}\"`);const res = await chrome.storage.local.get([moduleName]);const state = res[moduleName] ||{...mod.state};mutation(state,payload);await chrome.storage.local.set({[moduleName]: state});return state;}};_exports.module[\'store\'] = store;}();'
        };








        
        return inlineModules[moduleName] || null;
    }
    
    mdChrome.web = {
        injectScript,
        injectCode, 
        requireModule
    };
})();