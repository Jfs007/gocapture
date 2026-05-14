!async function () {

    const href = location.href;
    const mdChrome = _require('mdChrome');
    const search = new URLSearchParams(window.location.search);
    let AUTH_REDIREURL = search.get('AUTH_REDIREURL');
    const redirectUrl = search.get('redirectUrl') || '';
    const search2patch = new URLSearchParams(redirectUrl.split("?")[1]);
    AUTH_REDIREURL = AUTH_REDIREURL || search2patch.get('AUTH_REDIREURL');
    if (AUTH_REDIREURL) {
        // console.log('HELLO KS');
        const res = await fetch('https://jinfu.e.kuaishou.com/rest/dsp/agent/infov2', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const result = await res.json();
        const redirectUrlSearch = ((AUTH_REDIREURL || '').replaceAll('@', '&').replace('&', '?'));
        const [_, agentId] = redirectUrlSearch.match(/agentId=(\d*)/) || [];
        try {

            const data = result?.data;
            if (!Array.isArray(data)) return;
            const agent = data.find(agent => agent.agentId == agentId) || {};
            if (href.indexOf('jinfu.e') > -1) {
                const rhref = `https://niu.e.kuaishou.com/` + (redirectUrlSearch.replace('AGENTUSERID', agent.agentUserId || ''));
                console.log('AUTH_REDIREURL', rhref);
                window.location.href = rhref;
            }
            // console.log('dsp/agent/extra/info', result);


        } catch (error) {
            console.error('agent.ks error', error);
        }

    }

    if (href.indexOf('https://niu.e.kuaishou.com/') > -1) {
        const checkUserType = async () => {
            try {
                const res = await fetch("https://niu.e.kuaishou.com/rest/esp/owner/info", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include"
                });
                const result = await res.json();
                // const accountUcId = result.data.userEspAccount?.accountUcId;
                const accountKsId = result.data.user?.userId;
                // const userName = result.data.user?.userName;
                const ksId = result.data.user?.visitorId;
                return accountKsId != ksId
            } catch (error) {
                console.error('检查用户类型失败:', error);
                return false;
            }
        };

        const isAgentUser = await checkUserType();

        const widget = document.createElement('div');
        widget.id = 'ldd-niu-auth-widget';

        const buttonText = isAgentUser ? '量多多快手授权' : '一键投放授权';

        widget.innerHTML = `
            <div style="text-align: center;">
                <img src="https://cdn.itaored.com/static/fed/ldd-pro-chrome-plugin/app/icon.png" 
                     alt="${buttonText}" 
                     referrerpolicy="no-referrer"
                     style="width: 28px; height: 28px; display: block; border-radius: 50%; margin: 0 auto;">
                <div style="font-size: 12px; color: #333; margin-top: 4px; white-space: nowrap;">${buttonText}</div>
            </div>
        `;

        Object.assign(widget.style, {
            position: 'fixed',
            top: '80px',
            right: '10px',
            width: 'auto',
            height: 'auto',
            zIndex: '9999',
            cursor: 'pointer',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            transition: 'right 0.3s ease, left 0.3s ease',
            userSelect: 'none',
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
                if (isAgentUser) {
                    mdChrome.web.send('ldd-niu-account-auth', {});
                } else {
                    await handleLaunch();
                }
            }
        });

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

        const showToast = (message, duration = 3000) => {
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
        };

        const showConfirmDialog = (userId, userName, pageType) => {
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

                const typeNameMap = { jinfu: '金服', uc: 'UC', agent: '代理商', launch: '一键投放' };
                const typeName = typeNameMap[pageType] || pageType;
                dialog.innerHTML = `
                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #333;">
                        确认${typeName}
                    </div>
                    <div style="font-size: 14px; color: #666; margin-bottom: 20px; line-height: 1.6;">
                        ${userId ? `<p style="margin: 4px 0;">用户ID：${userId}</p>` : ''}
                        ${userName ? `<p style="margin: 4px 0;">用户名称：${userName}</p>` : ''}
                        <p style="margin: 10px 0 0 0; color: #ff6b00;">确认执行${typeName}操作？</p>
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
                        ">确认</button>
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

                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        document.body.removeChild(overlay);
                        resolve(false);
                    }
                });
            });
        };

        const handleLaunchCallback = async (info = {}, api) => {
            try {
                const filteredCookie = await mdChrome.web.cmd({
                    cmd: 'getCookie',
                    url: 'https://niu.e.kuaishou.com/'
                });

                const params = {
                    value: filteredCookie.cookiesStr || '',
                    channel: 9,
                    accountCode: info.userId,
                    userId: info.ksId,
                    expire: Date.now() + 15 * 24 * 60 * 60 * 1000, // 15天后过期
                    // expire
                };
                console.log('params', params, info);

                const saveRes = await mdChrome.web.cmd({
                    cmd: "ajax",
                    data: params,
                    method: "POST",
                    headers: {
                        "Accept": "application/json, text/plain, */*",
                        "Content-Type": "application/json; charset=UTF-8",
                        "AccessToken": info.token
                    },
                    url: "api/dy/account/cookie"
                });
                if (saveRes?.result?.success) {
                    console.log('一键投放授权成功:', saveRes);
                    showToast('一键投放授权成功');
                } else {
                    console.error('一键投放授权失败:', saveRes);
                    showToast('一键投放授权失败:' + (saveRes?.result?.msg || '未知错误'));
                }
            } catch (error) {
                console.error('一键投放授权失败:', error);
                showToast('一键投放授权失败:' + error.message);
            }
        };

        const handleLaunch = async () => {
            try {
                const { url, api } = await getEnvConfig();

                const tokenResult = await getToken();
                const token = tokenResult?.WinSupAccessToken;

                const res = await fetch("https://niu.e.kuaishou.com/rest/esp/owner/info", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include"
                });

                const data = await res.json();

                if (!data.data) {
                    console.error('数据获取失败');
                    return;
                }

                const accountUcId = data.data.userEspAccount?.accountUcId;
                const accountKsId = data.data.user?.userId;
                const userName = data.data.user?.userName;
                const ksId = data.data.user?.visitorId;

                if (accountKsId != ksId) {
                    showToast('当前广告账户绑定的快手与登录用户快手id不一致，请切换账号登录');
                    console.error('账号不一致', { accountKsId, ksId });
                    return;
                }

                const info = {
                    userId: accountUcId,
                    userName: userName,
                    ksId: ksId
                };

                const confirmed = await showConfirmDialog(accountUcId, userName, 'launch');
                if (!confirmed) {
                    return;
                }

                const authUrl = url + 'manage/store-auth' + '?__AUTH_TYPE__=token';
                showToast('即将跳转winsup系统获取授权...');
                setTimeout(() => {

                    window.open(authUrl, '_blank');
                    mdChrome.web.once('getToken', ({ token }) => {
                        handleLaunchCallback({ token, ...info }, api);
                        mdChrome.web.off('getToken');
                    });

                }, 1000);

            } catch (error) {
                console.error('一键投放失败:', error);
                showToast('一键投放失败');
            }
        };

        document.body.appendChild(widget);
    }

    if (href.indexOf('niu.e') > -1) {
        try {
            const AUTH = search.get('LDD_NIU_AUTH');
            if (AUTH != 1) return;
            const xpath = `//*[@id="root"]/section/section/main/div/div[1]/div[2]/div[2]`;
            const btn = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue
            btn?.click()

        } catch (error) {

        }

    }


}()