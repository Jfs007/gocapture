

!function () {
    const mdChrome = _require('mdChrome');
    /**
 * 创建可拖拽、可收起的容器包裹器
 * @param {HTMLElement|string} target - 目标元素或选择器
 * @param {Object} options - 配置选项
 * @returns {Object} 包含控制方法的对象
 */
    function createDraggableCollapsibleWrapper(target, options = {}) {
        const element = typeof target === 'string' ? document.querySelector(target) : target;
        if (!element) {
            console.error('目标元素不存在');
            return null;
        }
        const config = {
            width: options.width || '604px',
            height: options.height || '590px',
            collapsedHeight: options.collapsedHeight || '40px',
            position: options.position || { top: '20px', right: '20px' },
            toggleBtnWidth: options.toggleBtnWidth || '30px',
            toggleBtnHeight: options.toggleBtnHeight || '40px',
            ...options
        };

        // 创建容器
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: ${config.position.top};
            right: ${config.position.right};
            z-index: 9999;
            display: flex;
            flex-direction: column;
            border: 1px solid #3777FF;
            border-radius: 10px;
            background: white;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            overflow: hidden;
        `;

        // 创建顶部 bar（拖拽区）
        const bar = document.createElement('div');
        bar.className = 'draggable-bar';
        bar.style.cssText = `
            position: relative;
            width: 100%;
            height: 32px;
            background: rgba(102, 126, 234, 0.1);
            flex-shrink: 0;
            display: flex;
            align-items: center;
            padding: 0 12px;
            cursor: move;
            transition: background 0.2s ease;
        `;

        bar.innerHTML = '线索采集器(拖动到边缘自动吸附)';

        bar.addEventListener('mouseenter', () => {
            bar.style.background = 'rgba(102, 126, 234, 0.2)';
        });

        bar.addEventListener('mouseleave', () => {
            bar.style.background = 'rgba(102, 126, 234, 0.1)';
        });

        // 创建 iframe 包裹器
        const iframeWrapper = document.createElement('div');
        iframeWrapper.style.cssText = `
            overflow: hidden;
            background: white;
            width: ${config.width};
            height: ${config.height};
        `;

        // 将目标元素移入 iframe 包裹器
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.border = 'none';
        iframeWrapper.appendChild(element);

        // 创建吸边条（隐藏时显示）
        const edgeBar = document.createElement('div');
        edgeBar.style.cssText = `
            position: fixed;
            right: 0;
            top: 20%;
            transform: translateY(-50%);
            width: 20px;
            height: 60px;
            background: rgba(102, 126, 234, 0.8);
            border-radius: 4px 0 0 4px;
            cursor: pointer;
            z-index: 9998;
            display: none;
            transition: all 0.2s ease;
        `;

        // 创建三角形指示器
        const triangle = document.createElement('div');
        triangle.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 0;
            height: 0;
            border-top: 6px solid transparent;
            border-bottom: 6px solid transparent;
            border-right: 6px solid white;
            transition: all 0.2s ease;
        `;
        edgeBar.appendChild(triangle);

        edgeBar.addEventListener('mouseenter', () => {
            edgeBar.style.width = '24px';
            edgeBar.style.background = 'rgba(102, 126, 234, 1)';
            triangle.style.borderRightWidth = '8px';
        });

        edgeBar.addEventListener('mouseleave', () => {
            edgeBar.style.width = '20px';
            edgeBar.style.background = 'rgba(102, 126, 234, 0.8)';
            triangle.style.borderRightWidth = '6px';
        });

        // 组装容器
        container.appendChild(bar);
        container.appendChild(iframeWrapper);
        document.body.appendChild(container);
        document.body.appendChild(edgeBar);



        // 拖拽功能和自动吸边
        let isDragging = false;
        let isHidden = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let containerStartX = 0;
        let containerStartY = 0;
        const edgeThreshold = 10; // 靠近右边缘多少像素时吸附

        const startDrag = (e) => {
            if (isHidden) return;

            isDragging = true;
            element.style.pointerEvents = 'none';
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            // 获取容器当前位置
            const rect = container.getBoundingClientRect();
            containerStartX = rect.left;
            containerStartY = rect.top;

            // 添加拖拽样式
            bar.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';

            e.preventDefault();
            e.stopPropagation();
        };
        const hideMargin = 4;
        const doDrag = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            // 计算移动距离
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;

            // 计算新位置
            let newX = containerStartX + deltaX;
            let newY = containerStartY + deltaY;

            // 边界限制
            const rect = container.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;

            // 吸附边缘
            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX > maxX) newX = maxX;
            if (newY > maxY) newY = maxY;

            // 应用新位置
            container.style.left = newX + 'px';
            container.style.top = newY + 'px';
            container.style.right = 'auto';
            container.style.bottom = 'auto';
        };

        const defaultConfig = JSON.parse(localStorage.getItem('LDD_WRAPPER_CONFIG') || '{}');

        const hideToEdge = () => {
            isHidden = true;
            container.style.transition = 'all 0.3s ease';
            container.style.right = `-${parseInt(config.width) - hideMargin}px`;
            container.style.left = 'auto';
            edgeBar.style.display = 'block';
            edgeBar.style.right = `${hideMargin}px`;
            edgeBar.style.top = parseInt(container.style.top) + 200 + 'px';
            defaultConfig.packUp = 1;
            localStorage.setItem('LDD_WRAPPER_CONFIG', JSON.stringify(defaultConfig));

            setTimeout(() => {
                container.style.transition = '';
            }, 300);
        };

        const showFromEdge = () => {
            isHidden = false;
            container.style.transition = 'all 0.3s ease';
            container.style.right = '20px';
            container.style.left = 'auto';
            edgeBar.style.display = 'none';
            defaultConfig.packUp = 0;
            localStorage.setItem('LDD_WRAPPER_CONFIG', JSON.stringify(defaultConfig));


            setTimeout(() => {
                container.style.transition = '';
            }, 300);
        };



        if (defaultConfig.packUp == 1) {
            hideToEdge();
        };

        const stopDrag = (e) => {
            if (isDragging) {
                isDragging = false;
                bar.style.cursor = 'move';
                document.body.style.userSelect = '';
                element.style.pointerEvents = 'auto';

                // 检查是否靠近右边缘
                const rect = container.getBoundingClientRect();
                const distanceToRight = window.innerWidth - rect.right;

                if (distanceToRight < edgeThreshold) {
                    hideToEdge();
                }

                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };

        // 在 bar 上监听鼠标按下
        bar.addEventListener('mousedown', startDrag);

        // 点击吸边条恢复显示
        edgeBar.addEventListener('click', showFromEdge);

        // 全局监听移动和释放
        const handleMouseMove = (e) => {
            if (isDragging) {
                doDrag(e);
            }
        };

        const handleMouseUp = (e) => {
            stopDrag(e);
        };

        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('mouseup', handleMouseUp, true);

        // 防止拖拽时选中文本
        document.addEventListener('selectstart', (e) => {
            if (isDragging) e.preventDefault();
        });

        return {
            container,
            hide: hideToEdge,
            show: showFromEdge,
            destroy: () => {
                document.removeEventListener('mousemove', handleMouseMove, true);
                document.removeEventListener('mouseup', handleMouseUp, true);
                container.remove();
                edgeBar.remove();
            }
        };
    };

    mdChrome.web.common = {
        createDraggableCollapsibleWrapper
    }

}()