!async function () {
    // if (window.top !== window.self) return;
    const mdChrome = _require('mdChrome');
    const authType = new URLSearchParams(window.location.search)
        .get('__AUTH_TYPE__');

    // 创建居中弹窗
    const createModal = (message) => {
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 21474836471;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            
        `;

        // 创建弹窗内容
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 40px 60px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            text-align: center;
            font-size: 18px;
            color: #333;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 500px;
            cursor: default;
            
        `;
        modal.textContent = message;

        // 阻止点击弹窗内容时关闭
        modal.addEventListener('click', (e) => {
            document.body.removeChild(overlay);
        });

        // 点击遮罩层关闭弹窗
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        return overlay;
    };


    const getUserInfo = async () => {
        const cookieAwait = ['.1688.com', '.mmstat.com'].map(origin => {
            return mdChrome.web.cmd({ cmd: 'getCookie', myDomain: origin });
        });
        const cookiesGroupRes = await Promise.all(cookieAwait);
        let cookiesArr = [];
        cookiesGroupRes.map(res => { cookiesArr.push(...((res && res.cookies) ? res.cookies : [])) });
        const map = {};
        cookiesArr.forEach(c => {
            map[c.name] = c.value;
        });
        const filtered = [
            "xlly_s",
            "leftMenuLastMode",
            "leftMenuModeTip",
            "cookie2",
            "t",
            "_tb_token_",
            "lid",
            "__last_loginid__",
            "__last_memberid__",
            "mtop_partitioned_detect",
            "_m_h5_tk",
            "_m_h5_tk_enc",
            "trackId",
            "plugin_home_downLoad_cookie",
            "_samesite_flag_",
            "tracknick",
            "ali_apache_track",
            "ali_apache_tracktmp",
            "union",
            "cna",
            "cookie1",
            "cookie17",
            "sgcookie",
            "sg",
            "csg",
            "unb",
            "uc4",
            "_nk_",
            "__cn_logon__",
            "__cn_logon_id__",
            "last_mid",
            "_csrf_token",
            "isg",
            "_user_vitals_session_data_",
            "tfstk"
        ].map(name => {
            const val = map[name];
            if (!val) return null;
            return name + '=' + val;
        }).filter(Boolean);
        const cookie = filtered.join('; ');
        return {
            cookie,
            object: map,
        }
    };

    function updateUrlAndReload(params) {
        const url = new URL(window.location.href);

        Object.entries(params).forEach(([k, v]) => {
            url.searchParams.set(k, v);
        });

        window.location.href = url.toString(); // ✅ 会触发 load
    }
    const info = await getUserInfo();

    const triggerSLIDINGBLOCK = () => {
        createModal('访问受限，请解锁滑块验证码');

        // 滚动到页面底部
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        });

    }

    const triggerLogin = () => {
        if (info.object.unb) {
            return;
        }
        createModal('请登录');
    }



    if (authType === 'LOGIN') {
        triggerLogin();
    }

    function waitForDialog(selector, callback) {
        const el = document.querySelector(selector)
        if (el) {
            callback(el)
            return
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector)
            if (el) {
                observer.disconnect()
                callback(el)
            }
        })

        observer.observe(document.body, {
            childList: true,
            subtree: true
        })
    }

    // 使用
    waitForDialog('.baxia-dialog', (dialog) => {
        if (authType === 'SLIDING_BLOCK') {
            triggerSLIDINGBLOCK();
        }
    });
    if (authType !== 'SLIDING_BLOCK') return;
    const nav = performance.getEntriesByType('navigation')[0]
    // 表示滑块成功了;
    if (nav?.type === 'reload') {
        createModal('请稍等...');
        setTimeout(() => {
            
            updateUrlAndReload({
                __AUTH_TYPE__: 'TOKEN'
            });
        }, 2000)

    }



}()