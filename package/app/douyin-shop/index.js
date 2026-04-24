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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createAuthButton();
            // openAccountSelector();
            // checkShopIdAndClick();
        });
    } else {
        createAuthButton();
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