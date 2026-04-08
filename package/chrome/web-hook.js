// 增强版Web Request拦截器 - 支持修改请求参数
!function () {
    function webApi() {
        console.log("🚀 开始拦截 fetch 和 XHR 请求 (增强版) .....");

        // 回调队列
        const responseQueue = [];
        const requestModifyQueue = [];

        // 请求规则配置
        const interceptRules = [

        ];

        // 工具函数：修改嵌套对象属性
        function setNestedProperty(obj, path, value) {
            const keys = path.split('.');
            let current = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            current[keys[keys.length - 1]] = value;
        }

        // 修改请求体
        function modifyRequestBody(bodyText, rule) {
            try {
                let bodyData = JSON.parse(bodyText);
                // 支持函数形式的修改器
                if (typeof rule.modifier === 'function') {
                    bodyData = rule.modifier(bodyData);
                } else if (rule.modifications) {
                    // 原有的配置形式
                    rule.modifications.forEach(mod => {
                        if (mod.action === 'update' || mod.action === 'add') {
                            setNestedProperty(bodyData, mod.path, mod.value);
                        } else if (mod.action === 'delete') {
                            // TODO: 实现删除逻辑
                        }
                    });
                }

                const modified = JSON.stringify(bodyData);
                return modified;
            } catch (error) {
                console.error('❌ Body modification failed:', error);
                return bodyText;
            }
        }

        // 查找匹配的规则
        function findMatchingRule(url) {
            return interceptRules.find(rule =>
                url.includes(rule.urlPattern) ||
                (rule.urlPattern.startsWith('/') && new RegExp(rule.urlPattern).test(url))
            );
        }

        // ===== 拦截 Fetch =====
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const [input, options = {}] = args;
            const url = typeof input === 'string' ? input : input.url;
            const method = (options.method || 'GET').toUpperCase();
            let rule = null;
            // 修改请求参数
            let modifiedOptions = { ...options };

            if (['POST', 'PUT', 'PATCH'].includes(method) && options.body && url) {
                rule = findMatchingRule(url);

                if (rule) {
                    modifiedOptions.body = modifyRequestBody(options.body, rule);

                    // 通知请求修改回调
                    requestModifyQueue.forEach(callback => {
                        callback({
                            url,
                            method,
                            originalBody: options.body,
                            modifiedBody: modifiedOptions.body,
                            type: 'fetch'
                        });
                    });
                }
            }

            // 发送修改后的请求
            let response = await originalFetch(input, modifiedOptions);
            let clonedResponse = response.clone();

            // 处理响应
            clonedResponse.text().then((body) => {
                responseQueue.forEach((callback) => {
                    let headersBody = {};
                    try {
                        headersBody = typeof modifiedOptions.body === 'string' ?
                            JSON.parse(modifiedOptions.body || "{}") : {}
                    } catch (error) {
                        // Ignore parse errors
                    }
                    let result = {};
                    try {
                        result = typeof body === 'string' ?
                            JSON.parse(body || "{}") : {}
                    } catch (error) {
                        // Ignore parse errors
                    }
                    callback({
                        url,
                        result,
                        request: {
                            headers: {},
                            body: headersBody
                        },

                        method,
                        modified: !!rule
                    });
                });
            });

            return response;
        };

        // ===== 拦截 XMLHttpRequest =====
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

        XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
            this._requestUrl = url;
            this._requestMethod = method.toUpperCase();
            this._headers = {};
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
            this._headers = this._headers || {};
            this._headers[header] = value;
            return originalSetRequestHeader.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (body) {
            let modifiedBody = body;
            let rule = null;

            // 修改请求参数
            if (['POST', 'PUT', 'PATCH'].includes(this._requestMethod) && body && this._requestUrl) {

                rule = findMatchingRule(this._requestUrl);
                if (rule) {
                    const headers = this._headers || { 'Content-Type': 'application/json' };
                    const contentType = headers['Content-Type'] || headers['content-type'];

                    if (contentType && contentType.includes('application/json')) {
                        // JSON 请求体
                        modifiedBody = modifyRequestBody(body, rule);
                    } else if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
                        // Form 数据 (暂不处理，可以扩展)
                        console.log('⚠️ Form data modification not implemented yet');
                    }

                    // 通知请求修改回调
                    requestModifyQueue.forEach(callback => {
                        callback({
                            url: this._requestUrl,
                            method: this._requestMethod,
                            originalBody: body,
                            modifiedBody: modifiedBody,
                            type: 'xhr'
                        });
                    });
                }
            }

            // 监听 XHR 响应
            this.addEventListener("load", function () {
                const _this = this || {};
                let result = _this.response || {};
                try {
                    result = JSON.parse(_this.responseText || '{}');
                } catch (error) {

                }
                let headersBody = {};
                const headers = this._headers || { 'Content-type': 'application/json' };
                const ContentType = headers['Content-Type'] || headers['content-type'];

                if (ContentType && ContentType.includes('application/x-www-form-urlencoded')) {
                    const params = new URLSearchParams(modifiedBody);
                    for (const [key, value] of params.entries()) {
                        try {
                            headersBody[key] = JSON.parse(value);
                        } catch {
                            headersBody[key] = value;
                        }
                    }
                } else if (modifiedBody && typeof modifiedBody === 'string') {
                    try {
                        headersBody = JSON.parse(modifiedBody);
                    } catch {
                        headersBody = {};
                    }
                }

                responseQueue.forEach((callback) => {
                    callback({
                        url: _this._requestUrl,
                        result: result,
                        request: {
                            headers: typeof headers === 'object' ? headers : {},
                            body: headersBody
                        },
                        method: this._requestMethod,
                        modified: !!rule
                    });
                });
            });

            return originalSend.call(this, modifiedBody);
        };
        const locationReadyMaps = {};
        const caches = [];

        console.log("✅ 增强版拦截器安装成功！");

        // 返回API对象
        return {
            caches,
            addCache(info) {
                caches.push(info);
            },
            ready() {
                locationReadyMaps[location.hostname] = true;
            },
            isReady() {
                return locationReadyMaps[location.hostname];
            },
            onResponse(callback = () => { }) {
                // caches.forEach(cache => {
                //     callback(cache.data ? cache.data : {});
                // });
                responseQueue.push(callback);
            },
            onRequestModify(callback = () => { }) {
                console.log('WEB_REQUEST_MODIFIED', callback);
                requestModifyQueue.push(callback);
            },
            addRule(rule) {
                interceptRules.push(rule);
            },
            removeRule(urlPattern) {
                const index = interceptRules.findIndex(rule => rule.urlPattern === urlPattern);
                if (index > -1) {
                    interceptRules.splice(index, 1);
                }
            },
            getRules() {
                return interceptRules;
            },
            updateRule(urlPattern, modifications) {
                const rule = interceptRules.find(rule => rule.urlPattern === urlPattern);
                if (rule) {
                    rule.modifications = modifications;
                } else {
                    interceptRules.push({ urlPattern, modifications });
                }
            }
        }
    }

    const api = webApi();

    // 监听响应
    api.onResponse(({ url, result, request, method, modified }) => {
        const info = {
            type: 'WEB_REQUEST_RESPONSE',
            data: { url, result, request, method, modified }
        }
        window.postMessage(info, "*");
        if (!api.isReady()) {
            api.addCache(info);
        }
    });

    // 监听请求修改
    api.onRequestModify(({ url, method, originalBody, modifiedBody, type }) => {
        window.postMessage({
            type: 'WEB_REQUEST_MODIFIED',
            data: { url, method, originalBody, modifiedBody, type }
        }, "*");
    });

    // 暴露全局API
    window.__WEB_REQUEST_API__ = api;
    window.__WEB_REQUEST_VERSION__ = '2.0';
    _exports.module['webHook'] = api;


    console.log('🎉 Enhanced Web Request Interceptor Ready!');
}();
