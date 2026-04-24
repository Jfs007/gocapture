!async function () {
    const mdChrome = _require('mdChrome');


    const getAppToken = () => {

    }

    // Toast 提示函数
    function showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
            animation: fadeIn 0.3s ease;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes fadeOut {
                from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                to { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
                document.head.removeChild(style);
            }, 300);
        }, duration);
    }





    function shouldBlock(el) {
        return el?.innerText && el.innerText.includes('退出');
    }

    function intercept(e) {
        let el = e.target;

        while (el && el !== document.body) {
            if (shouldBlock(el)) {
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation();
                mdChrome.web.cmd({
                    cmd: 'changeAccount',

                    origins: ['https://compass.jinritemai.com', 'https://fxg.jinritemai.com']

                })

                console.log('已拦截退出登录:', e.type);
                return false;
            }
            el = el.parentElement;
        }
    }

    // 🔥 拦截所有关键事件（重点）
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(type => {
        document.addEventListener(type, intercept, true); // 捕获阶段
    });

    // 检查 URL 是否携带 shop_id 参数
    function checkShopIdAndClick() {
        const urlParams = new URLSearchParams(window.location.search);
        const shopId = urlParams.get('shop_id');

        if (shopId) {
            console.log('检测到 shop_id:', shopId);

            // 先查找并悬浮 .headerShopName
            const hoverElement = document.querySelector('.headerShopName');
            if (!hoverElement) {
                console.log('未找到 .headerShopName，等待重试...');
                setTimeout(checkShopIdAndClick, 500);
                return;
            }

            console.log('找到 .headerShopName，触发悬浮');
            const mouseEnterEvent = new MouseEvent('mouseenter', {
                view: window,
                bubbles: true,
                cancelable: true
            });
            hoverElement.dispatchEvent(mouseEnterEvent);

            // 等待悬浮效果显示后再查找点击节点
            setTimeout(() => {
                const clickNode = document.evaluate(
                    '//*[@id="fxg-pc-header"]/div/div[2]/div[7]/div/div[2]/div/div/div/div[2]/div/div/div/div/div[6]/div/div',
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;

                if (clickNode) {
                    console.log('找到目标节点，执行点击');
                    clickNode.click();
                } else {
                    console.log('未找到目标节点，等待重试...');
                    setTimeout(checkShopIdAndClick, 500);
                }
            }, 300);
        }
    }

    async function createAuthButton() {
        const targetNode = document.evaluate(
            '//*[@id="compass-shop-header"]',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;

        if (!targetNode) {
            console.log('未找到目标节点，等待重试...');
            setTimeout(createAuthButton, 1000);
            return;
        }

        let isActive = false;

        try {
            let events;
            if (mdChrome.web.version) {
                events = await mdChrome.web.cmd({ cmd: 'event-list' });
                console.log(events, 'events');
            }

            // 验证响应格式是否正确
            if (events && events.once && Array.isArray(events.once)) {
                isActive = events.once.some(e => e.event === 'winsup-douyin-shop-auth');
            } else {
                console.warn('event-list 返回格式异常，默认激活状态');
                isActive = true;
            }
        } catch (error) {
            console.warn('event-list 命令不支持（老版本插件），默认激活状态:', error.message);
            isActive = true;
        }

        const authBtn = document.createElement('div');
        authBtn.id = 'winsup-douyin-shop-auth-btn';
        authBtn.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 1px 6px;
                cursor: ${isActive ? 'pointer' : 'not-allowed'};
                opacity: ${isActive ? '1' : '0.6'};
                user-select: none;
                transition: all 0.2s;
                background: #fff;
                border-radius: 6px;
                margin-left: 4px;
            ">
                <span style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: ${isActive ? '#52c41a' : '#d9d9d9'};
                    box-shadow: ${isActive ? '0 0 4px rgba(82, 196, 26, 0.5)' : 'none'};
                "></span>
                <span style="
                    font-size: 12px;
                    color: ${isActive ? '#333' : '#999'};
                ">winsup授权</span>
            </div>
        `;

        authBtn.addEventListener('click', async () => {
            const res = await fetch("https://compass.jinritemai.com/ecomauth/loginv1/get_account_info?login_source=compass&_lid=143196205491", {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "agw-js-conv": "str",
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"macOS\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin"
                },
                "referrer": "https://compass.jinritemai.com/shop",
                "body": null,
                "method": "GET",
                "mode": "cors",
                "credentials": "include"
            });
            const data = await res.json();
            console.log(data, 'data');

            if (isActive) {
                const config = window.__SSR_CONFIG_ECOM_FXG_ADMIN;
                const user = data?.data;
                mdChrome.web.send('winsup-douyin-shop-auth', {
                    user: {
                        ...user,
                        shop_name: user.account_name
                    }
                });
            } else {
                showToast('授权未激活,请返回winsup拉起授权弹窗~');
            }
        });

        if (isActive) {
            authBtn.addEventListener('mouseenter', (e) => {
                e.currentTarget.style.borderColor = '#1890ff';
                // e.currentTarget.style.boxShadow = '0 2px 8px rgba(24, 144, 255, 0.2)';
            });

            authBtn.addEventListener('mouseleave', (e) => {
                e.currentTarget.style.borderColor = '#e5e5e5';
                e.currentTarget.style.boxShadow = 'none';
            });
        }

        targetNode.appendChild(authBtn);
    }

    const openAccountSelector = () => {
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }


        // 找 class 前缀匹配 switchAccountxxx
        function findSwitchAccount() {
            return Array.from(document.querySelectorAll('[class]')).find(el =>
                [...el.classList].some(c => c.startsWith('switchAccount'))
            );
        }

        (async () => {
            // 1️⃣ 找 hover 目标（你之前那个节点）
            const hoverEl = document.querySelector('#compass-shop-header > div:nth-child(4) > div:nth-child(1)');

            if (!hoverEl) {
                console.warn('hover 元素没找到');
                return;
            }

            // 2️⃣ 触发 hover（mouseenter + mouseover 双保险）
            hoverEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            hoverEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

            let done = false;

            function findAndClick() {
                if (done) return;

                const el = Array.from(document.querySelectorAll('[class]')).find(node =>
                    [...node.classList].some(c => c.startsWith('switchAccount'))
                );

                if (el) {
                    done = true; // 🔒 锁住，防止重复执行
                    el.click();
                    console.log('clicked switchAccount');

                    observer.disconnect(); // 🧹 直接停止监听
                }
            }

            const observer = new MutationObserver(() => {
                findAndClick();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });

            console.log('observer started');


        })();
    }

    // 判断是否在 talent/product-rank 页面
    const isTalentProductRankPage = () => location.href.includes('compass.jinritemai.com/talent/product-rank');

    // 二次确认弹窗
    const showConfirmDialog = (accountName) => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: #fff;
                border-radius: 8px;
                padding: 20px;
                min-width: 300px;
                max-width: 400px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;

            dialog.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #333;">
                    确认授权
                </div>
                <div style="font-size: 14px; color: #666; margin-bottom: 20px; line-height: 1.6;">
                    ${accountName ? `<p style="margin: 4px 0;">账号：${accountName}</p>` : ''}
                    <p style="margin: 10px 0 0 0; color: #ff6b00;">确认将此账号授权给量多多使用？</p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="dy-cancel-btn" style="
                        padding: 8px 20px;
                        border: 1px solid #ddd;
                        background: #fff;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">取消</button>
                    <button id="dy-confirm-btn" style="
                        padding: 8px 20px;
                        border: none;
                        background: #1890ff;
                        color: #fff;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">确认授权</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            dialog.querySelector('#dy-cancel-btn').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(false);
            });

            dialog.querySelector('#dy-confirm-btn').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(true);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve(false);
                }
            });
        });
    };

    // 获取 env 配置（prod / test）
    const getEnvConfig = async () => {
        const manifest = await mdChrome.web.cmd({ cmd: "get-manifest" });
        const { env } = manifest.env || {};
        if (env === 'prod') {
            return {
                url: 'https://winsup.itaored.com/',
                api: 'https://winsup-api.itaored.com'
            };
        }
        return {
            url: 'https://testwinsup.itaored.com/',
            api: 'https://testwinsup-api.itaored.com'
        };
    };

    // 从 chrome storage 获取 AccessToken
    const getToken = () => {
        return new Promise((resolve) => {
            const id = Date.now() + Math.random() + ':md.local.get';
            function handler(e) {
                const msg = e.data;
                const sender = msg.sender || {};
                if (sender.id === id && sender.name == 'content-script') {
                    window.removeEventListener("message", handler);
                    resolve(msg.result);
                }
            }
            window.addEventListener("message", handler);
            window.postMessage({
                params: [['WinSupAccessToken']],
                cmd: "chrome",
                sender: { id, name: 'web-page' },
                call: 'storage.local.get'
            }, "*");
        });
    };
    const AuthCallback = async (info = {}, api) => {
        try {
            const confirmed = await showConfirmDialog(info.accountName);
            if (!confirmed) return;

            // 获取 cookie
            const cookieResult = await mdChrome.web.cmd({
                cmd: 'getCookie',
                url: 'https://compass.jinritemai.com'
            });
            const cookies = cookieResult.cookies || [];
            const filtered = filterCookies(cookies, true);
            const cookieStr = filtered.map(c => `${c.name}=${c.value}`).join('; ');

            // expire 取 sessionid 过期时间（秒转毫秒），默认30天
            const sessionCookie = filtered.find(c => c.name === 'sessionid');
            const expire = sessionCookie?.expirationDate
                ? Math.floor(sessionCookie.expirationDate) * 1000
                : Date.now() + 30 * 24 * 60 * 60 * 1000;

            const postRes = await mdChrome.web.cmd({
                cmd: "ajax",
                data: {
                    channel: 12,
                    userId: info.userId,
                    accountName: info.accountName,
                    value: cookieStr,
                    expire
                },
                method: "POST",
                headers: {
                    "Accept": "application/json, text/plain, */*",
                    "Content-Type": "application/json; charset=UTF-8",
                    "AccessToken": info.token
                },
                url: api + '/api/dy/store/cookie'
            });
            console.log('授权结果:', postRes);
            showToast('授权成功');
        } catch (error) {
            showToast('授权失败，请查看控制台');
            console.error('talent 授权失败:', error);
        }

    }
    // 处理 talent/product-rank 授权
    const handleTalentAuth = async () => {
        try {
            const { url, api } = await getEnvConfig();

            // 获取 token，不存在则跳转登录
            const tokenResult = await getToken();
            const token = tokenResult?.WinSupAccessToken;
            const res = await fetch("https://compass.jinritemai.com/ecomauth/loginv1/get_account_info?login_source=compass&_lid=205120534645&msToken=lrrEYQUlXinzN9PaLs6BAi2kIMq0GvxfypW8ITvImoEnkIAKmRE8oiFH7dIordmEvN9Wu0DQt5xefqcKcr4N7k0Fcek4Yhc_mpFaXftjKE5Kce-UpakJ-PCZGMbvEDxBwGlExjVYIP3IZ_9wZMYzHS2ge8lHk6VgW5DQvBx7s5UV4XtfPy9jT7o%3D&a_bogus=Qj05k7UiYN8RFpltucGreHIU5qjlrsWyUPTQSxMUHKxIP7MYjM-sSna%2FnoqqsmxvXmp8pC170nUAbddc8-Us1KHkumkfS04jr0Ann8mLM1HkaGJh7Nm0SJSEoiPY0SGYKQdbNBw1X0zy22c3iqc0W--GC5zc5OYDRNqSd20br9AGfA6PY1rfO2wAYfqbQbo--f%3D%3D&verifyFp=verify_mocmef75_T11axQlL_HuFZ_4i1a_9Zle_5GEGFrOKHOQ5&fp=verify_mocmef75_T11axQlL_HuFZ_4i1a_9Zle_5GEGFrOKHOQ5", {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"macOS\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin"
                },
                "referrer": "https://compass.jinritemai.com/talent/product-rank",
                "body": null,
                "method": "GET",
                "mode": "cors",
                "credentials": "include"
            });
            const data = await res.json();
            console.log('获取账号信息:', data);
            const info = {
                userId: data?.data.account_id,
                accountName: data?.data.account_name
            }
            // if (!token) {
            const href = url + 'manage/store-auth' + '?__AUTH_TYPE__=token';
            window.open(href, '_blank');
            mdChrome.web.once('getToken', ({ token }) => {
                AuthCallback({ token, ...info }, api);
                mdChrome.web.off('getToken')
            });
            return;
            // }



            AuthCallback({ token, ...info }, api);
        } catch (error) {
            showToast('授权失败，请查看控制台');
            console.error('talent 授权失败:', error);

        }
    };

    // 创建 talent/product-rank 悬浮授权按钮
    const createTalentFloatingButton = () => {
        if (document.getElementById('ldd-dy-talent-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'ldd-dy-talent-widget';
        widget.innerHTML = `
            <div style="text-align: center;">
                <div style="
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: #1a1a2e;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto;
                    font-size: 11px;
                    font-weight: bold;
                    line-height: 1;
                    letter-spacing: -0.5px;
                "><span style="color:#f5cf03;">Win</span><span style="color:#33b5ef;">Sup</span></div>
                <div style="font-size: 12px; color: #333; margin-top: 4px; white-space: nowrap;">Winsup授权</div>
            </div>
        `;

        Object.assign(widget.style, {
            position: 'fixed',
            top: '80px',
            right: '10px',
            width: 'auto',
            height: 'auto',
            zIndex: '9999',
            cursor: 'move',
            borderRadius: '8px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            transition: 'right 0.3s ease, left 0.3s ease',
            userSelect: 'none',
            background: '#fff',
            padding: '4px'
        });

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        widget.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = widget.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            widget.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const newLeft = startLeft + (e.clientX - startX);
            const newTop = startTop + (e.clientY - startY);
            widget.style.left = newLeft + 'px';
            widget.style.top = newTop + 'px';
            widget.style.right = 'auto';
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            const rect = widget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            widget.style.transition = 'right 0.3s ease, left 0.3s ease';
            if (centerX < window.innerWidth / 2) {
                widget.style.left = '10px';
                widget.style.right = 'auto';
            } else {
                widget.style.right = '10px';
                widget.style.left = 'auto';
            }
        });

        widget.addEventListener('click', async (e) => {
            if (Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5) {
                await handleTalentAuth();
            }
        });

        document.body.appendChild(widget);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (isTalentProductRankPage()) {
                createTalentFloatingButton();
            } else {
                createAuthButton();
            }
            // openAccountSelector();
            // checkShopIdAndClick();
        });
    } else {
        if (isTalentProductRankPage()) {
            createTalentFloatingButton();
        } else {
            createAuthButton();
        }
        // openAccountSelector();
        // checkShopIdAndClick();
    }

    const cookieWhitelist = new Set([
        "Hm_lvt_55b6f6890a6937842cef785d95ea99d7",
        "HMACCOUNT",
        "passport_csrf_token",
        "passport_csrf_token_default",
        "is_staff_user",
        "has_biz_token",
        "gfkadpd",
        "csrf_session_id",
        "s_v_web_id",
        "qc_tt_tag",
        "passport_mfa_token",
        "odin_tt",
        "passport_auth_status",
        "passport_auth_status_ss",
        "uid_tt",
        "uid_tt_ss",
        "sid_tt",
        "sessionid",
        "sessionid_ss",
        "ttwid",
        "Hm_lvt_b6520b076191ab4b36812da4c90f7a5e",
        "Hm_lpvt_b6520b076191ab4b36812da4c90f7a5e",
        "ucas_c0",
        "ucas_c0_ss",
        "PHPSESSID",
        "PHPSESSID_SS",
        "ecom_us_lt",
        "ecom_us_lt_ss",
        "ucas_c0_compass",
        "ucas_c0_ss_compass",
        "sid_guard",
        "session_tlb_tag",
        "sid_ucp_v1",
        "ssid_ucp_v1",
        "LUOPAN_DT",
        "COMPASS_LUOPAN_DT",
        "ecom_us_lt_compass",
        "ecom_us_lt_ss_compass"
    ])

    const filterCookies = (cookies = [], dedupe = false) => {
        const seen = new Set()
        return cookies.filter((c) => {
            if (!cookieWhitelist.has(c.name)) return false
            if (dedupe) {
                if (seen.has(c.name)) return false
                seen.add(c.name)
            }
            return true
        })
    }



    // const cookieAwait = ['.jinritemai.com'].map(origin => {
    //     return mdChrome.web.cmd({ cmd: 'getCookie', myDomain: origin });
    // });

    // const cookies = await Promise.all(cookieAwait);
    // const filtered = filterCookies(cookies[0].cookies);
    // const filteredStr = filtered.map((c) => `${c.name}=${c.value}`).join('; ');
    // console.log(filteredStr, 'filtered cookies');
}()