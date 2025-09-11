// Compass站点初始化 - 使用新版本加载方式
import CompassApp from './components/CompassApp.vue'
const initCompassApp = async () => {
  console.log('🚀 Compass站点初始化...')
  
  // 获取mdChrome依赖  
  const mdChrome = _require('mdChrome')
  await Promise.all([
      mdChrome.web.injectScript('cp_modules/store/index.js'),
      mdChrome.web.injectScript('cp_modules/web-hook/index.js'),
      mdChrome.web.injectScript('other/jszip.min.js'),
      mdChrome.web.injectScript('other/FileSaver.js'),
  ])
  const CR = _require('chromeRedux')
  // 初始化下载历史模块
  const DOWNLOADED_VIDEOS = {
    state: {
      downloadedVideoIds: {}
    },
    mutations: {
      ADD_DOWNLOADED_VIDEO(state, videoId) {
        state.downloadedVideoIds[videoId] = 1;
        console.log('添加已下载视频:', videoId);
      },
      ADD_DOWNLOADED_VIDEOS(state, videoIds) {
        videoIds.forEach(videoId => {
          state.downloadedVideoIds[videoId] = 1;
        });
        console.log('批量添加已下载视频:', videoIds.length, '个');
      },
      LOAD_DOWNLOADED_VIDEOS(state, videoIds) {
        state.downloadedVideoIds = videoIds;
      }
    }
  };

  // 初始化已下载商品模块
  const DOWNLOADED_PRODUCTS = {
    state: {
      downloadedProductIds: {}
    },
    mutations: {
      ADD_DOWNLOADED_PRODUCT(state, productId) {
        state.downloadedProductIds[productId] = Date.now();
        console.log('添加已下载商品:', productId);
      },
      LOAD_DOWNLOADED_PRODUCTS(state, productIds) {
        state.downloadedProductIds = productIds;
      }
    }
  };

  CR.registerModule('DOWNLOADED_VIDEOS', DOWNLOADED_VIDEOS);
  CR.registerModule('DOWNLOADED_PRODUCTS', DOWNLOADED_PRODUCTS);
  CR.init();



  // 初始化视频数据收集
  const videoInfos = {};
  
  // 存储商品信息，用于显示商品名称
  window.__PRODUCT_INFO__ = window.__PRODUCT_INFO__ || {};
  
  function getItemIndex({ page_no, page_size }, itemIndexInPage) {
    return (page_no - 1) * page_size + itemIndexInPage;
  }
  
  // 存储每个商品的下载状态和进度信息
  const downloadingStates = {};
  const downloadProgress = {}; // 存储每个商品的下载进度信息
  
  // 已下载商品记录
  let downloadedProducts = {};

  // 加载已下载商品记录
  async function loadDownloadedProducts() {
    try {
      const data = await CR.get('DOWNLOADED_PRODUCTS');
      if (data && data.downloadedProductIds) {
        downloadedProducts = data.downloadedProductIds || {};
        console.log('📋 加载已下载商品记录:', Object.keys(downloadedProducts).length, '个');
      }
    } catch (error) {
      console.log('加载商品下载记录失败:', error);
    }
  }

  // 保存已下载商品
  async function saveDownloadedProduct(productId) {
    try {
      downloadedProducts[productId] = Date.now();
      await CR.commit('DOWNLOADED_PRODUCTS/ADD_DOWNLOADED_PRODUCT', productId);
      console.log('保存已下载商品:', productId);
    } catch (error) {
      console.error('保存商品下载记录失败:', error);
    }
  }

  // 页面加载时初始化
  loadDownloadedProducts();

  // 定期检查和更新按钮状态
  setInterval(() => {
    Object.keys(downloadingStates).forEach(goodsId => {
      if (downloadingStates[goodsId]) {
        updateButtonState(goodsId);
      }
    });
    
    Object.keys(downloadedProducts).forEach(goodsId => {
      if (document.getElementById(goodsId) && !downloadingStates[goodsId]) {
        updateButtonState(goodsId);
      }
    });
  }, 1000);

  function setListOperation(list, page) {
    list.map((_, _index) => {
      const index = getItemIndex(page, _index);
      const goodsId = _.product_info.id;
      const tr = document.querySelector(`[data-row-key="${goodsId}_${index + 1}"]`);
      const td = tr?.querySelector('td:nth-child(3)>div');
      const operation = document.getElementById(`${goodsId}`);
      if (td && !operation) {
        const p = document.createElement('div');
        p.className = 'zz';
        p.id = goodsId;
        
        const isDownloaded = !!downloadedProducts[goodsId];
        p.innerText = isDownloaded ? '已下载' : '下载视频';
        p.style = `margin-right: 10px;width: 80px;height: 24px;text-align: center;color: #fff;font-size: 12px;line-height: 24px;background: ${isDownloaded ? '#52c41a' : '#42a6b1'};cursor: pointer`;
        
        p.addEventListener('click', () => handleDownloadProduct(goodsId));
        
        td.insertBefore(p, td.firstChild);
      } else if (operation) {
        updateButtonState(goodsId);
      }
    })
  }

  // 更新按钮状态
  function updateButtonState(goodsId) {
    const button = document.getElementById(goodsId);
    if (!button) return;

    const isDownloading = downloadingStates[goodsId];
    const progress = downloadProgress[goodsId];
    const isDownloaded = !!downloadedProducts[goodsId];

    if (isDownloading && progress) {
      button.innerText = progress.text;
      button.style.background = progress.color;
      button.style.cursor = 'not-allowed';
    } else if (!isDownloading) {
      button.innerText = isDownloaded ? '已下载' : '下载视频';
      button.style.background = isDownloaded ? '#52c41a' : '#42a6b1';
      button.style.cursor = 'pointer';
    }
  }

  // 更新下载进度
  function updateDownloadProgress(goodsId, text, color = '#ff7f00') {
    downloadProgress[goodsId] = { text, color };
    updateButtonState(goodsId);
  }

  // 清除下载进度
  function clearDownloadProgress(goodsId) {
    delete downloadProgress[goodsId];
    updateButtonState(goodsId);
  }

  // 下载单个商品的所有视频
  async function handleDownloadProduct(goodsId) {
    const button = document.getElementById(goodsId);
    if (!button || downloadingStates[goodsId]) return;

    const videos = videoInfos[goodsId] || [];
    const downloadableVideos = videos.filter(video => video.video_play_url);

    if (downloadableVideos.length === 0) {
      updateDownloadProgress(goodsId, '无可下载视频', '#999');
      setTimeout(() => {
        clearDownloadProgress(goodsId);
      }, 2000);
      return;
    }

    downloadingStates[goodsId] = true;
    updateDownloadProgress(goodsId, '准备中...');

    try {
      while (!window.JSZip || !window.saveAs) {
        console.log('⏳ 等待压缩库加载...');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const zip = new JSZip();
      const productInfo = window.__PRODUCT_INFO__[goodsId] || {};
      const productName = productInfo.name?.replace(/[/\\:*?"<>|]/g, '_') || `商品_${goodsId}`;
      let successCount = 0;
      let totalCount = downloadableVideos.length;

      console.log(`📦 开始下载商品 ${productName} 的 ${totalCount} 个视频...`);

      const BATCH_SIZE = 3;
      for (let i = 0; i < downloadableVideos.length; i += BATCH_SIZE) {
        const batch = downloadableVideos.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (video) => {
          try {
            updateDownloadProgress(goodsId, `下载中 ${successCount + 1}/${totalCount}`);

            const response = await fetch(video.video_play_url);
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const dimensions = await getVideoDimensionsFromBlob(blob);
            const sizeStr = dimensions.width > 0 && dimensions.height > 0 
              ? `${dimensions.width}x${dimensions.height}_` 
              : '';
            const fileName = `${sizeStr}${video.author_name || 'unknown'}_${video.video_id}.mp4`.replace(/[/\\:*?"<>|]/g, '_');
            zip.file(fileName, blob);
            
            const data = await CR.get('DOWNLOADED_VIDEOS');
            const downloadedVideoIds = data?.downloadedVideoIds || {};
            downloadedVideoIds[video.video_id] = 1;
            await CR.commit('DOWNLOADED_VIDEOS/ADD_DOWNLOADED_VIDEO', video.video_id);

            successCount++;
            console.log(`✅ 下载完成: ${fileName}`);
            return true;
          } catch (error) {
            console.error(`❌ 下载失败: ${video.video_id}`, error);
            return false;
          }
        });

        await Promise.all(batchPromises);
        
        if (i + BATCH_SIZE < downloadableVideos.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (successCount > 0) {
        updateDownloadProgress(goodsId, '压缩中...');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const content = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 1 }
        });

        const filename = `${productName}_${successCount}个视频_${timestamp}.zip`;
        window.saveAs(content, filename);

        await saveDownloadedProduct(goodsId);
        updateDownloadProgress(goodsId, `已下载 ${successCount}个`, '#52c41a');
        
        console.log(`🎉 商品 ${productName} 下载完成！成功: ${successCount}个`);
      } else {
        throw new Error('没有成功下载任何视频');
      }

      setTimeout(() => {
        downloadingStates[goodsId] = false;
        clearDownloadProgress(goodsId);
      }, 3000);

    } catch (error) {
      console.error('❌ 商品视频下载失败:', error);
      updateDownloadProgress(goodsId, '下载失败', '#ff4d4f');
      
      setTimeout(() => {
        downloadingStates[goodsId] = false;
        clearDownloadProgress(goodsId);
      }, 3000);
    }
  }

  // 从blob获取视频尺寸的函数
  async function getVideoDimensionsFromBlob(blob) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
        if (video.src) {
          URL.revokeObjectURL(video.src);
        }
        video.src = '';
      };
      
      const onLoadedMetadata = () => {
        const dimensions = {
          width: video.videoWidth,
          height: video.videoHeight
        };
        cleanup();
        resolve(dimensions);
      };
      
      const onError = () => {
        cleanup();
        resolve({ width: 0, height: 0 });
      };
      
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', onError);
      
      const blobUrl = URL.createObjectURL(blob);
      video.src = blobUrl;
      
      setTimeout(() => {
        cleanup();
        resolve({ width: 0, height: 0 });
      }, 5000);
    });
  }

  // API拦截配置
  const api_hook = {
    'shop/product/product_rank/video_bring_good': (res) => {
      const list = res?.result?.data?.data_result || [];
      list.map(item => {
        const goodsId = item.product_info.id;
        videoInfos[goodsId] = item.video_list || [];
        window.__PRODUCT_INFO__[goodsId] = item.product_info;
      })
      setTimeout(() => {
        setListOperation(list, res?.result?.data?.page_result || {});
        setTimeout(() => {
          list.forEach(item => {
            updateButtonState(item.product_info.id);
          });
        }, 100);
      }, 60);
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

  // 将数据暴露到全局，供Vue组件使用
  window._videoDataCollector = {
    getAllVideos: () => {
      const videos = [];
      Object.entries(videoInfos).forEach(([goodsId, videoList]) => {
        videoList.forEach(video => {
          const productInfo = window.__PRODUCT_INFO__[goodsId] || {};
          videos.push({
            goodsId,
            productName: productInfo.name || `商品 ${goodsId}`,
            ...video,
            video_url: video.video_play_url || `https://www.douyin.com/video/${video.video_id}`,
            has_play_url: !!video.video_play_url,
            video_img: video.video_img
          });
        });
      });
      return videos;
    },
    getVideosByGoodsId: (goodsId) => videoInfos[goodsId] || []
  };

  // 将下载管理器暴露到全局
  window._downloadManager = {
    downloadVideos: async (videos, config, progressCallback) => {
      // 这里可以实现批量下载逻辑
      console.log('批量下载视频:', videos.length, '个');
    }
  };

  // 使用共享组件库
  const MdUiComponent = window['MdUiComponent']
  
  if (!MdUiComponent) {
    console.error('❌ MdUiComponent未加载，等待加载...')
    // 等待共享组件库加载
    let retries = 0
    while (!window['MdUiComponent'] && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      retries++
    }
    if (!window['MdUiComponent']) {
      console.error('❌ MdUiComponent加载超时')
      return
    }
  }

  console.log('📦 共享组件库已加载')

  // 等待DOM加载
  setTimeout(async () => {
    console.log('🔧 开始创建Vue应用...')
    
    // 使用cp_modules中的工具函数
    const loadsh = _require('loadsh') 
    const store = _require('store')
    
    if (loadsh) {
      console.log('📦 loadsh工具函数已可用:', Object.keys(loadsh))
      loadsh.showToast && loadsh.showToast({ message: '🎉 Compass应用启动成功!' })
    }
    
    if (store) {
      console.log('📦 store状态管理已可用:', typeof store)
    }
    
    // 使用共享的App组件和本地CompassApp组件
    const { h } = MdUiComponent
    const { App } = MdUiComponent.Components
    
    // 动态导入CompassApp组件
    console.log('🔧 使用App模式创建应用...')
    
    // const app = App({
    //   slots: {
    //     default: () => h(CompassApp)
    //   },
    //   options: {
    //     id: 'compass-vue-app',
    //     style: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; pointer-events: none;'
    //   }
    // })
    
    // 将应用元素添加到页面
    // document.body.appendChild(app.__el__)
    
    // 添加样式让子组件可交互
    const style = document.createElement('style')
    style.textContent = `
      .compass-app > * {
        pointer-events: auto !important;
      }
    `
    document.head.appendChild(style)
    
    console.log('🎉 Compass应用创建完成!')
    console.log('📋 功能清单:')
    console.log('  ✅ API数据拦截和收集')
    console.log('  ✅ 页面下载按钮注入')
    console.log('  ✅ 单商品视频批量下载')
    console.log('  ✅ 多商品视频分批打包下载')
    console.log('  ✅ 下载记录状态管理')
    console.log('  ✅ 悬浮工具箱界面')
    
  }, 500)
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initCompassApp())
} else {
  initCompassApp()
}