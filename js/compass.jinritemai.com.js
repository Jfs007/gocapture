!function () {
    // Compass 抖音商家平台 - 商品视频带货数据拦截
    const mdChrome = _require('mdChrome');
    const { reactive, h, defineComponent, ref, computed, } = _require('Vue3');
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
                percentage: 0,
                phase: 'download', // 'download' | 'compress'
                currentBatch: 0,
                totalBatches: 0
            });

            // 性能配置
            const performanceConfig = ref({
                concurrentLimit: 3, // 并发下载数量
                batchDelay: 100,    // 批次间延迟(ms)
                compressionLevel: 1, // 压缩级别 1-9 (1最快,9最小)
                maxFilesPerZip: 15,  // 每个压缩包最大文件数
                maxSizePerZip: 100,   // 每个压缩包最大大小(MB)
                videosPerPage: 50,   // 每页显示视频数(性能优化)
                enableVirtualScroll: true // 启用虚拟滚动
            });
            
            // UI性能优化状态
            const uiState = ref({
                currentPage: 1,
                searchKeyword: '',
                showAllProducts: true // 是否显示所有商品(默认只显示前几个)
            });

            // 按商品分组的视频数据（性能优化版）
            const groupedVideos = computed(() => {
                const groups = [];
                const entries = Object.entries(videoInfos);
                
                // 限制显示的商品数量以提升性能
                const maxProducts = uiState.value.showAllProducts ? entries.length : Math.min(entries.length, 10);
                const limitedEntries = entries.slice(0, maxProducts);
                
                limitedEntries.forEach(([goodsId, videoList]) => {
                    const productInfo = window.__PRODUCT_INFO__?.[goodsId] || {};

                    // 过滤和搜索
                    let filteredVideos = videoList;
                    if (uiState.value.searchKeyword) {
                        const keyword = uiState.value.searchKeyword.toLowerCase();
                        filteredVideos = videoList.filter(video => 
                            (video.video_name || '').toLowerCase().includes(keyword) ||
                            (video.author_name || '').toLowerCase().includes(keyword)
                        );
                    }

                    // 不在这里分页，在后面统一分页
                    const pagedVideos = filteredVideos;

                    const videos = pagedVideos.map(video => {
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

                    if (videos.length > 0) {
                        groups.push({
                            goodsId,
                            productName: productInfo.name || `商品 ${goodsId}`,
                            videos,
                            totalVideos: filteredVideos.length
                        });
                    }
                });
                
                return groups;
            });

            // 所有视频的扁平数组（用于统计和分页）
            const allVideos = computed(() => {
                const videos = [];
                groupedVideos.value.forEach(group => {
                    videos.push(...group.videos);
                });
                return videos;
            });

            // 分页后的视频数据
            const pagedGroupedVideos = computed(() => {
                const videosPerPage = performanceConfig.value.videosPerPage;
                const startIndex = (uiState.value.currentPage - 1) * videosPerPage;
                const endIndex = startIndex + videosPerPage;
                const pagedVideos = allVideos.value.slice(startIndex, endIndex);

                // 按商品重新分组分页后的视频
                const groupsMap = new Map();
                pagedVideos.forEach(video => {
                    const { goodsId } = video;
                    const originalGroup = groupedVideos.value.find(g => g.goodsId === goodsId);
                    if (!groupsMap.has(goodsId)) {
                        groupsMap.set(goodsId, {
                            goodsId,
                            productName: originalGroup?.productName || `商品 ${goodsId}`,
                            videos: [],
                            totalVideos: originalGroup?.totalVideos || 0
                        });
                    }
                    groupsMap.get(goodsId).videos.push(video);
                });

                return Array.from(groupsMap.values());
            });

            // 总页数计算
            const totalPages = computed(() => {
                return Math.ceil(allVideos.value.length / performanceConfig.value.videosPerPage);
            });

            const handleGetVideos = () => {
                console.log('openVideos')
                showModal.value = true;
            };

            // 每个商品的全选功能
            const isProductAllSelected = (goodsId) => {
                const productVideos = groupedVideos.value.find(g => g.goodsId === goodsId)?.videos || [];
                return productVideos.length > 0 && productVideos.every(video => 
                    selectedVideos.value.has(video.video_id)
                );
            };

            const isProductPartialSelected = (goodsId) => {
                const productVideos = groupedVideos.value.find(g => g.goodsId === goodsId)?.videos || [];
                const selectedCount = productVideos.filter(video => 
                    selectedVideos.value.has(video.video_id)
                ).length;
                return selectedCount > 0 && selectedCount < productVideos.length;
            };

            const toggleProductSelection = (goodsId) => {
                const productVideos = groupedVideos.value.find(g => g.goodsId === goodsId)?.videos || [];
                const isAllSelected = isProductAllSelected(goodsId);
                
                if (isAllSelected) {
                    // 取消全选
                    productVideos.forEach(video => {
                        selectedVideos.value.delete(video.video_id);
                    });
                } else {
                    // 全选
                    productVideos.forEach(video => {
                        if (video.has_play_url) {
                            selectedVideos.value.add(video.video_id);
                        }
                    });
                }
            };

            // 分页控制函数
            const goToPage = (page) => {
                if (page >= 1 && page <= totalPages.value) {
                    uiState.value.currentPage = page;
                }
            };

            const goToPreviousPage = () => {
                if (uiState.value.currentPage > 1) {
                    uiState.value.currentPage--;
                }
            };

            const goToNextPage = () => {
                if (uiState.value.currentPage < totalPages.value) {
                    uiState.value.currentPage++;
                }
            };

            // 选择相关方法
            const isVideoSelected = (videoId) => {
                return selectedVideos.value.has(videoId);
            };

            // 防抖优化：批量更新选中状态
            let selectionUpdateTimer = null;
            const pendingSelections = new Set();
            
            const toggleVideoSelection = (videoId) => {
                // 立即更新本地状态，给用户即时反馈
                const newSet = new Set(selectedVideos.value);
                if (newSet.has(videoId)) {
                    newSet.delete(videoId);
                } else {
                    newSet.add(videoId);
                }
                selectedVideos.value = newSet;
                
                // 添加到待处理队列
                pendingSelections.add(videoId);
                
                // 防抖：延迟批量更新UI
                if (selectionUpdateTimer) {
                    clearTimeout(selectionUpdateTimer);
                }
                selectionUpdateTimer = setTimeout(() => {
                    // 批量更新完成，清空队列
                    pendingSelections.clear();
                    selectionUpdateTimer = null;
                }, 100);
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

            // 分批压缩下载（内存优化版本）
            const handleDownloadSelected = async () => {
                const selectedVideoData = allVideos.value.filter(video =>
                    selectedVideos.value.has(video.video_id) && video.has_play_url
                );

                if (selectedVideoData.length === 0) {
                    window.$message?.warning('请先选择可下载的视频');
                    return;
                }

                const maxFilesPerZip = performanceConfig.value.maxFilesPerZip;
                const totalBatches = Math.ceil(selectedVideoData.length / maxFilesPerZip);

                // 初始化进度状态
                downloadProgress.value = {
                    isDownloading: true,
                    current: 0,
                    total: selectedVideoData.length,
                    currentFileName: '准备分批下载...',
                    percentage: 0,
                    phase: 'download',
                    currentBatch: 0,
                    totalBatches
                };

                console.log(`🗜️ 开始分批下载 ${selectedVideoData.length} 个视频，分为 ${totalBatches} 个压缩包...`);

                try {
                    // 等待库加载
                    while (!window.JSZip || !window.saveAs) {
                        console.log('⏳ 等待压缩库加载...');
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    let totalSuccessCount = 0;
                    let totalFailCount = 0;
                    let globalCompletedCount = 0; // 全局已完成文件计数
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

                    // 分批处理
                    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                        const startIndex = batchIndex * maxFilesPerZip;
                        const endIndex = Math.min(startIndex + maxFilesPerZip, selectedVideoData.length);
                        const batchVideos = selectedVideoData.slice(startIndex, endIndex);

                        console.log(`📦 处理第 ${batchIndex + 1}/${totalBatches} 个压缩包 (${batchVideos.length} 个文件)...`);

                        downloadProgress.value = {
                            ...downloadProgress.value,
                            currentFileName: `处理压缩包 ${batchIndex + 1}/${totalBatches}...`,
                            percentage: Math.round((batchIndex / totalBatches) * 90)
                        };

                        const { successCount, failCount } = await processBatch(batchVideos, batchIndex + 1, timestamp, globalCompletedCount);
                        globalCompletedCount += batchVideos.length;
                        
                        totalSuccessCount += successCount;
                        totalFailCount += failCount;

                        // 强制垃圾回收，释放内存
                        if (window.gc) window.gc();
                        
                        // 批次间短暂休息，让浏览器喘口气
                        if (batchIndex < totalBatches - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }

                    // 完成所有下载
                    downloadProgress.value = {
                        ...downloadProgress.value,
                        currentFileName: '所有压缩包下载完成！',
                        percentage: 100,
                        phase: 'complete'
                    };

                    console.log(`🎉 分批下载完成！总计成功: ${totalSuccessCount}, 失败: ${totalFailCount}`);
                    window.$message?.success(`下载完成！生成了 ${totalBatches} 个压缩包，包含 ${totalSuccessCount} 个视频`);

                    // 延迟重置状态
                    setTimeout(() => {
                        downloadProgress.value.isDownloading = false;
                    }, 3000);

                } catch (error) {
                    console.error('❌ 分批下载失败:', error);
                    window.$message?.error('分批下载失败，请重试');
                    downloadProgress.value.isDownloading = false;
                }
            };

            // 处理单个批次的压缩包
            const processBatch = async (batchVideos, batchNumber, timestamp, startingCompletedCount) => {
                const zip = new JSZip();
                let successCount = 0;
                let failCount = 0;
                let completedInBatch = 0;
                let currentBatchSize = 0; // 当前批次大小(字节)

                const CONCURRENT_LIMIT = performanceConfig.value.concurrentLimit;
                const MAX_SIZE_BYTES = performanceConfig.value.maxSizePerZip * 1024 * 1024; // 转换为字节

                // 分组下载任务
                const downloadFile = async (video, index) => {
                    const fileName = `${video.author_name || 'unknown'}_${video.video_id}.mp4`.replace(/[/\\:*?"<>|]/g, '_');

                    try {
                        console.log(`📥 [批次${batchNumber}] 下载: ${fileName}`);

                        const response = await fetch(video.video_play_url);
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        const blob = await response.blob();
                        
                        // 检查大小限制
                        if (currentBatchSize + blob.size > MAX_SIZE_BYTES && successCount > 0) {
                            console.log(`⚠️ [批次${batchNumber}] 文件过大，跳过: ${fileName} (${(blob.size/1024/1024).toFixed(1)}MB)`);
                            failCount++;
                            return { success: false, reason: 'size_limit', fileName, video };
                        }

                        const productInfo = window.__PRODUCT_INFO__[video.goodsId];
                        const productName = productInfo?.name?.replace(/[/\\:*?"<>|]/g, '_') || `商品_${video.goodsId}`;

                        zip.folder(productName).file(fileName, blob);
                        currentBatchSize += blob.size;

                        successCount++;
                        console.log(`✅ [批次${batchNumber}] 完成: ${fileName} (${(blob.size/1024/1024).toFixed(1)}MB)`);
                        return { success: true, fileName, video, size: blob.size };

                    } catch (error) {
                        console.error(`❌ [批次${batchNumber}] 下载失败: ${video.video_id}`, error);
                        failCount++;
                        return { success: false, fileName, video, error };
                    } finally {
                        completedInBatch++;
                        
                        // 更新总体进度 - 下载阶段占70%
                        const globalCompleted = startingCompletedCount + completedInBatch;
                        const downloadPhaseProgress = (globalCompleted / downloadProgress.value.total) * 70;
                        downloadProgress.value = {
                            ...downloadProgress.value,
                            current: globalCompleted,
                            currentFileName: `[批次${batchNumber}] ${fileName}`,
                            percentage: Math.round(downloadPhaseProgress),
                            phase: 'download'
                        };
                    }
                };

                // 并发下载当前批次
                console.log(`📦 [批次${batchNumber}] 开始并发下载 ${batchVideos.length} 个文件，并发数: ${CONCURRENT_LIMIT}`);

                for (let i = 0; i < batchVideos.length; i += CONCURRENT_LIMIT) {
                    const chunk = batchVideos.slice(i, i + CONCURRENT_LIMIT);
                    const chunkPromises = chunk.map(video => downloadFile(video, i));

                    await Promise.all(chunkPromises);

                    // 小批次间延迟
                    if (i + CONCURRENT_LIMIT < batchVideos.length) {
                        await new Promise(resolve => setTimeout(resolve, performanceConfig.value.batchDelay));
                    }
                }

                // 生成并下载当前批次的压缩包
                if (successCount > 0) {
                    console.log(`📦 [批次${batchNumber}] 生成压缩包... (${(currentBatchSize/1024/1024).toFixed(1)}MB)`);

                    // 压缩进度更新 - 压缩阶段占30%，从70%开始
                    const downloadPhaseProgress = 70;
                    const currentBatchProgress = (batchNumber - 1) / downloadProgress.value.totalBatches;
                    const compressionProgress = downloadPhaseProgress + (currentBatchProgress * 30);
                    downloadProgress.value = {
                        ...downloadProgress.value,
                        currentFileName: `生成压缩包 ${batchNumber}/${downloadProgress.value.totalBatches}...`,
                        percentage: Math.round(compressionProgress),
                        phase: 'compress',
                        currentBatch: batchNumber
                    };

                    // 使用更快的压缩设置
                    const content = await zip.generateAsync({
                        type: "blob",
                        compression: "DEFLATE",
                        compressionOptions: {
                            level: performanceConfig.value.compressionLevel
                        }
                    });

                    const filename = batchVideos.length > 1 
                        ? `商品视频_批次${batchNumber}_${successCount}个_${timestamp}.zip`
                        : `商品视频_${successCount}个_${timestamp}.zip`;

                    window.saveAs(content, filename);

                    console.log(`✅ [批次${batchNumber}] 压缩包已保存: ${filename}`);
                }

                // 清理内存
                zip.files = {};
                
                return { successCount, failCount };
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
                                    default: () => {
                                        if (!downloadProgress.value.isDownloading) {
                                            return `打包下载 (${selectedCount.value})`;
                                        }
                                        const phase = downloadProgress.value.phase;
                                        if (phase === 'download') {
                                            return `下载中 (${downloadProgress.value.current}/${downloadProgress.value.total})`;
                                        } else if (phase === 'compress') {
                                            return `压缩中 (${downloadProgress.value.currentBatch}/${downloadProgress.value.totalBatches})`;
                                        } else {
                                            return `处理中...`;
                                        }
                                    }
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
                        style: { 
                            height: '700px',
                            display: 'flex',
                            flexDirection: 'column'
                        }
                    }, [
                        // 可滚动的内容区域
                        h('div', {
                            style: { 
                                flex: 1,
                                overflowY: 'auto',
                                marginBottom: '8px'
                            }
                        }, [
                        // 操作栏
                        h('div', {
                            style: { marginBottom: '16px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px' }
                        }, [
                            // 搜索和过滤栏
                            h('div', {
                                style: { marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }
                            }, [
                                h(NaiveUi.NInput, {
                                    value: uiState.value.searchKeyword,
                                    'onUpdate:value': (val) => { uiState.value.searchKeyword = val; },
                                    placeholder: '搜索视频标题或作者...',
                                    size: 'small',
                                    style: { width: '200px' }
                                }),
                                
                                allVideos.value.length > 50 ? h(NaiveUi.NButton, {
                                    size: 'small',
                                    type: uiState.value.showAllProducts ? 'warning' : 'default',
                                    onClick: () => { uiState.value.showAllProducts = !uiState.value.showAllProducts; }
                                }, { 
                                    default: () => uiState.value.showAllProducts 
                                        ? `🔥 显示全部 (${allVideos.value.length})` 
                                        : `⚡ 仅显示前100个商品 (性能优化)`
                                }) : null
                            ]),
                            
                            h(NaiveUi.NSpace, { justify: 'space-between', align: 'center' }, {
                                default: () => [
                                    h('span', `当前显示 ${pagedGroupedVideos.value.reduce((sum, g) => sum + g.videos.length, 0)} / 共 ${allVideos.value.length} 个视频 (第 ${uiState.value.currentPage}/${totalPages.value} 页)`),
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
                                                default: () => {
                                                    if (!downloadProgress.value.isDownloading) {
                                                        return `打包下载 (${selectedCount.value})`;
                                                    }
                                                    const phase = downloadProgress.value.phase;
                                                    if (phase === 'download') {
                                                        return `下载中 (${downloadProgress.value.current}/${downloadProgress.value.total})`;
                                                    } else if (phase === 'compress') {
                                                        return `压缩中 (${downloadProgress.value.currentBatch}/${downloadProgress.value.totalBatches})`;
                                                    } else {
                                                        return `处理中...`;
                                                    }
                                                }
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
                        pagedGroupedVideos.value.length === 0
                            ? h('div', {
                                style: { textAlign: 'center', padding: '60px', color: '#999' }
                            }, '暂无视频数据，请先访问商品视频页面')
                            : h(NaiveUi.NSpace, {
                                vertical: true,
                                size: 'medium',
                                style: { width: '100%' }
                            }, {
                                default: () => pagedGroupedVideos.value.map(group =>
                                    h('div', { key: group.goodsId }, [
                                        // 商品名称标题
                                        h('div', {
                                            style: {
                                                fontSize: '15px',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                                paddingBottom: '6px',
                                                borderBottom: '1px solid #e8e8e8',
                                                color: '#333',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }
                                        }, [
                                            h('span', `📦 ${group.productName} (${group.videos.length}个视频)`),
                                            h(NaiveUi.NCheckbox, {
                                                checked: isProductAllSelected(group.goodsId),
                                                indeterminate: isProductPartialSelected(group.goodsId),
                                                'onUpdate:checked': () => toggleProductSelection(group.goodsId)
                                            }, { default: () => '全选' })
                                        ]),

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

                                                            h('div', { size: 'small', wrap: false, style: 'display: flex;' }, [
                                                                h(NaiveUi.NEllipsis, {
                                                                    style: { fontSize: '11px', color: '#666', }
                                                                }, () => `👤 ${video.author_name || '未知作者'}`),

                                                                video.publish_ts ? h(NaiveUi.NEllipsis, {
                                                                    style: { fontSize: '11px', color: '#666' }
                                                                }, () => `🕒 ${new Date(video.publish_ts * 1000).toLocaleDateString('zh-CN')}`) : null
                                                            ])
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
                    ]),

                        // 固定在底部的分页控件
                        totalPages.value > 1 ? h('div', {
                            style: { 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                padding: '12px',
                                borderTop: '1px solid #f0f0f0',
                                backgroundColor: '#fafafa',
                                flexShrink: 0
                            }
                        }, [
                            h(NaiveUi.NPagination, {
                                page: uiState.value.currentPage,
                                'onUpdate:page': (page) => { uiState.value.currentPage = page; },
                                pageCount: totalPages.value,
                                size: 'medium',
                                showSizePicker: false,
                                showQuickJumper: true,
                                prefix: () => `共 ${allVideos.value.length} 个视频`
                            })
                        ]) : null
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

                                // 分批设置
                                h('div', [
                                    h('div', {
                                        style: { marginBottom: '8px', fontSize: '14px', fontWeight: '500' }
                                    }, '每包文件数'),
                                    h('div', {
                                        style: { marginBottom: '12px', fontSize: '12px', color: '#666' }
                                    }, '每个压缩包包含的最大文件数，避免内存溢出'),
                                    h(NaiveUi.NSlider, {
                                        value: performanceConfig.value.maxFilesPerZip,
                                        'onUpdate:value': (val) => { performanceConfig.value.maxFilesPerZip = val; },
                                        min: 5,
                                        max: 30,
                                        step: 5,
                                        marks: {
                                            5: '5个',
                                            15: '15个',
                                            30: '30个'
                                        }
                                    })
                                ]),

                                // 包大小限制
                                h('div', [
                                    h('div', {
                                        style: { marginBottom: '8px', fontSize: '14px', fontWeight: '500' }
                                    }, '单包大小限制'),
                                    h('div', {
                                        style: { marginBottom: '12px', fontSize: '12px', color: '#666' }
                                    }, '每个压缩包的最大大小(MB)，超过会自动分包'),
                                    h(NaiveUi.NSlider, {
                                        value: performanceConfig.value.maxSizePerZip,
                                        'onUpdate:value': (val) => { performanceConfig.value.maxSizePerZip = val; },
                                        min: 50,
                                        max: 500,
                                        step: 50,
                                        marks: {
                                            50: '50MB',
                                            100: '100MB',
                                            500: '500MB'
                                        }
                                    })
                                ]),

                                // UI性能优化
                                h('div', [
                                    h('div', {
                                        style: { marginBottom: '8px', fontSize: '14px', fontWeight: '500' }
                                    }, 'UI性能优化'),
                                    h('div', {
                                        style: { marginBottom: '12px', fontSize: '12px', color: '#666' }
                                    }, '每页显示视频数，数量越少页面越流畅'),
                                    h(NaiveUi.NSlider, {
                                        value: performanceConfig.value.videosPerPage,
                                        'onUpdate:value': (val) => { performanceConfig.value.videosPerPage = val; },
                                        min: 20,
                                        max: 100,
                                        step: 10,
                                        marks: {
                                            20: '20个',
                                            50: '50个',
                                            100: '100个'
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
                                                    performanceConfig.value = { concurrentLimit: 6, batchDelay: 0, compressionLevel: 1, maxFilesPerZip: 10, maxSizePerZip: 200, videosPerPage: 30 };
                                                }
                                            }, { default: () => '🚀 极速模式' }),

                                            h(NaiveUi.NButton, {
                                                size: 'small',
                                                onClick: () => {
                                                    performanceConfig.value = { concurrentLimit: 3, batchDelay: 100, compressionLevel: 5, maxFilesPerZip: 15, maxSizePerZip: 100, videosPerPage: 50 };
                                                }
                                            }, { default: () => '⚖️ 平衡模式' }),

                                            h(NaiveUi.NButton, {
                                                size: 'small',
                                                onClick: () => {
                                                    performanceConfig.value = { concurrentLimit: 1, batchDelay: 300, compressionLevel: 9, maxFilesPerZip: 20, maxSizePerZip: 50, videosPerPage: 100 };
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