const App = () => {
   
    const CR = _require('chromeRedux');
    const loadsh = _require('loadsh');
    console.log('安装move', CR);
    const doSetBaseInfo = () => async function setBaseInfo(res) {
        try {
            const mediaList = loadsh.getProperty(res.result, 'promotion_h5.head_figure_data.media_list');
            const basicInfoData = loadsh.getProperty(res.result, 'promotion_h5.basic_info_data') || {};
            const ecom_pitaya_json_str = loadsh.getProperty(res.result, 'promotion_h5.page_meta.track_meta.ecom_pitaya_json_str');
            const { category_ids: categoryIds } = JSON.parse(ecom_pitaya_json_str || '{ "category_ids": null }');
            const imageList = (mediaList || []).find(_ => _.type == 'image') || {};
            const mainImages = (imageList.content_list || []);
            await CR.commit('DOUYIN_GOODS2/SET_GOODS_INFO', {
                categoryIds: categoryIds ? categoryIds.filter(_ => +_) : undefined,
                mainImages: mainImages.map((_, i) => {
                    return {
                        ..._,
                        imgName: '主图_' + i
                    }
                }),
                baseInfo: {
                    product_id: basicInfoData.product_id,
                    title_info: Object.assign(basicInfoData.title_info || {}, { safeTitle: (basicInfoData.title_info.title || '').replace(/\//g, "") }),
                }
            });
            await CR.commit('DOUYIN_GOODS2/SET_STEP', 'PRE_GET_GOODS_INFO');

        } catch (error) {
            console.log(error, 'error');
        }
    }
    const api_hook = {
        'v2/shop/promotion/pack/h5': doSetBaseInfo(),
        'v2/shop/promotion/pack/detail': async (res) => {
            const detailImgs = loadsh.getProperty(res.result, 'detail_info.detail_imgs') || [];
            try {
                await CR.commit('DOUYIN_GOODS2/SET_GOODS_INFO', {
                    detailImages: detailImgs.map((_, i) => {
                        return {
                            ..._,
                            imgName: '详图_' + i
                        }
                    })
                });
                await CR.commit('DOUYIN_GOODS2/SET_STEP', 'PRE_GET_GOODS_INFO');
            } catch (error) {
            }
        },

        'web/ecom/order/confirm/edit': async (res) => {
            await CR.commit('DOUYIN_GOODS2/SET_STEP', 'AI_PUT_GOODS_INFO');
            window.open('https://fxg.jinritemai.com/ffa/g/create');
        },
        'v1/web/ecom/product/sku/list': async (res) => {
            await CR.commit('DOUYIN_GOODS2/SET_GOODS_INFO', {
                skuInfo: res?.result?.data
            });
        },
        'product/detail/saas/pc|repeat': doSetBaseInfo()
    }

    // chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    //     if (msg.cmd === "response_info") {
    //         const data = msg.data;
    //         const url = msg.url || '-';
    //         const regex = /^([^|]+)(?:\|([a-zA-Z]+))?$/;
    //         let action = '';
    //         const matchUrl = Object.keys(api_hook).find(matchUrl => {
    //             const match = matchUrl.match(regex);
    //             const [_, originUrl, matchAction] = match || [];
    //             action = matchAction;
    //             if (url.indexOf(originUrl) > -1) return true;
    //         });
    //         const hook = api_hook[matchUrl] || (() => { });
    //         if (!hook.isExec) {
    //             hook(data);
    //             action != 'repeat' && (hook.isExec = true);
    //         }
    //     }
    // });

    window.addEventListener('message', function (event) {
        const { type, data } = event.data;
        if (type == 'WEB_REQUEST_RESPONSE') {
            const url = data ? data.url : '-';
            const matchUrl = Object.keys(api_hook).find(matchUrl => {
                if (url.indexOf(matchUrl) > -1) return true;
            });
            const hook = api_hook[matchUrl] || (() => { });
            if (!hook.isExec) {
                hook(data);
                hook.isExec = true;
            }
        }
    });
}

export default App;