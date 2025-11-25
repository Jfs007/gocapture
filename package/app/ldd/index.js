!async function () {
    if (!(location.href.indexOf('localhost') > -1 || location.href.indexOf('.itaored.com') > -1)) return;
    const token = localStorage.getItem('TOKEN');
    console.log(JSON.parse(token || '{}'), 'ldd-token');
    const mdChrome = _require("mdChrome");
    await mdChrome.web.injectScript('cp_modules/store/index.js');
    // 2. 使用模块
    const store = _require('chromeRedux');
    console.log(store, token);  
    const App = {
        state: {
            __response__: {},
            itaored: {
                tabId: '',
                accountCodeUin: '',
                accountCode: '',
                token: '',
                // site: window.MPLG_IAD_API_URL,
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
                console.log(token, 'payload', payload);
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


}()