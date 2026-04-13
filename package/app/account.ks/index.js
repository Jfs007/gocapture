!async function () {
    const mdChrome = _require('mdChrome');
    const href = location.href;

    // 判断当前页面类型
    const getPageType = () => {
        if (href.indexOf('jinfu.e.kuaishou.com') > -1) {
            return 'jinfu';
        } else if (href.indexOf('uc.e.kuaishou.com/account/register') > -1) {
            return 'uc';
        }
        return null;
    };

    // 需要过滤的 cookie 字段（jinfu 类型）
    const JINFU_COOKIE_FILTER = [
        "weblogger_did",
        "_did",
        "did",
        "apdid",
        "bUserId",
        "userId",
        "kuaishou.ad.login.identity",
        "Hm_lvt_b97569d26a525941d8d163729d284198",
        "Hm_lpvt_b97569d26a525941d8d163729d284198",
        "HMACCOUNT",
        "Hm_lvt_e8002ef3d9e0d8274b5b74cc4a027d08",
        "Hm_lpvt_e8002ef3d9e0d8274b5b74cc4a027d08",
        "kuaishou.ad.dsp.agent_st",
        "kuaishou.ad.dsp.agent_ph",
        "JSESSIONID"
    ];

    const UC_COOKIE_FILTER = [
        "JSESSIONID",
        "weblogger_did",
        "_did",
        "did",
        "apdid",
        "bUserId",
        "userId",
        "kuaishou.ad.bp_st",
        "kuaishou.ad.bp_ph",
        "client_key",
        "ad_bp_account_token",
        "kuaishou.ad.uc_st",
        "kuaishou.ad.uc_ph"
    ];

    // 过滤 cookie
    const filterCookie = (cookieStr, filterList) => {
        const cookies = cookieStr.split('; ');
        const filtered = cookies.filter(cookie => {
            const name = cookie.split('=')[0];
            return filterList.includes(name);
        });
        return filtered.join('; ');
    };

    // 获取完整 cookie
    const getCookie = async (domain) => {
        const result = await mdChrome.web.cmd({
            cmd: 'getCookie',
            myDomain: domain
        });
        return result.cookiesStr || '';
    };

    // 提交 cookie 到服务器
    const saveCookie = async (params) => {
        try {
            const res = await mdChrome.web.cmd({
                cmd: "ajax",
                data: (params),
                method: "POST",
                headers: {
                    "Accept": "application/json, text/plain, */*",
                    "Content-Type": "application/json; charset=UTF-8"
                },
                url: "api/iu/ks/saveCookie"
            });
            console.log('Cookie 提交成功:', res);
            return res;
        } catch (error) {
            console.error('Cookie 提交失败:', error);
            throw error;
        }
    };

    // 处理 jinfu 类型
    const handleJinfu = async () => {
        try {
            const cookie = await getCookie('.kuaishou.com');
            const filteredCookie = filterCookie(cookie, JINFU_COOKIE_FILTER);

            const res = await fetch("https://jinfu.e.kuaishou.com/rest/dsp/agent/infov2", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include"
            });
            const data = await res.json();
            console.log("jinfu 返回数据:", data);

            if (!data.data) {
                console.error('jinfu 数据获取失败');
                return;
            }

            const params = {
                qcCookie: filteredCookie,
                type: 3,
                agentId: data.data.adDspAgent?.agentId,
                agentName: data.data.adDspAgent?.agentName,
                userId: data.data.agentRole?.userId,
                parentAgentId: data.data.adDspAgent?.parentAgentId,
                referer: href
            };

            await saveCookie(params);
        } catch (error) {
            return Promise.reject(error);
            console.error('handleJinfu 错误:', error);
        }
    };

    // 处理 uc 类型
    const handleUc = async () => {
        try {
            const cookie = await getCookie('.kuaishou.com');
            const filteredCookie = filterCookie(cookie, UC_COOKIE_FILTER);

            const res = await fetch("https://uc.e.kuaishou.com/rest/customer/common/ad-info", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    queryCommonInfoTypeList: ["LOGIN_MODEL"]
                }),
                credentials: "include"
            });
            const data = await res.json();
            console.log("uc 返回数据:", data);

            if (!data.data?.loginModel) {
                console.error('uc 数据获取失败');
                return;
            }

            const params = {
                qcCookie: filteredCookie,
                type: 2,
                agentId: data.data.loginModel.agentId,
                userId: data.data.loginModel.userId,
                referer: href
            };

            await saveCookie(params);
        } catch (error) {
            return Promise.reject(error);
            console.error('handleUc 错误:', error);
        }
    };

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

    // 创建悬浮按钮
    const createFloatingButton = () => {
        const pageType = getPageType();
        if (!pageType) return;

        const widget = document.createElement('div');
        widget.id = 'ldd-ks-cookie-widget';
        widget.innerHTML = `
            <div style="text-align: center;">
                <img src="https://cdn.itaored.com/static/fed/testldd-pro-chrome-plugin/app/icon.png" 
                     alt="量多多授权" 
                     referrerpolicy="no-referrer"
                     style="width: 28px; height: 28px; display: block; border-radius: 50%; margin: 0 auto;">
                <div style="font-size: 12px; color: #333; margin-top: 4px; white-space: nowrap;">量多多账号授权</div>
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

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;

            widget.style.left = newLeft + 'px';
            widget.style.top = newTop + 'px';
            widget.style.right = 'auto';
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;

            const rect = widget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const windowWidth = window.innerWidth;

            widget.style.transition = 'right 0.3s ease, left 0.3s ease';

            if (centerX < windowWidth / 2) {
                widget.style.left = '10px';
                widget.style.right = 'auto';
            } else {
                widget.style.right = '10px';
                widget.style.left = 'auto';
            }
        });

        widget.addEventListener('click', async (e) => {
            if (Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5) {
                try {
                    showToast('正在获取 Cookie...');
                    
                    if (pageType === 'jinfu') {
                        await handleJinfu();
                    } else if (pageType === 'uc') {
                        await handleUc();
                    }
                    
                    showToast('Cookie 获取成功！');
                } catch (error) {
                    showToast('Cookie 获取失败，请查看控制台');
                    console.error('获取 Cookie 失败:', error);
                }
            }
        });

        document.body.appendChild(widget);
    };

    // 主逻辑
    const init = async () => {
        const pageType = getPageType();
        console.log('当前页面类型:', pageType);

        if (!pageType) {
            console.log('不在支持的页面范围内');
            return;
        }

        // 等待页面加载完成
        await new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });

        // 创建悬浮按钮
        createFloatingButton();
    };

    init();
}()