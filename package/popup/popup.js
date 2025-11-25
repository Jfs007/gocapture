async function start(){
    var config =  await chrome.runtime.sendMessage({ cmd: "getConfig"})
    var m = await chrome.runtime.sendMessage({ cmd: "getManifest" })
    // var u = config.popUrl+"?crxId="+m.crxId+"&v="+m.version+"&time="+new Date().getTime()
    // var r = await fetch(u)
    // var r2 = await r.text()
    // document.getElementsByTagName("body")[0].innerHTML = r2


    
}
start();
const chromeRedux = _require('chromeRedux');
let AppState = {
    itaored: {

    },
    tiktok: {

    }

}
let appUpdateLink = '';

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
        8001: ':请确保当前浏览器已登录量多多智投'
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
                    // 待兼容
                    // chrome.runtime.sendMessage({
                    //     action: 'TAB_WAITING_CALLBACK',
                    //     data: {
                    //         tabId: tab.id,
                    //         action: 'cookie:authed'
                    //     }
                    // });
                    setTimeout(() => {
                        chrome.tabs.update(tab.id, { active: true });
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
async function getLocalStorage(tab) {
    return new Promise((resolve) => {
        // 待兼容
        // chrome.tabs.sendMessage(tab.id, { type: 'LOCALSTORAGE:GET' }, (response) => {
        //     resolve(response);
        // });
    })
}
async function getUserInfo(tab) {
    // 待兼容
    // const storage = (await getLocalStorage(tab)) || {};
    // const cache_tokens = storage['__Garfish__bp-web____tea_cache_tokens_1892'];
    // let { user_unique_id } = JSON.parse(cache_tokens || "{}");
    // return { user_unique_id };
    return {}
}

// 根据域名类型处理逻辑
async function authAccount() {
    try {
        AppState = await chromeRedux.get('APP') || {};
        if (AppState.itaored.accountCodeUin != AppState.tiktok.user_id) {
            $('#authConfirm').show();
            $("#getCookie").hide();
            $('#errorText').show();
            return;
        }
        const state = await chromeRedux.commit('APP/AUTH', AppState);
        if (!state.__response__.success) {
            return authError(state.__response__);
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
    const { user_id } = AppState.tiktok;
    if (!user_id) {
        const tab = await getCurrentTab();
        let { user_unique_id } = await getUserInfo(tab);
        AppState.tiktok.user_id = user_unique_id;
    }
    const cookies = await Promise.all(paramArr.map(name => {
        return new Promise((resolve, reject) => {
            chrome.cookies.get({ url: host, name: name }, function (cookies) {
                if (cookies) {
                    if (name === 'trace_log_user_id') {
                        AppState.tiktok.user_id = cookies.value ? cookies.value : AppState.tiktok.user_id;
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
        value: cookies.filter(cookie => cookie).join("; "),
        expire,
        user_id: AppState.tiktok.user_id


    } // 返回过滤后的 cookies
}
const _URL_ = 'https://business.oceanengine.com';
const paramArr = ['sessionid', 'sessionid_ss', 'sid_ucp_sso_v1', 'ssid_ucp_sso_v1', 'uid_tt', 'sid_tt', 'trace_log_user_id', 'csrftoken', 'd_ticket', 'is_hit_partitioned_cookie_canary', 'csrf_session_id', 'is_hit_partitioned_cookie_canary_ss', 'is_staff_user', 'n_mh', 'odin_tt', 'passport_csrf_token', 'passport_csrf_token_default', 'passport_mfa_token', 'sid_guard', 'sid_ucp_v1', 'ssid_ucp_v1', 'sso_uid_tt', 'sso_uid_tt_ss', 'toutiao_sso_user', 'toutiao_sso_user_ss', 'ttwid', 'uid_tt_ss', 'x-jupiter-uuid'];

const removeCookie = async (handle = () => { }) => {
    chrome.browsingData.removeCookies({
        origins: ["https://business.oceanengine.com", "https://oceanengine.com", "https://ad.oceanengine.com", "https://api.feelgood.cn"]
    }, function () {
        handle && handle();
        // chrome.tabs.reload(tab.id);
    });
};
async function changeAccount() {
    const tab = await getCurrentTab();
    removeCookie(() => {
        chrome.tabs.update(tab.id, { url: 'https://business.oceanengine.com/login?appKey=51' })

    })
}

async function getAppUpdateLink() {
    const app = await chromeRedux.get('APP') || {};
    const response = await chrome.runtime.sendMessage({ cmd: "fetch", url: 'api/dictionary/iu/list?dictNames=CHROME_PLUGINS_LIST&_t=1747897789951' })
    const result = response.result;
    const children = ((result.data || [])[0] || { children: [] }).children;
    const item = children.find(_ => _.value == '巨量授权') || {};
    appUpdateLink = item.label;
    $('#appUpdateLink').attr({
        href: appUpdateLink
    })
};

async function auth() {
    try {
        const state = await chromeRedux.commit('APP/AUTH', AppState);
        if (!state.__response__.success) {
            return authError(state.__response__);
        }
        $('#authConfirm').hide();
        authSuccess();
    } catch (error) {
        authError({})
    }


}
const maxCount = 3;
let currentCount = 0;
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
            const _cookie = await getCookies(paramArr, _URL_);
            await chromeRedux.commit('APP/SET_TIKTOK_USERINFO', _cookie);
            // 根据类型处理后续逻辑
            if (!_cookie.user_id || !_cookie.value) { authError({}); throw new Error() }
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
    $('#authAccount').click(function () {
        auth();
    })
    $('#plugin-options').click(() => {
        const url = chrome.runtime.getURL('options/index.html');
        window.open(url, 'options');
    });
    async function setup() {
        // fetch('api/dictionary/iu/list?dictNames=CHROME_PLUGINS_LIST')
        const tab = await getCurrentTab();
        $("#getCookie").hide();
        $('#authConfirm').hide();
        $('#errorText').hide();
        if (tab.url.indexOf('business.oceanengine.com') < 0) return;
        try {
            AppState = await chromeRedux.get('APP') || {};
            let { user_unique_id } = await getUserInfo(tab);
            AppState.tiktok.user_id = user_unique_id;
            if (!user_unique_id && currentCount>=maxCount) {
                currentCount++;
                return chrome.tabs.reload(tab.id);
                
            }
            chromeRedux.commit('APP/SET_TIKTOK_USERINFO', AppState.tiktok);
            // 无论是否捞到小助手的token都展示授权按钮
            $("#getCookie").show();

            // setTimeout(() => {
            //     $("#getCookie").click()
            // }, 100)
            
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





