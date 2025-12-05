!async function () {

    if (location.href.indexOf('https://business.oceanengine.com/site/index') < 0) return;
    const mdChrome = _require("mdChrome");
    await mdChrome.web.injectScript('cp_modules/store/index.js');
    // 2. 使用模块
    const store = _require('chromeRedux');
    const App = {
        state: {
            __response__: {},
            itaored: {
                tabId: '',
                accountCodeUin: '',
                accountCode: '',
                token: '',
            },
            tiktok: {
                value: '',
                expire: '',
                user_id: ''
            },
            authLoss: true
        },
        mutations: {
            SET_ADITAOREAD_USERINFO(state, payload = {}) {
                const { token } = payload;
                if (token != state.itaored.token) {
                    state.authLoss = true;
                }
                state['itaored'] = Object.assign(state.itaored, payload);
            },
            SET_TIKTOK_USERINFO(state, payload = {}) {
                if (payload.user_id != state.tiktok.user_id) {
                    state.authLoss = true;
                }
                state['tiktok'] = Object.assign(state.tiktok, payload);
            },
            // 退出会清空
            async AUTH(state, payload) {
                const { user_id } = payload.tiktok;
                const { token } = payload.itaored;
                const { user_id: user_id_state } = state.tiktok;
                const { token: token_state, accountCode } = state.itaored;
                state['itaored'] = Object.assign(state.itaored, payload.itaored || {});
                state['tiktok'] = Object.assign(state.tiktok, payload.tiktok || {});
                if (!state['itaored'].token || !state['tiktok'].user_id) {
                    state.authLoss = true;
                    if (!state['itaored'].token) {
                        state.__response__ = { code: 8001 };
                    }
                    return true;
                };
                if ((user_id && user_id != user_id_state) || (token && token != token_state)) {
                    state.authLoss = true;
                }
                if (state.authLoss === true) {
                    console.log('=======发送授权信息=======', payload);
                    const site = state['itaored'].site;
                    // 提交代码
                    const tiktok = state['tiktok'];
                    state.__response__ = {};
                    try {
                        const response = await fetch(`${site}api/dy/account/cookie`, {
                            method: 'post',
                            headers: {
                                'Content-Type': 'application/json',
                                accesstoken: state['itaored'].token
                            },
                            body: JSON.stringify({
                                value: tiktok.value,
                                expire: tiktok.expire,
                                userId: tiktok.user_id,
                                accountCode: accountCode
                            })
                        });
                        const responseBody = await response.json();
                        state.__response__ = responseBody;
                        if (!responseBody.success) { throw new Error('') };
                        state.authLoss = false;
                    } catch (error) {
                        state.authLoss = true
                    }

                }

            }
        }
    }
    store.registerModule('APP', App);
    store.init();

    const observer = new MutationObserver(async () => {
        const el = document.querySelector('#header-user');
        if (el) {
            const webinfo = localStorage.getItem('__Garfish__bp-web____tea_cache_tokens_1892');
            const { user_unique_id } = JSON.parse(webinfo || '{}');
            // console.log(web_id, 'webid', webinfo);
            await store.commit('APP/SET_TIKTOK_USERINFO', { user_id: user_unique_id })
            mdChrome.web.cmd({
                cmd: 'openPopup'
            });
            observer.disconnect(); // 释放
        }
    });


    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    function base64UrlDecode(str) {
        str = str
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        while (str.length % 4) str += "=";
        return atob(str);
    }
    function xorDecryptUrlSafe(encoded, key = "LDLDKJKDJKFJDDKJD") {
        const data = base64UrlDecode(encoded);
        let arr = [];
        for (let i = 0; i < data.length; i++) {
            arr.push(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return String.fromCharCode(...arr);
    }
    try {
        const url = new URL(location.href);
        const ldd_authorization = url.searchParams.get("ldd_authorization");
        // console.log(ldd_authorization, 'ldd_authorization');
        const parts = ldd_authorization.split("_");
        // 前两个字段固定
        const accountCodeUin = parts[0];
        const accountCode = parts[1];
        // 剩余所有用 join 合并成 token
        const token = parts.slice(2).join("_");
        // console.log(accountCodeUin, accountCode, 'ldd_authorization');
        if (accountCodeUin) {
            const appState = await store.get('APP');
            // console.log(appState, 'ldd_authorization');
            appState.itaored.token = xorDecryptUrlSafe(token);
            appState.itaored.accountCodeUin = accountCodeUin;
            appState.itaored.accountCode = accountCode;
            await store.commit('APP/SET_ADITAOREAD_USERINFO', Object.assign(appState.itaored))

        }


    } catch (error) {
        console.log(error, 'ldd_authorization');
    }




}()