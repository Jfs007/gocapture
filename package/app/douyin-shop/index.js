!async function() {
    const mdChrome = _require('mdChrome');
    
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
            '//*[@id="fxg-pc-header"]/div/div[2]',
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
            const events = await mdChrome.web.cmd({ cmd: 'event-list' });
            console.log(events, 'events');
            
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
                padding: 6px 12px;
                cursor: ${isActive ? 'pointer' : 'not-allowed'};
                opacity: ${isActive ? '1' : '0.6'};
                user-select: none;
                transition: all 0.2s;
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
        
        if (isActive) {
            authBtn.addEventListener('click', () => {
                const config = window.__SSR_CONFIG_ECOM_FXG_ADMIN;
                const user = config?.initialData['fxg-admin']?.userData?.user;
                mdChrome.web.send('winsup-douyin-shop-auth', { user });
            });
            
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
            checkShopIdAndClick();
        });
    } else {
        createAuthButton();
        checkShopIdAndClick();
    }

}()