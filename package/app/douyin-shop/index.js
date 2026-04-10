!async function () {
    const mdChrome = _require('mdChrome');

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
                mdChrome.web.send('winsup-douyin-shop-auth', { user: {
                    ...user,
                    shop_name: user.account_name
                } });
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createAuthButton();
            // checkShopIdAndClick();
        });
    } else {
        createAuthButton();
        // checkShopIdAndClick();
    }

}()