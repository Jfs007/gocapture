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

        console.log("✅ 增强版拦截器安装成功！");

        // 返回API对象
        return {
            onResponse(callback = () => { }) {
                responseQueue.push(callback);
            },
            onRequestModify(callback = () => { }) {
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
        window.postMessage({
            type: 'WEB_REQUEST_RESPONSE',
            data: { url, result, request, method, modified }
        }, "*");
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


    // chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    //     const cmd = message.cmd;
    //     const [_module, handleName] = cmd.split('.');
    //     if(_module !='webRequest') return;
    //     console.log(message, 'web-request-message');
    //     api[handleName] && api[handleName](message.rule);
    //     sendResponse({ success: true });
        
    // });




    console.log('🎉 Enhanced Web Request Interceptor Ready!');
}();

// !function () {
//     // return;
//     __WEB_REQUEST_API__.addRule({
//         urlPattern: "addWithSchema",
//         modifier: (bodyData) => {
//         const sku = { 
//             sku_detail: {
//                 "value": [
//                     {
//                         "id": "a2bff75f3699-b96f75-9dd998f1d26c",
//                         "stock_info": {
//                             "stock_num": 0
//                         },
//                         "sku_status": true,
//                         "confirm_no_barcode": false,
//                         "spec_detail_ids": [
//                             "996662214245076355"
//                         ],
//                         "spec_price_unit_info": [
//                             {
//                                 "correction_type": 0,
//                                 "is_updated": false,
//                                 "property_name": "件数",
//                                 "value_name": "3瓶"
//                             },
//                             {
//                                 "correction_type": 0,
//                                 "is_updated": false,
//                                 "property_name": "总净含量",
//                                 "value_name": "810g"
//                             }
//                         ],
//                         "price": "39.9"
//                     },
//                     {
//                         "id": "bcaefa0e2da1-956a79-b939f6d4441a",
//                         "stock_info": {
//                             "stock_num": 0
//                         },
//                         "sku_status": true,
//                         "confirm_no_barcode": false,
//                         "spec_detail_ids": [
//                             "997852115074171730"
//                         ],
//                         "spec_price_unit_info": [
//                             {
//                                 "correction_type": 0,
//                                 "is_updated": false,
//                                 "property_name": "件数",
//                                 "value_name": "1瓶"
//                             },
//                             {
//                                 "correction_type": 0,
//                                 "is_updated": false,
//                                 "property_name": "总净含量",
//                                 "value_name": "270g"
//                             }
//                         ],
//                         "price": "28.9"
//                     }
//                 ]
//             },
//             spec_detail: {
//                 "value": [
//                     {
//                         "cp_id": 3164,
//                         "id": "-10000",
//                         "name": "套餐类型",
//                         "spec_values": [
//                             {
//                                 "id": "996662214245076355",
//                                 "name": "【买二加一 大半年用量】270g*3瓶",
//                                 "measure_info": {
//                                     "template_id": 98,
//                                     "values": [
//                                         {
//                                             "module_id": 155,
//                                             "prefix": "",
//                                             "suffix": "",
//                                             "value": "【买二加一 大半年用量】"
//                                         },
//                                         {
//                                             "module_id": 156,
//                                             "prefix": "",
//                                             "suffix": "*",
//                                             "value": "270",
//                                             "unit_id": 2,
//                                             "unit_name": "g"
//                                         },
//                                         {
//                                             "module_id": 157,
//                                             "prefix": "",
//                                             "suffix": "",
//                                             "value": "3",
//                                             "unit_id": 118,
//                                             "unit_name": "瓶"
//                                         }
//                                     ]
//                                 },
//                                 "invalid": false,
//                                 "img_url": "https://p3-aio.ecombdimg.com/obj/ecom-shop-material/webp_m_abe6ce6b50b24eed36b3c496479ff396_sx_65552_www800-800"
//                             },
//                             {
//                                 "id": "997852115074171730",
//                                 "name": "【贵在运费】270g*1瓶",
//                                 "measure_info": {
//                                     "template_id": 98,
//                                     "values": [
//                                         {
//                                             "module_id": 155,
//                                             "prefix": "",
//                                             "suffix": "",
//                                             "value": "【贵在运费】"
//                                         },
//                                         {
//                                             "module_id": 156,
//                                             "prefix": "",
//                                             "suffix": "*",
//                                             "value": "270",
//                                             "unit_id": 2,
//                                             "unit_name": "g"
//                                         },
//                                         {
//                                             "module_id": 157,
//                                             "prefix": "",
//                                             "suffix": "",
//                                             "value": "1",
//                                             "unit_id": 118,
//                                             "unit_name": "瓶"
//                                         }
//                                     ]
//                                 },
//                                 "invalid": false,
//                                 "img_url": "https://p3-aio.ecombdimg.com/obj/ecom-shop-material/png_m_4da83a62ae28301394bfbd172c25b3e9_sx_41869_www300-300"
//                             }
//                         ]
//                     }
//                 ]
//             } 
//             }
//             // bodyData.schema.model.sku_detail = sku_detail;
//             // bodyData.schema.model.spec_detail = spec_detail;

//             return bodyData;
//         }
//     });
// }()





