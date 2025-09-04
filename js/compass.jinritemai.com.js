!function () {
    // Compass 抖音商家平台 - 商品视频带货数据拦截
    const mdChrome = _require('mdChrome');
    const { reactive, h, defineComponent, ref, computed,  } = _require('Vue3');
    const NaiveUi = _require('NaiveUi');
    const { App } = _require('MdUiComponent');
    
    mdChrome.web.injectScript('hack_scripts/web-request.js');
    
    // 加载压缩库
    mdChrome.web.injectScript('other/jszip.min.js');
    mdChrome.web.injectScript('other/FileSaver.js');
    
    const videoInfos = reactive({});
    
    // 存储商品信息，用于显示商品名称
    window.__PRODUCT_INFO__ = window.__PRODUCT_INFO__ || {};
    
    // API拦截配置
    const api_hook = {
        'shop/product/product_rank/video_bring_good': (res) => {
            const list = res?.result?.data?.data_result || [];
            list.map(item => {
                const goodsId = item.product_info.id;
                videoInfos[goodsId] = item.video_list || [];
                // 存储商品信息
                window.__PRODUCT_INFO__[goodsId] = item.product_info;
            })
            console.log('📊 视频数据更新:', videoInfos);
        },
    };

    // 监听web-request响应
    window.addEventListener('message', function (event) {
        const { type, data } = event.data;
        if (type === 'WEB_REQUEST_RESPONSE') {
            const url = data ? data.url : '';
            const matchUrl = Object.keys(api_hook).find(pattern => {
                return url.indexOf(pattern) > -1;
            });
            if (matchUrl) {
                const hook = api_hook[matchUrl];
                if (hook) {
                    hook(data);
                }
            }
        }
    });

    // 悬浮工具箱组件
    const FloatingToolbox = defineComponent({
        setup() {
            // const dialog = NaiveUi.useDialog();
            const showModal = ref(false);
            const showSettingsModal = ref(false);
            const isDragging = ref(false);
            const position = ref({ x: window.innerWidth - 200, y: 100 });
            
            // 选中的视频ID集合
            const selectedVideos = ref(new Set());
            
            // 下载进度状态
            const downloadProgress = ref({
                isDownloading: false,
                current: 0,
                total: 0,
                currentFileName: '',
                percentage: 0
            });
            
            // 性能配置
            const performanceConfig = ref({
                concurrentLimit: 3, // 并发下载数量
                batchDelay: 100,    // 批次间延迟(ms)
                compressionLevel: 1 // 压缩级别 1-9 (1最快,9最小)
            });
            
            // 按商品分组的视频数据
            const groupedVideos = computed(() => {
                const groups = [];
                Object.entries(videoInfos).forEach(([goodsId, videoList]) => {
                    // 查找商品信息（从第一个视频的接口数据中获取）
                    const productInfo = window.__PRODUCT_INFO__?.[goodsId] || {};
                    
                    const videos = videoList.map(video => {
                        const videoUrl = video.video_play_url 
                            ? video.video_play_url 
                            : `https://www.douyin.com/video/${video.video_id}`;
                        
                        return {
                            goodsId,
                            ...video,
                            video_url: videoUrl,
                            has_play_url: !!video.video_play_url
                        };
                    });
                    
                    groups.push({
                        goodsId,
                        productName: productInfo.name || `商品 ${goodsId}`,
                        videos
                    });
                });
                return groups;
            });

            // 所有视频的扁平数组（用于统计）
            const allVideos = computed(() => {
                const videos = [];
                groupedVideos.value.forEach(group => {
                    videos.push(...group.videos);
                });
                return videos;
            });

            const handleGetVideos = () => {
                console.log('openVideos')
                showModal.value = true;
            };

            // 选择相关方法
            const isVideoSelected = (videoId) => {
                return selectedVideos.value.has(videoId);
            };

            const toggleVideoSelection = (videoId) => {
                const newSet = new Set(selectedVideos.value);
                if (newSet.has(videoId)) {
                    newSet.delete(videoId);
                } else {
                    newSet.add(videoId);
                }
                selectedVideos.value = newSet;
            };

            const toggleAllSelection = () => {
                const allVideoIds = allVideos.value.filter(v => v.has_play_url).map(v => v.video_id)
                if (selectedVideos.value.size === allVideoIds.length) {
                    // 全部取消选择
                    selectedVideos.value = new Set();
                } else {
                    // 全部选择
                    selectedVideos.value = new Set(allVideoIds);
                }
            };

            const selectedCount = computed(() => selectedVideos.value.size);

            // 使用fetch下载单个视频
            const downloadVideoFile = async (video) => {
                try {
                    console.log(`📥 开始下载视频: ${video.video_id}`);
                    
                    // 使用fetch获取视频文件
                    const response = await fetch(video.video_play_url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    // 获取文件blob
                    const blob = await response.blob();
                    
                    // 创建下载链接
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${video.author_name || 'unknown'}_${video.video_id}.mp4`;
                    link.style.display = 'none';
                    
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    // 清理blob URL
                    setTimeout(() => window.URL.revokeObjectURL(url), 100);
                    
                    console.log(`✅ 下载完成: ${video.video_id}`);
                    return true;
                } catch (error) {
                    console.error(`❌ 下载失败: ${video.video_id}`, error);
                    return false;
                }
            };

            // 下载选中视频（压缩包模式）
            const handleDownloadSelected = async () => {
                const selectedVideoData = allVideos.value.filter(video => 
                    selectedVideos.value.has(video.video_id) && video.has_play_url
                );
                
                if (selectedVideoData.length === 0) {
                    window.$message?.warning('请先选择可下载的视频');
                    return;
                }

                // 初始化进度状态
                downloadProgress.value = {
                    isDownloading: true,
                    current: 0,
                    total: selectedVideoData.length,
                    currentFileName: '准备下载...',
                    percentage: 0
                };

                console.log(`🗜️ 开始创建包含 ${selectedVideoData.length} 个视频的压缩包...`);

                try {
                    // 等待JSZip库加载
                    while (!window.JSZip) {
                        console.log('⏳ 等待JSZip库加载...');
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    const zip = new JSZip();
                    let successCount = 0;
                    let failCount = 0;
                    let completedCount = 0;

                    // 并发下载配置 - 使用可配置参数
                    const CONCURRENT_LIMIT = performanceConfig.value.concurrentLimit;
                    
                    // 创建下载任务
                    const downloadFile = async (video, index) => {
                        const fileName = `${video.author_name || 'unknown'}_${video.video_id}.mp4`.replace(/[/\\:*?"<>|]/g, '_');
                        
                        try {
                            console.log(`📥 开始下载: ${fileName}`);
                            
                            // 获取视频文件
                            const response = await fetch(video.video_play_url);
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            
                            const blob = await response.blob();
                            
                            // 获取商品信息，创建文件夹结构
                            const productInfo = window.__PRODUCT_INFO__[video.goodsId];
                            const productName = productInfo?.name?.replace(/[/\\:*?"<>|]/g, '_') || `商品_${video.goodsId}`;
                            
                            // 添加到压缩包中，按商品分文件夹
                            zip.folder(productName).file(fileName, blob);
                            
                            successCount++;
                            console.log(`✅ 完成下载: ${fileName}`);
                            return { success: true, fileName, video };
                            
                        } catch (error) {
                            console.error(`❌ 下载失败: ${video.video_id}`, error);
                            failCount++;
                            return { success: false, fileName, video, error };
                        } finally {
                            completedCount++;
                            
                            // 更新进度状态
                            downloadProgress.value = {
                                ...downloadProgress.value,
                                current: completedCount,
                                currentFileName: fileName,
                                percentage: Math.round((completedCount / selectedVideoData.length) * 90) // 预留10%给压缩
                            };
                        }
                    };

                    // 分批并发下载
                    console.log(`📦 开始并发下载 ${selectedVideoData.length} 个文件，并发数: ${CONCURRENT_LIMIT}`);
                    
                    for (let i = 0; i < selectedVideoData.length; i += CONCURRENT_LIMIT) {
                        const batch = selectedVideoData.slice(i, i + CONCURRENT_LIMIT);
                        const batchPromises = batch.map((video, batchIndex) => 
                            downloadFile(video, i + batchIndex)
                        );
                        
                        // 等待当前批次完成
                        await Promise.all(batchPromises);
                        
                        console.log(`📊 完成批次 ${Math.floor(i / CONCURRENT_LIMIT) + 1}/${Math.ceil(selectedVideoData.length / CONCURRENT_LIMIT)}`);
                        
                        // 批次间延迟，避免过于激进
                        if (i + CONCURRENT_LIMIT < selectedVideoData.length) {
                            await new Promise(resolve => setTimeout(resolve, performanceConfig.value.batchDelay));
                        }
                    }

                    if (successCount > 0) {
                        // 更新进度：生成压缩包
                        downloadProgress.value = {
                            ...downloadProgress.value,
                            currentFileName: '正在生成压缩包...',
                            percentage: 95
                        };
                        
                        console.log('📦 正在生成压缩包...');
                        
                        // 优化压缩设置：使用可配置的压缩级别
                        const content = await zip.generateAsync({
                            type: "blob",
                            compression: "DEFLATE",
                            compressionOptions: {
                                level: performanceConfig.value.compressionLevel // 可配置压缩级别
                            }
                        });
                        
                        // 使用FileSaver下载
                        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                        const filename = `商品视频_${successCount}个_${timestamp}.zip`;
                        
                        // 等待FileSaver库加载
                        while (!window.saveAs) {
                            console.log('⏳ 等待FileSaver库加载...');
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        
                        window.saveAs(content, filename);
                        
                        // 完成下载
                        downloadProgress.value = {
                            ...downloadProgress.value,
                            currentFileName: '下载完成！',
                            percentage: 100
                        };
                        
                        console.log(`🎉 压缩包下载完成！成功: ${successCount}, 失败: ${failCount}`);
                        window.$message?.success(`压缩包下载完成！包含 ${successCount} 个视频`);
                        
                        // 延迟重置状态
                        setTimeout(() => {
                            downloadProgress.value.isDownloading = false;
                        }, 2000);
                    } else {
                        window.$message?.error('没有成功下载任何视频');
                        downloadProgress.value.isDownloading = false;
                    }
                    
                } catch (error) {
                    console.error('❌ 创建压缩包失败:', error);
                    window.$message?.error('创建压缩包失败，请重试');
                    downloadProgress.value.isDownloading = false;
                }
            };

            // 拖拽功能
            const handleMouseDown = (e) => {
                isDragging.value = true;
                const startX = e.clientX - position.value.x;
                const startY = e.clientY - position.value.y;

                const handleMouseMove = (e) => {
                    if (isDragging.value) {
                        position.value = {
                            x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - startX)),
                            y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - startY))
                        };
                    }
                };

                const handleMouseUp = () => {
                    isDragging.value = false;
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            };

            // 导出CSV功能
            const handleExportCSV = () => {
                const videos = allVideos.value;
                if (videos.length === 0) {
                    window.$message?.warning('暂无视频数据可导出');
                    return;
                }

                const headers = ['商品ID', '视频ID', '视频标题', '作者', '作者ID', '发布时间', '视频链接', '原视频链接', '视频类型', '视频封面'];
                const rows = videos.map(video => [
                    video.goodsId || '',
                    video.video_id || '',
                    video.video_name || video.title || '',
                    video.author_name || '',
                    video.author_id || '',
                    video.publish_ts ? new Date(video.publish_ts * 1000).toLocaleString('zh-CN') : '',
                    video.video_url || '',
                    `https://www.douyin.com/video/${video.video_id}`,
                    video.has_play_url ? '可播放' : '跳转链接',
                    video.video_img || ''
                ]);

                // 使用CU工具导出
                if (window.CU && window.CU.ExportToCSV) {
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    window.CU.ExportToCSV(`商品视频数据_${timestamp}.csv`, [headers, ...rows]);
                    window.$message?.success(`导出成功：${videos.length}条数据`);
                } else {
                    window.$message?.error('导出功能不可用');
                }
            };

            return () => h('div', [
                // 悬浮工具箱
                h('div', {
                    style: {
                        position: 'fixed',
                        left: position.value.x + 'px',
                        top: position.value.y + 'px',
                        width: '180px',
                        backgroundColor: '#fff',
                        border: '1px solid #d9d9d9',
                        borderRadius: '6px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        zIndex: 9999,
                        padding: '12px',
                        cursor: isDragging.value ? 'grabbing' : 'grab',
                        pointerEvents: 'auto'
                    },
                    onMousedown: handleMouseDown
                }, [
                    h('div', {
                        style: {
                            fontSize: '14px',
                            fontWeight: 'bold',
                            marginBottom: '10px',
                            color: '#333',
                            textAlign: 'center'
                        }
                    }, '视频数据工具'),
                    
                    h('div', {
                        onMousedown: (e) => e.stopPropagation()
                    }, [
                        h(NaiveUi.NSpace, {
                            vertical: true,
                            size: 'small'
                        }, {
                            default: () => [
                                h(NaiveUi.NButton, {
                                    type: 'primary',
                                    size: 'small',
                                    block: true,
                                    onClick: handleGetVideos
                                }, { default: () => `获取当前视频 (${allVideos.value.length})` }),
                                
                                h(NaiveUi.NButton, {
                                    type: 'default',
                                    size: 'small',
                                    block: true,
                                    onClick: handleExportCSV,
                                    disabled: allVideos.value.length === 0
                                }, { default: () => '导出CSV' }),

                                h(NaiveUi.NButton, {
                                    type: 'success',
                                    size: 'small',
                                    block: true,
                                    loading: downloadProgress.value.isDownloading,
                                    onClick: handleDownloadSelected,
                                    disabled: selectedCount.value === 0 || downloadProgress.value.isDownloading
                                }, { 
                                    default: () => downloadProgress.value.isDownloading 
                                        ? `下载中 (${downloadProgress.value.current}/${downloadProgress.value.total})`
                                        : `打包下载 (${selectedCount.value})`
                                }),

                                h(NaiveUi.NButton, {
                                    type: 'default',
                                    size: 'small',
                                    block: true,
                                    onClick: () => showSettingsModal.value = true
                                }, { default: () => '⚙️ 设置' })
                            ]
                        })
                    ])
                ]),

                // 视频展示弹窗
                h(NaiveUi.NModal, {
                    show: showModal.value,
                    'onUpdate:show': (val) => { showModal.value = val; },
                    preset: 'dialog',
                    title: '商品视频数据',
                    style: { width: '90%', maxWidth: '1400px' }
                }, {
                    default: () => h('div', {
                        style: { maxHeight: '700px', overflowY: 'auto' }
                    }, [
                        // 操作栏
                        h('div', {
                            style: { marginBottom: '16px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px' }
                        }, [
                            h(NaiveUi.NSpace, { justify: 'space-between', align: 'center' }, {
                                default: () => [
                                    h('span', `共 ${allVideos.value.length} 个视频`),
                                    h(NaiveUi.NSpace, { size: 'small' }, {
                                        default: () => [
                                            h(NaiveUi.NCheckbox, {
                                                checked: selectedCount.value === allVideos.value.length && allVideos.value.length > 0,
                                                indeterminate: selectedCount.value > 0 && selectedCount.value < allVideos.value.length,
                                                onUpdateChecked: toggleAllSelection
                                            }, { default: () => `全选 (${selectedCount.value}/${allVideos.value.length})` }),
                                            // h('span', `(${selectedCount.value}/${allVideos.value.length})`),
                                            h(NaiveUi.NButton, {
                                                type: 'primary',
                                                size: 'small',
                                                loading: downloadProgress.value.isDownloading,
                                                onClick: handleDownloadSelected,
                                                disabled: selectedCount.value === 0 || downloadProgress.value.isDownloading
                                            }, { 
                                                default: () => downloadProgress.value.isDownloading 
                                                    ? `下载中 (${downloadProgress.value.current}/${downloadProgress.value.total})`
                                                    : `打包下载 (${selectedCount.value})`
                                            })
                                        ]
                                    })
                                ]
                            }),
                            
                            // 下载进度条
                            downloadProgress.value.isDownloading ? h('div', {
                                style: { marginTop: '12px' }
                            }, [
                                h('div', {
                                    style: { 
                                        fontSize: '12px', 
                                        color: '#666', 
                                        marginBottom: '4px',
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                    }
                                }, [
                                    h('span', downloadProgress.value.currentFileName),
                                    h('span', `${downloadProgress.value.percentage}%`)
                                ]),
                                h(NaiveUi.NProgress, {
                                    type: 'line',
                                    status: downloadProgress.value.percentage === 100 ? 'success' : 'info',
                                    percentage: downloadProgress.value.percentage,
                                    showIndicator: false
                                })
                            ]) : null
                        ]),

                        // 视频内容
                        groupedVideos.value.length === 0 
                            ? h('div', {
                                style: { textAlign: 'center', padding: '60px', color: '#999' }
                            }, '暂无视频数据，请先访问商品视频页面')
                            : h(NaiveUi.NSpace, { 
                                vertical: true, 
                                size: 'medium',
                                style: { width: '100%' }
                            }, {
                                default: () => groupedVideos.value.map(group => 
                                    h('div', { key: group.goodsId }, [
                                        // 商品名称标题
                                        h('div', {
                                            style: { 
                                                fontSize: '15px', 
                                                fontWeight: 'bold', 
                                                marginBottom: '8px',
                                                paddingBottom: '6px',
                                                borderBottom: '1px solid #e8e8e8',
                                                color: '#333'
                                            }
                                        }, `📦 ${group.productName} (${group.videos.length}个视频)`),
                                        
                                        // 视频卡片网格
                                        group.videos.length === 0 
                                            ? h('div', {
                                                style: { 
                                                    textAlign: 'center', 
                                                    padding: '40px', 
                                                    color: '#999',
                                                    border: '2px dashed #d9d9d9',
                                                    borderRadius: '8px'
                                                }
                                            }, [
                                                h('div', '暂无视频'),
                                                h(NaiveUi.NButton, {
                                                    type: 'link',
                                                    size: 'small',
                                                    onClick: () => window.open('https://www.douyin.com', '_blank')
                                                }, { default: () => '访问抖音查看' })
                                            ])
                                            : h('div', {
                                                style: { 
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                                    gap: '6px'
                                                }
                                            }, group.videos.map(video => 
                                                h(NaiveUi.NCard, {
                                                    key: video.video_id,
                                                    hoverable: true,
                                                    style: { 
                                                        cursor: 'pointer',
                                                        border: isVideoSelected(video.video_id) ? '2px solid #1890ff' : '1px solid #e8e8e8'
                                                    }
                                                }, {
                                                    default: () => h('div', {
                                                        // onClick: () => video.has_play_url && toggleVideoSelection(video.video_id),
                                                        style: { opacity: video.has_play_url ? 1 : 0.6 }
                                                    }, [
                                                        // 视频封面和选择框
                                                        h('div', {
                                                            style: { position: 'relative', marginBottom: '8px' }
                                                        }, [
                                                            // 视频封面
                                                            video.video_img ? h('img', {
                                                                src: video.video_img,
                                                                style: { 
                                                                    width: '100%', 
                                                                    height: '90px', 
                                                                    objectFit: 'cover',
                                                                    borderRadius: '4px'
                                                                }
                                                            }) : h('div', {
                                                                style: { 
                                                                    width: '100%', 
                                                                    height: '90px', 
                                                                    backgroundColor: '#f5f5f5',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    borderRadius: '4px',
                                                                    color: '#999'
                                                                }
                                                            }, '无封面'),
                                                            
                                                            // 选择框
                                                            h('div', {
                                                                style: { 
                                                                    position: 'absolute', 
                                                                    top: '8px', 
                                                                    left: '8px' 
                                                                }
                                                            }, [
                                                                h(NaiveUi.NCheckbox, {
                                                                    checked: isVideoSelected(video.video_id),
                                                                    disabled: !video.has_play_url,
                                                                    onUpdateChecked: () => toggleVideoSelection(video.video_id)
                                                                })
                                                            ]),

                                                            // 视频类型标签
                                                            h('div', {
                                                                style: { 
                                                                    position: 'absolute', 
                                                                    top: '8px', 
                                                                    right: '8px',
                                                                    padding: '4px 8px',
                                                                    backgroundColor: video.has_play_url ? '#52c41a' : '#1890ff',
                                                                    color: 'white',
                                                                    borderRadius: '4px',
                                                                    fontSize: '12px'
                                                                }
                                                            }, video.has_play_url ? '可下载' : '仅链接')
                                                        ]),
                                                        
                                                        // 视频信息
                                                        h('div', [
                                                            h('div', {
                                                                style: { 
                                                                    fontSize: '12px', 
                                                                    fontWeight: '500', 
                                                                    marginBottom: '6px',
                                                                    lineHeight: '1.3',
                                                                    display: '-webkit-box',
                                                                    webkitLineClamp: 2,
                                                                    webkitBoxOrient: 'vertical',
                                                                    overflow: 'hidden'
                                                                }
                                                            }, video.video_name || '无标题'),
                                                            
                                                            h(NaiveUi.NSpace, { size: 'small', wrap: false }, {
                                                                default: () => [
                                                                    h('span', {
                                                                        style: { fontSize: '11px', color: '#666' }
                                                                    }, `👤 ${video.author_name || '未知作者'}`),
                                                                    
                                                                    video.publish_ts ? h('span', {
                                                                        style: { fontSize: '11px', color: '#666' }
                                                                    }, `🕒 ${new Date(video.publish_ts * 1000).toLocaleDateString('zh-CN')}`) : null
                                                                ]
                                                            })
                                                        ]),

                                                        // 操作按钮
                                                        h('div', {
                                                            style: { marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' },
                                                            onClick: (e) => e.stopPropagation()
                                                        }, [
                                                            h(NaiveUi.NSpace, { size: 'small' }, {
                                                                default: () => [
                                                                    h(NaiveUi.NButton, {
                                                                        size: 'small',
                                                                        type: 'primary',
                                                                        onClick: () => window.open(video.video_url, '_blank')
                                                                    }, { default: () => video.has_play_url ? '播放' : '查看' }),
                                                                    
                                                                    h(NaiveUi.NButton, {
                                                                        size: 'small',
                                                                        type: 'default',
                                                                        onClick: () => window.open(`https://www.douyin.com/video/${video.video_id}`, '_blank')
                                                                    }, { default: () => '原视频' })
                                                                ]
                                                            })
                                                        ])
                                                    ])
                                                })
                                            ))
                                    ])
                                )
                            })
                    ])
                }),

                // 设置弹窗
                h(NaiveUi.NModal, {
                    show: showSettingsModal.value,
                    'onUpdate:show': (val) => { showSettingsModal.value = val; },
                    preset: 'dialog',
                    title: '下载性能设置',
                    style: { width: '500px' }
                }, {
                    default: () => h('div', {
                        style: { padding: '16px 0' }
                    }, [
                        h(NaiveUi.NSpace, { vertical: true, size: 'large' }, {
                            default: () => [
                                // 并发数设置
                                h('div', [
                                    h('div', {
                                        style: { marginBottom: '8px', fontSize: '14px', fontWeight: '500' }
                                    }, '并发下载数'),
                                    h('div', {
                                        style: { marginBottom: '12px', fontSize: '12px', color: '#666' }
                                    }, '同时下载的文件数量，网络好可以调高，网络差建议调低'),
                                    h(NaiveUi.NSlider, {
                                        value: performanceConfig.value.concurrentLimit,
                                        'onUpdate:value': (val) => { performanceConfig.value.concurrentLimit = val; },
                                        min: 1,
                                        max: 6,
                                        step: 1,
                                        marks: {
                                            1: '1个',
                                            3: '3个',
                                            6: '6个'
                                        }
                                    })
                                ]),
                                
                                // 批次延迟设置
                                h('div', [
                                    h('div', {
                                        style: { marginBottom: '8px', fontSize: '14px', fontWeight: '500' }
                                    }, '批次间隔时间'),
                                    h('div', {
                                        style: { marginBottom: '12px', fontSize: '12px', color: '#666' }
                                    }, '每批下载之间的等待时间，避免请求过于频繁'),
                                    h(NaiveUi.NSlider, {
                                        value: performanceConfig.value.batchDelay,
                                        'onUpdate:value': (val) => { performanceConfig.value.batchDelay = val; },
                                        min: 0,
                                        max: 500,
                                        step: 50,
                                        marks: {
                                            0: '0ms',
                                            100: '100ms',
                                            500: '500ms'
                                        }
                                    })
                                ]),
                                
                                // 压缩级别设置
                                h('div', [
                                    h('div', {
                                        style: { marginBottom: '8px', fontSize: '14px', fontWeight: '500' }
                                    }, '压缩级别'),
                                    h('div', {
                                        style: { marginBottom: '12px', fontSize: '12px', color: '#666' }
                                    }, '压缩级别越低速度越快，文件越大；越高速度越慢，文件越小'),
                                    h(NaiveUi.NSlider, {
                                        value: performanceConfig.value.compressionLevel,
                                        'onUpdate:value': (val) => { performanceConfig.value.compressionLevel = val; },
                                        min: 1,
                                        max: 9,
                                        step: 1,
                                        marks: {
                                            1: '最快',
                                            5: '平衡',
                                            9: '最小'
                                        }
                                    })
                                ]),
                                
                                // 预设配置
                                h('div', [
                                    h('div', {
                                        style: { marginBottom: '12px', fontSize: '14px', fontWeight: '500' }
                                    }, '快速配置'),
                                    h(NaiveUi.NSpace, {}, {
                                        default: () => [
                                            h(NaiveUi.NButton, {
                                                size: 'small',
                                                onClick: () => {
                                                    performanceConfig.value = { concurrentLimit: 6, batchDelay: 0, compressionLevel: 1 };
                                                }
                                            }, { default: () => '🚀 极速模式' }),
                                            
                                            h(NaiveUi.NButton, {
                                                size: 'small',
                                                onClick: () => {
                                                    performanceConfig.value = { concurrentLimit: 3, batchDelay: 100, compressionLevel: 5 };
                                                }
                                            }, { default: () => '⚖️ 平衡模式' }),
                                            
                                            h(NaiveUi.NButton, {
                                                size: 'small',
                                                onClick: () => {
                                                    performanceConfig.value = { concurrentLimit: 1, batchDelay: 300, compressionLevel: 9 };
                                                }
                                            }, { default: () => '🐌 稳定模式' })
                                        ]
                                    })
                                ])
                            ]
                        })
                    ])
                })
            ]);
        }
    });

    // 创建应用
    const app = App({ 
        slots: {
            default: () => h(FloatingToolbox)
        },
        options: {
            style: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9998; pointer-events: none;'
        }
    });

    // 设置全局消息提示
    app.config.globalProperties.$message = {
        success: (msg) => console.log('✅', msg),
        warning: (msg) => console.log('⚠️', msg),
        error: (msg) => console.log('❌', msg)
    };

    document.body.appendChild(app.__el__);
    
    console.log('🚀 Compass 视频数据工具已启动');

}();