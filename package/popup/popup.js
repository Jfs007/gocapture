
!async function() {
    const store = _require('chromeRedux');
    let App = {
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
            SET_TIKTOK_USERINFO(state, payload = {}) {
                if (payload.user_id != state.tiktok.user_id) {
                    state.authLoss = true;
                }
                state['tiktok'] = Object.assign(state.tiktok, payload);
            },

        }
    }
    store.registerModule('APP', App);
    store.init();


    const getPlateform = async () => {
        const tab = await getCurrentTab();
        const _location = new URL(tab.url);
        const host = _location.hostname;
        const [platform] = host.split('.') || '';
        return platform;
    }

    let AppState = App.state;


    let appUpdateLink = '';

    const NET_INFO = {
        platform: await getPlateform(),
        origin: [],
        url: ``,
        loginUrl: ``,
        cookieParams: []

    }
    console.log('当前平台信息popup/popup.js:', NET_INFO, window.location.hostname);
    if (NET_INFO.platform === 'business') {
        NET_INFO.url = 'https://business.oceanengine.com';
        NET_INFO.loginUrl = 'https://business.oceanengine.com/login';
        NET_INFO.origin = ["https://business.oceanengine.com", "https://oceanengine.com", "https://ad.oceanengine.com", "https://api.feelgood.cn"];
        NET_INFO.cookieParams = ['sessionid', 'sessionid_ss', 'sid_ucp_sso_v1', 'ssid_ucp_sso_v1', 'uid_tt', 'sid_tt', 'trace_log_user_id', 'csrftoken', 'd_ticket', 'is_hit_partitioned_cookie_canary', 'csrf_session_id', 'is_hit_partitioned_cookie_canary_ss', 'is_staff_user', 'n_mh', 'odin_tt', 'passport_csrf_token', 'passport_csrf_token_default', 'passport_mfa_token', 'sid_guard', 'sid_ucp_v1', 'ssid_ucp_v1', 'sso_uid_tt', 'sso_uid_tt_ss', 'toutiao_sso_user', 'toutiao_sso_user_ss', 'ttwid', 'uid_tt_ss', 'x-jupiter-uuid'];
    } else {
        NET_INFO.url = 'https://qianchuan.jinritemai.com';
        NET_INFO.loginUrl = 'https://agent.oceanengine.com/login';
        NET_INFO.origin = ['https://agent.oceanengine.com', "https://oceanengine.com", "https://api.feelgood.cn"];
        NET_INFO.cookieParams = [
  "is_staff_user",
  "d_ticket",
  "n_mh",
  "qc_tt_tag",
  "bd_ticket_guard_web_domain",
  "passport_csrf_token",
  "passport_csrf_token_default",
  "__security_mc_1_s_sdk_crypt_sdk",
  "__security_mc_1_s_sdk_cert_key",
  "__security_mc_1_s_sdk_sign_data_key_web_protect",
  "bd_ticket_guard_client_web_domain",
  "bd_ticket_guard_client_data",
  "s_v_web_id",
  "Hm_lvt_55b6f6890a6937842cef785d95ea99d7",
  "Hm_lvt_ed0a6497a1fdcdb3cdca291a7692408d",
  "Hm_lvt_729f63f2a2cf56cd38fff0220c787b4a",
  "passport_auth_status",
  "passport_auth_status_ss",
  "ucas_c0",
  "ucas_c0_ss",
  "COMPASS_LUOPAN_DT",
  "ttwid",
  "session_tlb_tag_bk",
  "_tea_utm_cache_2906",
  "uid_tt",
  "uid_tt_ss",
  "sid_tt",
  "sessionid",
  "sessionid_ss",
  "gfkadpd",
  "gd_random",
  "odin_tt",
  "bd_ticket_guard_server_data",
  "sid_guard",
  "session_tlb_tag",
  "sid_ucp_v1",
  "ssid_ucp_v1",
  "acsessionid",
  "csrftoken"
]


    }

    console.log(NET_INFO, 'NET_INFO');


    function copyText(value) {
        // 创建一个新的input元素
        var input = document.createElement("input");

        // 设置input的值
        input.value = value;
        // 将input元素添加到页面中
        document.body.appendChild(input);
        // 选中input中的文本
        input.select();
        input.setSelectionRange(0, 99999); // 对于手机设备
        // 执行复制操作
        document.execCommand("copy");
        // 移除input元素
        document.body.removeChild(input);
    }


    function authError(error = {}) {
        document.getElementById("msg").style.display = "block";
        const textMaps = {
            8001: ':请确保当前浏览器已登录量多多智投',
            8002: ':相关cookie已过期，请重新登录巨量工作台',
        }
        document.getElementById("msg").innerHTML = "授权失败" + (textMaps[error.code] || '');
        document
            .getElementById("msg")
            .setAttribute(
                "class", "msg red"
            );
    }

    function countdown(callback) {
        let count = 5;
        callback(count);
        const timer = setInterval(() => {
            count--;
            callback(count);
            if (count < 0) {
                clearInterval(timer);
            }
        }, 1000);
    }

    function authSuccess() {
        $("#getCookie").hide();
        document.getElementById("msg").style.display = "block";
        document.getElementById("msg").innerHTML = "授权成功";
        let successText = document.getElementById("msg");
        successText.setAttribute(
            "class", "msg green"
        );
        countdown((count) => {
            if (count <= 0) {
                chrome.tabs.query({
                    url: ["https://ad.itaored.com/*",
                        "https://testad.itaored.com/*",
                        "http://localhost:9002/*"]
                }, (tabs) => {
                    const tab = tabs[tabs.length - 1];
                    setTimeout(() => {
                        chrome.runtime.sendMessage({
                            cmd: "inject",
                            tabId: tab.id,
                            params: {
                                type: 'eval',
                                value: `console.log('refresh');window.__TEMP_OPEN_ACCOUNT_MANAGE_REFRESH__ && window.__TEMP_OPEN_ACCOUNT_MANAGE_REFRESH__()`
                            }
                        });
                        setTimeout(() => {
                            chrome.tabs.update(tab.id, { active: true })

                        }, 100)

                    }, 800)

                });
            };

            document.getElementById("msg").innerHTML = '授权成功! ' + count + 's后将返回量多多智投';
            document.getElementById("msg").setAttribute(
                "class", "green msg"
            );
        })

    }

    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }
    // 根据域名类型处理逻辑
    async function authAccount(cookie, forceAuth = false) {
        try {
            const info = await store.get('APP');
            const { accountCode, accountCodeUin, token } = info.itaored;
            const { user_id } = info.tiktok;
            // AppState = await chromeRedux.get('APP') || {};
            if (accountCodeUin != user_id && !forceAuth) {
                $('#authConfirm').show();
                $("#getCookie").hide();
                $('#errorText').show();
                return;
            }
            const response = await chrome.runtime.sendMessage({
                cmd: "fetch",
                method: 'post',
                url: 'api/dy/account/cookie',
                headers: {
                    'Content-Type': 'application/json',
                    accesstoken: token
                },
                data: JSON.stringify({
                    value: cookie.value,
                    expire: cookie.expire,
                    userId: user_id,
                    channel: 10,
                    accountCode: accountCode
                })
            });
            // console.log(response, 'response');
            const { success } = response.result;
            if (!success) {
                return authError(response.result);
            }
            authSuccess();
        } catch (error) {
            authError(error)
            console.log("处理时出错: " + error.message);
        }
    }
    // 获取 Cookie 的通用函数
    async function getCookies(paramArr, host) {
        let expire = 10000000000000;
        const cookies = await Promise.all(paramArr.map(name => {
            return new Promise((resolve, reject) => {
                chrome.cookies.get({ url: host, name: name }, function (cookies) {
                    if (cookies) {
                        if (name === 'trace_log_user_id') {
                            resolve(null);
                        } else {
                            let currentExpire = name !== 'x-jupiter-uuid' ? (Math.floor(cookies.expirationDate * 1000) || 10000000000000) : expire;
                            expire = Math.min(expire, currentExpire);
                            resolve(name + "=" + cookies.value);
                        }

                    } else {
                        resolve(null); // 如果没有找到cookie，则返回null
                    }
                });
            });
        }));
        return {
            emptyExpire: 10000000000000,
            value: cookies.filter(cookie => cookie).join("; "),
            expire
        } // 返回过滤后的 cookies
    }
    // const _URL_ = 'https://business.oceanengine.com';
    // const paramArr = ['sessionid', 'sessionid_ss', 'sid_ucp_sso_v1', 'ssid_ucp_sso_v1', 'uid_tt', 'sid_tt', 'trace_log_user_id', 'csrftoken', 'd_ticket', 'is_hit_partitioned_cookie_canary', 'csrf_session_id', 'is_hit_partitioned_cookie_canary_ss', 'is_staff_user', 'n_mh', 'odin_tt', 'passport_csrf_token', 'passport_csrf_token_default', 'passport_mfa_token', 'sid_guard', 'sid_ucp_v1', 'ssid_ucp_v1', 'sso_uid_tt', 'sso_uid_tt_ss', 'toutiao_sso_user', 'toutiao_sso_user_ss', 'ttwid', 'uid_tt_ss', 'x-jupiter-uuid'];

    const removeCookie = async (handle = () => { }) => {
        chrome.browsingData.removeCookies({
            origins: NET_INFO.origin
        }, function () {
            handle && handle();
            // chrome.tabs.reload(tab.id);
        });
    };
    async function changeAccount() {
        const tab = await getCurrentTab();
        removeCookie(() => {
            chrome.tabs.update(tab.id, { url: `${NET_INFO.loginUrl}?appKey=51` })
        })
    }
    async function getAppUpdateLink() {
        // const app = await chromeRedux.get('APP') || {};
        const response = await chrome.runtime.sendMessage({ cmd: "fetch", url: 'api/dictionary/iu/list?dictNames=CHROME_PLUGINS_LIST&_t=1747897789951' })
        const result = response.result;
        const children = ((result.data || [])[0] || { children: [] }).children;
        const item = children.find(_ => _.value == '巨量授权') || {};
        appUpdateLink = item.label;
        $('#appUpdateLink').attr({
            href: appUpdateLink
        })
    };

    // JS 监听逻辑
    $(document).ready(function () {
        getAppUpdateLink();
        // 点击事件监听
        $("#getCookie").click(async function () {
            const _this = $(this);
            const text = _this.text();
            try {
                _this.text('授权中...');
                // 获取 Cookie 并拼接成字符串
                const _cookie = await getCookies(NET_INFO.cookieParams, NET_INFO.url);
                if (_cookie.emptyExpire == _cookie.expire) {
                    authError({
                        code: 8002
                    });
                    throw new Error()
                }
                await store.commit('APP/SET_TIKTOK_USERINFO', _cookie);
                // 根据类型处理后续逻辑
                if (!_cookie.value) { authError({}); throw new Error() }
                await authAccount(_cookie);
                _this.text(text);

            } catch (error) {
                _this.text(text);
                console.log("获取 Cookie 或处理逻辑时出错: " + error.message);
            }
        });
        $("#changeAccount").click(async function () {
            changeAccount();
        });
        $('#authAccount').click(async function () {
            const _this = $(this);
            const text = _this.text();
            try {
                _this.text('授权中...');
                // 获取 Cookie 并拼接成字符串
                const _cookie = await getCookies(NET_INFO.cookieParams, NET_INFO.url);
                console.log(_cookie, 'cookie', NET_INFO);
                if (_cookie.emptyExpire == _cookie.expire) {
                    authError({
                        code: 8002
                    });
                    throw new Error()
                }
                await store.commit('APP/SET_TIKTOK_USERINFO', _cookie);
                // 根据类型处理后续逻辑
                if (!_cookie.value) { authError({}); throw new Error() }
                await authAccount(_cookie, true);
                _this.text(text);
            } catch (error) {
                _this.text(text);
                console.log("获取 Cookie 或处理逻辑时出错: " + error.message);
            }
        })
        async function setup() {
            App.state = await store.get('APP');
            AppState = App.state;
            const tab = await getCurrentTab();
            $("#getCookie").hide();
            $('#authConfirm').hide();
            $('#errorText').hide();
            if (!(NET_INFO.platform == 'business' || NET_INFO.platform == 'qianchuan')) return;
            try {
                // 无论是否捞到小助手的token都展示授权按钮
                $("#getCookie").show();
            } catch (error) {
                console.log(error, 'errro');
            }
        }
        setup();
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'PAGE_LOADED') {
                // 处理 Tab 加载完成的事件
                setup();
            }
        });

    });
}();





