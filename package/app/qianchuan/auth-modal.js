!async function () {
    "use strict";

    if (window.__MD_QC_AUTH_MODAL__) return;
    if (!(location.href.indexOf('https://qianchuan.jinritemai.com/home') >= 0)) return;

    const mdChrome = _require("mdChrome");
    if (!mdChrome || !mdChrome.web || !mdChrome.web.cmd) return;

    const getPlateform = () => {
        const host = window.location.hostname;
        const [platform] = host.split('.') || '';
        return platform;
    }

    const NET_INFO = {
        platform: getPlateform(),
        origin: [],
        url: `https://${location.host}`,
        loginUrl: `https://${location.host}/login`,
        cookieParams: [],
        cookieDomain: window.location.hostname,
    }

    if (NET_INFO.platform === 'business') {
        NET_INFO.url = 'https://business.oceanengine.com';
        NET_INFO.loginUrl = 'https://business.oceanengine.com/login';
        NET_INFO.origin = ["https://business.oceanengine.com", "https://oceanengine.com", "https://ad.oceanengine.com", "https://api.feelgood.cn"];
        NET_INFO.cookieParams = ['sessionid', 'sessionid_ss', 'sid_ucp_sso_v1', 'ssid_ucp_sso_v1', 'uid_tt', 'sid_tt', 'trace_log_user_id', 'csrftoken', 'd_ticket', 'is_hit_partitioned_cookie_canary', 'csrf_session_id', 'is_hit_partitioned_cookie_canary_ss', 'is_staff_user', 'n_mh', 'odin_tt', 'passport_csrf_token', 'passport_csrf_token_default', 'passport_mfa_token', 'sid_guard', 'sid_ucp_v1', 'ssid_ucp_v1', 'sso_uid_tt', 'sso_uid_tt_ss', 'toutiao_sso_user', 'toutiao_sso_user_ss', 'ttwid', 'uid_tt_ss', 'x-jupiter-uuid'];
        NET_INFO.cookieDomain = 'business.oceanengine.com';
    } else {
        NET_INFO.url = 'https://qianchuan.jinritemai.com';
        NET_INFO.loginUrl = 'https://agent.oceanengine.com/login';
        NET_INFO.origin = ['agent.oceanengine.com', "oceanengine.com", "api.feelgood.cn", "qianchuan.jinritemai.com", ".jinritemai.com", ".qianchuan.jinritemai.com"];
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
        ];

        NET_INFO.cookieDomain = 'oceanengine.com';
    }

    await mdChrome.web.injectScript('cp_modules/store/index.js');
    const store = _require('chromeRedux');
    if (!store) return;
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
            SET_TIKTOK_USERINFO(state, payload = {}) {
                if (payload.user_id != state.tiktok.user_id) {
                    state.authLoss = true;
                }
                state['tiktok'] = Object.assign(state.tiktok, payload);
            },
        }
    };
    store.registerModule('APP', App);
    store.init();

    function createEl(tag, attrs = {}, html) {
        const el = document.createElement(tag);
        Object.keys(attrs || {}).forEach(k => {
            if (k === 'style' && attrs[k] && typeof attrs[k] === 'object') {
                Object.assign(el.style, attrs[k]);
                return;
            }
            if (k === 'className') {
                el.className = attrs[k];
                return;
            }
            el.setAttribute(k, attrs[k]);
        });
        if (html !== undefined) el.innerHTML = html;
        return el;
    }

    function countdown(seconds, callback) {
        let count = seconds;
        callback(count);
        const timer = setInterval(() => {
            count--;
            callback(count);
            if (count < 0) {
                clearInterval(timer);
            }
        }, 1000);
    }

    let rootEl = null;
    let btnGetCookie = null;
    let btnChangeAccount = null;
    let btnAuthAccount = null;
    let msgEl = null;
    let errorTextEl = null;
    let confirmEl = null;
    let closeEl = null;
    let collapseEl = null;
    let dragHandleEl = null;
    let bodyEl = null;
    let collapsed = false;

    const POS_KEY = '__md_qc_tool_pos__';
    const STATE_KEY = '__md_qc_tool_state__';

    function readPos() {
        try {
            const raw = localStorage.getItem(POS_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function savePos(pos) {
        try {
            localStorage.setItem(POS_KEY, JSON.stringify(pos));
        } catch (e) {
        }
    }

    function readState() {
        try {
            const raw = localStorage.getItem(STATE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function saveState(state) {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (e) {
        }
    }

    function ensureUI() {
        if (rootEl && document.body.contains(rootEl)) return;

        const styleId = '__md_qc_auth_modal_style__';
        if (!document.getElementById(styleId)) {
            document.head.appendChild(createEl('style', { id: styleId }, `
            #__md_qc_auth_modal__{position:fixed;z-index:2147483647;display:block;right:16px;top:160px;width:178px;background:#fff;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.2);overflow:hidden;font-family:PingFangSC-Regular,PingFang SC,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial;}
            #__md_qc_auth_modal__.__md_left{left:16px;right:auto;}
            #__md_qc_auth_modal__.__md_hidden{display:none;}
            #__md_qc_auth_modal__.__md_collapsed{width:74px;}
            #__md_qc_auth_modal__ .__md_header{padding:10px 10px;background:rgba(55,119,255,.12);color:#323335;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:space-between;user-select:none;cursor:grab;}
            #__md_qc_auth_modal__ .__md_header:active{cursor:grabbing;}
            #__md_qc_auth_modal__ .__md_title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            #__md_qc_auth_modal__ .__md_actions{display:flex;gap:6px;}
            #__md_qc_auth_modal__ .__md_icon_btn{width:24px;height:24px;line-height:24px;text-align:center;border-radius:6px;cursor:pointer;color:#666;background:rgba(255,255,255,.7);}
            #__md_qc_auth_modal__ .__md_body{padding:12px 12px 12px 12px;}
            #__md_qc_auth_modal__.__md_collapsed .__md_body{display:none;}
            #__md_qc_auth_modal__ .__md_tips p{font-size:12px;color:#969aa0;line-height:18px;margin:0 0 6px 0;}
            #__md_qc_auth_modal__ .__md_tips .__md_red{color:#fb2025;display:none;}
            #__md_qc_auth_modal__ .__md_btn_group{padding-top:8px;} 
            #__md_qc_auth_modal__ button{cursor:pointer;line-height:25px;min-width:120px;font-size: 12px;border:1px solid transparent;border-radius:8px;padding:0 12px;color:#fff;background:#3777FF;}
            #__md_qc_auth_modal__ button:disabled{opacity:.6;cursor:not-allowed;}
            #__md_qc_auth_modal__ .__md_btn_row{display:flex;justify-content:center;}
            #__md_qc_auth_modal__ .__md_confirm{display:none;gap:10px;justify-content:center;margin-top:10px;}
            #__md_qc_auth_modal__ .__md_confirm button{min-width:auto;line-height:28px;font-size:12px;padding:0 10px;}
            #__md_qc_auth_modal__ .__md_confirm .__md_default{background:#3777FF;}
            #__md_qc_auth_modal__ .__md_confirm .__md_primary{background:#23c23f;}
            #__md_qc_auth_modal__ .__md_msg{display:none;margin-top:10px;text-align:center;font-size:12px;}
            #__md_qc_auth_modal__ .__md_msg.__md_green{color:#23c23f;}
            #__md_qc_auth_modal__ .__md_msg.__md_red{color:#fb2025;}
            `));
        }

        rootEl = createEl('div', { id: '__md_qc_auth_modal__' });
        rootEl.classList.add('__md_hidden');
        dragHandleEl = createEl('div', { className: '__md_header' });
        const title = createEl('div', { className: '__md_title' }, '授权工具');
        const actions = createEl('div', { className: '__md_actions' });
        collapseEl = createEl('div', { className: '__md_icon_btn' }, '—');
        closeEl = createEl('div', { className: '__md_icon_btn' }, '×');
        actions.appendChild(collapseEl);
        actions.appendChild(closeEl);
        dragHandleEl.appendChild(title);
        dragHandleEl.appendChild(actions);

        bodyEl = createEl('div', { className: '__md_body' });
        const tips = createEl('div', { className: '__md_tips' });
        tips.appendChild(createEl('p', {}, '· 同意授权前，请确认平台保持在登录状态'));
        errorTextEl = createEl('p', { className: '__md_red' }, '当前授权的广告主账户可能不在您登录的巨量引擎账号下，请使用已授权的组织账号登录');
        tips.appendChild(errorTextEl);

        const btnGroup = createEl('div', { className: '__md_btn_group' });
        const btnRow = createEl('div', { className: '__md_btn_row' });
        btnGetCookie = createEl('button', { id: '__md_qc_auth_btn__' }, '同意授权');
        btnRow.appendChild(btnGetCookie);
        btnGroup.appendChild(btnRow);

        confirmEl = createEl('div', { className: '__md_confirm' });
        btnChangeAccount = createEl('button', { className: '__md_default' }, '切换账号');
        btnAuthAccount = createEl('button', { className: '__md_primary' }, '仍要授权');
        confirmEl.appendChild(btnChangeAccount);
        confirmEl.appendChild(btnAuthAccount);
        btnGroup.appendChild(confirmEl);

        msgEl = createEl('div', { className: '__md_msg __md_green' });
        bodyEl.appendChild(tips);
        bodyEl.appendChild(btnGroup);
        bodyEl.appendChild(msgEl);

        rootEl.appendChild(dragHandleEl);
        rootEl.appendChild(bodyEl);
        document.body.appendChild(rootEl);

        closeEl.addEventListener('click', () => api.hide());
        collapseEl.addEventListener('click', () => api.toggleCollapsed());

        const initPos = readPos();
        const initState = readState();
        if (initState && typeof initState.collapsed === 'boolean') collapsed = initState.collapsed;
        applyCollapsed();
        applyPosition(initPos);

        setupDrag();

        btnGetCookie.addEventListener('click', async () => {
            await doAuth(false);
        });
        btnChangeAccount.addEventListener('click', async () => {
            await changeAccount();
        });
        btnAuthAccount.addEventListener('click', async () => {
            await doAuth(true);
        });
    }

    function setMsg(text, type) {
        ensureUI();
        msgEl.style.display = 'block';
        msgEl.className = '__md_msg ' + (type === 'red' ? '__md_red' : '__md_green');
        msgEl.innerText = text;
    }

    function hideMsg() {
        if (!msgEl) return;
        msgEl.style.display = 'none';
    }

    function authError(error = {}) {
        const textMaps = {
            8001: ':请确保当前浏览器已登录量多多智投',
            8002: ':相关cookie已过期，请重新登录巨量工作台',
        };
        setMsg('授权失败' + (textMaps[error.code] || ''), 'red');
    }

    function authSuccess() {
        btnGetCookie.style.display = 'none';
        setMsg('授权成功', 'green');
        countdown(5, (count) => {
            if (count <= 0) {
                api.collapse();
                return;
            }
            setMsg('授权成功! ' + count + 's后将自动关闭', 'green');
        });
    }

    function applyCollapsed() {
        if (!rootEl) return;
        if (collapsed) {
            rootEl.classList.add('__md_collapsed');
            if (collapseEl) collapseEl.innerText = '+';
        } else {
            rootEl.classList.remove('__md_collapsed');
            if (collapseEl) collapseEl.innerText = '—';
        }
        saveState({ collapsed });
    }

    function applyPosition(pos) {
        if (!rootEl) return;
        const defaultTop = 160;
        const viewportH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        const minTop = 16;
        const maxTop = Math.max(minTop, viewportH - 60);

        let top = defaultTop;
        let side = 'right';
        if (pos && typeof pos.top === 'number') top = pos.top;
        if (pos && (pos.side === 'left' || pos.side === 'right')) side = pos.side;
        top = Math.min(Math.max(top, minTop), maxTop);

        rootEl.style.top = top + 'px';
        if (side === 'left') {
            rootEl.classList.add('__md_left');
        } else {
            rootEl.classList.remove('__md_left');
        }
    }

    function setupDrag() {
        if (!dragHandleEl || !rootEl) return;
        let dragging = false;
        let startY = 0;
        let startTop = 0;

        const onMove = (ev) => {
            if (!dragging) return;
            const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
            const dy = clientY - startY;
            const viewportH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
            const minTop = 16;
            const maxTop = Math.max(minTop, viewportH - 60);
            let nextTop = startTop + dy;
            nextTop = Math.min(Math.max(nextTop, minTop), maxTop);
            rootEl.style.top = nextTop + 'px';
        }
        const onUp = (ev) => {
            if (!dragging) return;
            dragging = false;
            window.removeEventListener('mousemove', onMove, true);
            window.removeEventListener('mouseup', onUp, true);
            window.removeEventListener('touchmove', onMove, { capture: true });
            window.removeEventListener('touchend', onUp, true);

            const viewportW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
            const rect = rootEl.getBoundingClientRect();
            const side = rect.left + rect.width / 2 < viewportW / 2 ? 'left' : 'right';
            const top = rect.top;
            savePos({ side, top });
            applyPosition({ side, top });
        }

        const onDown = (ev) => {
            const target = ev.target;
            if (target === closeEl || target === collapseEl) return;
            dragging = true;
            const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
            startY = clientY;
            startTop = parseInt(rootEl.style.top || '0', 10) || rootEl.getBoundingClientRect().top;
            window.addEventListener('mousemove', onMove, true);
            window.addEventListener('mouseup', onUp, true);
            window.addEventListener('touchmove', onMove, { capture: true, passive: false });
            window.addEventListener('touchend', onUp, true);
        }

        dragHandleEl.addEventListener('mousedown', onDown);
        dragHandleEl.addEventListener('touchstart', onDown, { passive: true });
    }

    async function changeAccount() {
        try {
            await mdChrome.web.cmd({ cmd: 'changeAccount', origins: NET_INFO.origin });
        } catch (e) {
        }
    }

    async function getCookiesByDomain() {
        const cookieAwait = NET_INFO.origin.map(origin => {
            return mdChrome.web.cmd({ cmd: 'getCookie', myDomain: origin });
        });
        const cookiesGroupRes = await Promise.all(cookieAwait);
        let cookiesArr = [];
        cookiesGroupRes.map(res => { cookiesArr.push(...((res && res.cookies) ? res.cookies : [])) });
        // const res = await mdChrome.web.cmd({ cmd: 'getCookie', myDomain: NET_INFO.cookieDomain });
        // const cookiesArr = (res && res.cookies) ? res.cookies : [];
        // console.log(cookiesArr, cookiesGroupRes);
        const map = {};
        cookiesArr.forEach(c => {
            map[c.name] = c.value;
        });
        const filtered = NET_INFO.cookieParams.map(name => {
            const val = map[name];
            if (!val) return null;
            if (name === 'trace_log_user_id') return null;
            return name + '=' + val;
        }).filter(Boolean);
        return {
            value: filtered.join('; '),
            expire: Date.now() + 24 * 3600 * 1000,
        };
    }

    async function authAccount(cookie, forceAuth) {
        try {
            const info = await store.get('APP');
            const { accountCode, accountCodeUin, token } = (info || {}).itaored || {};
            const { user_id } = (info || {}).tiktok || {};
            if (accountCodeUin != user_id && !forceAuth) {
                confirmEl.style.display = 'flex';
                errorTextEl.style.display = 'block';
                btnGetCookie.style.display = 'none';
                return;
            }
            const response = await mdChrome.web.cmd({
                cmd: 'fetch',
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
            const result = response ? response.result : {};
            const { success } = result || {};
            if (!success) {
                return authError(result);
            }
            authSuccess();
        } catch (error) {
            authError(error);
        }
    }

    async function doAuth(forceAuth) {
        ensureUI();
        hideMsg();
        confirmEl.style.display = 'none';
        errorTextEl.style.display = 'none';
        btnGetCookie.style.display = 'inline-block';

        const text = btnGetCookie.innerText;
        try {
            btnGetCookie.disabled = true;
            btnGetCookie.innerText = '授权中...';
            const _cookie = await getCookiesByDomain();
            await store.commit('APP/SET_TIKTOK_USERINFO', Object.assign({}, _cookie));
            if (!_cookie.value) {
                authError({});
                throw new Error('empty cookie');
            }
            await authAccount(_cookie, forceAuth);
        } catch (e) {
        } finally {
            btnGetCookie.disabled = false;
            btnGetCookie.innerText = text;
        }
    }

    const api = {
        open() {
            ensureUI();
            rootEl.classList.remove('__md_hidden');
            api.expand();
        },
        hide() {
            ensureUI();
            rootEl.classList.add('__md_hidden');
        },
        expand() {
            ensureUI();
            collapsed = false;
            applyCollapsed();
            hideMsg();
            confirmEl.style.display = 'none';
            errorTextEl.style.display = 'none';
            btnGetCookie.style.display = 'inline-block';
        },
        collapse() {
            ensureUI();
            collapsed = true;
            applyCollapsed();
        },
        toggleCollapsed() {
            ensureUI();
            collapsed = !collapsed;
            applyCollapsed();
        }
    };
    window.__MD_QC_AUTH_MODAL__ = api;

}();
