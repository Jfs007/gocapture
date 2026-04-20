!async function () {
    const mdChrome = _require('mdChrome');
    const href = location.href;

    // 判断当前页面类型
    const getPageType = () => {
        if (href.indexOf('jinfu.e.kuaishou.com') > -1) {
            return 'jinfu';
        } else if (href.indexOf('uc.e.kuaishou.com/account/register') > -1) {
            return 'uc';
        } else if (href.indexOf('agent.e.kuaishou.com/account/list') > -1) {
            return 'agent';
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

    const AGENT_COOKIE_FILTER = [
        "account_id",
        "didv",
        "apdid",
        "weblogger_did",
        "_did",
        "did",
        "kwpsecproductname",
        "kwfv1",
        "hdige2wqwoino",
        "hdige3wqwoino",
        "ehid",
        "bUserId",
        "userId",
        "kuaishou.ad.login.identity",
        "kuaishou.ad.dsp.agent_st",
        "kuaishou.ad.dsp.agent_ph",
        "JSESSIONID"
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
        const isUrl = domain.startsWith('http');
        const result = await mdChrome.web.cmd({
            cmd: 'getCookie',
            myDomain: isUrl ? undefined : domain,
            url: isUrl ? domain : undefined
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
            showToast('授权成功');
            return res;
        } catch (error) {
            console.error('Cookie 提交失败:', error);
            throw error;
        }
    };

    // 处理 jinfu 类型
    const handleJinfu = async () => {
        try {
            // const cookie = await getCookie('.kuaishou.com');
            // const filteredCookie = filterCookie(cookie, JINFU_COOKIE_FILTER);
            const filteredCookie = await getCookie('https://jinfu.e.kuaishou.com');

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

            const agentId = data.data.adDspAgent?.agentId;
            const agentName = data.data.adDspAgent?.agentName;

            // 检查是否已授权
            // if (isAlreadyAuthorized(agentId, 'jinfu')) {
            //     showToast('该代理ID已授权，无需重复授权');
            //     return;
            // }

            // 二次确认
            const confirmed = await showConfirmDialog(agentId, agentName, 'jinfu');
            if (!confirmed) {
                // showToast('已取消授权');
                return;
            }

            const params = {
                qcCookie: filteredCookie,
                type: 3,
                agentId: agentId,
                agentName: agentName,
                userId: data.data.agentRole?.userId,
                parentAgentId: data.data.adDspAgent?.parentAgentId,
                referer: href
            };

            await saveCookie(params);

            // 保存授权记录
            // saveAuthorizedAgent(agentId, 'jinfu');
        } catch (error) {
            return Promise.reject(error);
        }
    };

    // 处理 uc 类型
    const handleUc = async () => {
        try {
            // const cookie = await getCookie('.kuaishou.com');
            // const filteredCookie = filterCookie(cookie, UC_COOKIE_FILTER);
             const filteredCookie = await getCookie('https://uc.e.kuaishou.com');

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

            const agentId = data.data.loginModel.agentId;

            // 检查是否已授权
            // if (isAlreadyAuthorized(agentId, 'uc')) {
            //     showToast('该代理ID已授权，无需重复授权');
            //     return;
            // }

            // 二次确认
            const confirmed = await showConfirmDialog(agentId, null, 'uc');
            if (!confirmed) {
                // showToast('已取消授权');
                return;
            }

            const params = {
                qcCookie: filteredCookie,
                type: 2,
                agentId: agentId,
                userId: data.data.loginModel.userId,
                referer: href
            };

            await saveCookie(params);

            // 保存授权记录
            // saveAuthorizedAgent(agentId, 'uc');
        } catch (error) {
            return Promise.reject(error);
        }
    };


    // 处理 agent 类型
    const handleAgent = async () => {
        try {
            // const gets = ['agent.e.kuaishou.com', '.kuaishou.com'].map(async _ => {
            //     return getCookie('.kuaishou.com')
            // })
            // const cookies = await Promise.all(gets);
            const filteredCookie = await getCookie('https://agent.e.kuaishou.com');
            // const cookie = cookies.flat().join(';');
            // console.log(cookie, 'cks');
            // const filteredCookie = filterCookie(cookie, AGENT_COOKIE_FILTER);

            const res = await fetch("https://agent.e.kuaishou.com/rest/dsp/agent/infov2", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include"
            });
            const data = await res.json();
            console.log("agent 返回数据:", data);

            if (!data.data) {
                console.error('agent 数据获取失败');
                return;
            }

            const agentId = data.data.adDspAgent?.agentId;
            const agentName = data.data.adDspAgent?.agentName;

            // 二次确认
            const confirmed = await showConfirmDialog(agentId, agentName, 'agent');
            if (!confirmed) {
                // showToast('已取消授权');
                return;
            }

            const params = {
                qcCookie: filteredCookie,
                type: 3,
                agentId: agentId,
                agentName: agentName,
                userId: data.data.agentRole?.userId,
                referer: href
            };

            await saveCookie(params);
        } catch (error) {
            return Promise.reject(error);
        }
    };

    // 二次确认弹窗
    const showConfirmDialog = (agentId, agentName, pageType) => {
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

            const typeNameMap = { jinfu: '金服', uc: 'UC', agent: '代理商' };
            const typeName = typeNameMap[pageType] || pageType;
            dialog.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #333;">
                    确认授权
                </div>
                <div style="font-size: 14px; color: #666; margin-bottom: 20px; line-height: 1.6;">
                    <p style="margin: 4px 0;">类型：${typeName}</p>
                    <p style="margin: 4px 0;">代理ID：${agentId}</p>
                    ${agentName ? `<p style="margin: 4px 0;">代理名称：${agentName}</p>` : ''}
                    <p style="margin: 10px 0 0 0; color: #ff6b00;">确认将此账号授权给量多多使用？</p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancel-btn" style="
                        padding: 8px 20px;
                        border: 1px solid #ddd;
                        background: #fff;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">取消</button>
                    <button id="confirm-btn" style="
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

            const cancelBtn = dialog.querySelector('#cancel-btn');
            const confirmBtn = dialog.querySelector('#confirm-btn');

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(false);
            });

            confirmBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(true);
            });

            // 点击遮罩层关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve(false);
                }
            });
        });
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
                    // showToast('正在获取 Cookie...');

                    if (pageType === 'jinfu') {
                        await handleJinfu();
                    } else if (pageType === 'uc') {
                        await handleUc();
                    } else if (pageType === 'agent') {
                        await handleAgent();
                    }

                    // showToast('Cookie 获取成功！');
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