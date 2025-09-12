
import App from "./components/app.vue";
const HAOHUO_HREF = location.href;
const HAOHUO_HREF_PARAMS = new URLSearchParams(window.location.search);
const initApp = async () => {
    
    // 获取mdChrome依赖  
    const mdChrome = _require('mdChrome')
    await Promise.all([
        mdChrome.web.injectScript('cp_modules/store/index.js'),
        mdChrome.web.injectScript('cp_modules/loadsh/index.js'),
        mdChrome.web.injectScript('cp_modules/web-hook/index.js'),
    ])
    // 获取依赖
    const CR = _require('chromeRedux');
    const mdLoadsh = _require('loadsh');
    const webHook = _require('webHook');
    // 初始化ChromeRedux状态管理
    const DOUYIN_GOODS = {
        state: {
            goodsInfo: {
                categoryIds: [],
                mainImages: [],
                skuInfo: {
                    specs: [],
                    skus: [],
                    pic: {},
                    big_pic: {}
                },
                detailImages: [],
                baseInfo: {}
            },
            // PRE_GET_GOODS_INFO | AI_PUT_GOODS_INFO | ADD_GOODS_DRAFT_INFO | SAVE_COMPLETE_GOODS_DRAFT
            step: 'PRE_GET_GOODS_INFO',
        },
        mutations: {
            SET_GOODS_INFO(state, payload) {
                state.goodsInfo = Object.assign({}, state.goodsInfo, payload || {});
            },

            SET_STEP(state, payload) {
                state.step = payload || 'PRE_GET_GOODS_INFO';
            },

            RESET(state) {
                state.step = 'PRE_GET_GOODS_INFO';
                state.goodsInfo = {
                    categoryIds: [],
                    mainImages: [],
                    skuInfo: {
                        specs: [],
                        skus: [],
                        pic: {},
                        big_pic: {}
                    },
                    detailImages: [],
                    baseInfo: {}
                }
            }
        }
    }

    CR.registerModule('DOUYIN_GOODS2', DOUYIN_GOODS);
    CR.init();

    // https://haohuo.jinritemai.com/ - 好货榜单页面处理
    if (HAOHUO_HREF.indexOf('https://haohuo.jinritemai.com/') >= 0) {
        const { createBaseApp } = MdUiComponent.Components;
        const app = createBaseApp(App, {});
        document.body.appendChild(app.__el__);
        const doSetBaseInfo = () => async function setBaseInfo(res) {
            try {
                const mediaList = mdLoadsh.getProperty(res.result, 'promotion_h5.head_figure_data.media_list');
                const basicInfoData = mdLoadsh.getProperty(res.result, 'promotion_h5.basic_info_data') || {};
                const ecom_pitaya_json_str = mdLoadsh.getProperty(res.result, 'promotion_h5.page_meta.track_meta.ecom_pitaya_json_str');
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
                const detailImgs = mdLoadsh.getProperty(res.result, 'detail_info.detail_imgs') || [];
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

    // https://fxg.jinritemai.com - 商品创建页面处理
    if (HAOHUO_HREF.indexOf('https://fxg.jinritemai.com/ffa/g/create') >= 0) {
        const utils = _require('fxg.jinritemai.com.utils');
        let app = await CR.get('DOUYIN_GOODS2');
        // await CR.commit('DOUYIN_GOODS2/SET_STEP', 'AI_PUT_GOODS_INFO');
        if (app.step == "AI_PUT_GOODS_INFO") {
            mdLoadsh.showToast({
                message: '上传主图中,请勿操作...',
                duration: -1
            });
            // uploadMainImage();
        }
        async function uploadMainImage() {
            if (app.step !== "AI_PUT_GOODS_INFO") return;

            const uploader = document.querySelector('.material-upload-button input');
            const { mainImages, baseInfo } = app.goodsInfo || { mainImages: [], baseInfo: {} };

            if (!(mainImages || []).length) return;
            const title = baseInfo?.title_info?.title;
            const safeTitle = baseInfo?.title_info?.safeTitle;
            mdLoadsh.simulateInput(document.querySelector('#pg-title-input'), title);

            const getBlobs = (mainImages || []).map(image => {
                return mdLoadsh.imageToBlob(image.url);
            });
            const blobs = await Promise.all(getBlobs);
            mdLoadsh.simulateUpload(uploader, blobs.map((blob, i) => {
                return { blob, name: `主图_${safeTitle.slice(0, 14)}_${i}.png` }
            }));
        }

        // 该行为极度危险
        function addSchemeRuleDangerLevel({ modifier }) {
            if (app.step !== 'ADD_GOODS_DRAFT_INFO') return;
            webHook.addRule({
                urlPattern: "addWithSchema",
                modifier
            });
            // try {
            //     chrome.runtime.sendMessage({
            //         cmd: 'inject',
            //         params: {
            //             type: 'eval',
            //             value: `__WEB_REQUEST_API__.addRule({
            //             urlPattern: "addWithSchema",
            //             modifier: ${modifier}
            //         });`
            //         }
            //     })
            // } catch (error) {
            // }
        }

        // 安全移除规则
        function removeSchemeRuleSafeLevel() {
            webHook.removeRule('addWithSchema');
            // chrome.runtime.sendMessage({
            //     cmd: 'inject',
            //     params: {
            //         type: 'eval',
            //         value: `__WEB_REQUEST_API__.removeRule('addWithSchema')`
            //     }
            // })
        }

        let skuAndSpecs = {};
        let goodsInfo = {
            categoryPath: [],
            likeCategroyPath: []
        }

        let uploadDetailImageCount = 0;

        async function updateDetailImage() {
            uploadDetailImageCount = 0;

            mdLoadsh.showToast({
                message: '上传详情图中,请勿操作...',
                duration: -1
            });
            const uploader = document.querySelector('.goods-publish-highlight-item input[type="file"]');
            const { detailImages, baseInfo } = app.goodsInfo || { detailImages: [], baseInfo: {} };
            const safeTitle = baseInfo?.title_info?.safeTitle;
            try {
                const getBlobs = (detailImages || []).filter(image => image.url_list && image.url_list[0]).map(image => {
                    return mdLoadsh.imageToBlob(image.url_list[0]);
                });
                const blobs = await Promise.all(getBlobs);
                mdLoadsh.simulateUpload(uploader, blobs.map((blob, i) => {
                    return { blob, name: `详图_${safeTitle.slice(0, 14)}_${i}.png` }
                }));
            } catch (error) {
            }
        }

        async function setCate() {
            const categoryIds = app.goodsInfo.categoryIds || [];
            const lastCid = categoryIds[categoryIds.length - 1];
            try {
                const cid = categoryIds[categoryIds.length - 2];
                const cateRes = await fetch(`https://fxg.jinritemai.com/product/tproduct/categoryOptionsN?cid=${cid}`, {});
                const cateJson = await cateRes.json();
                const item = cateJson.data.find(_ => _.id == lastCid) || {};
                const cateItemRes = await fetch(`https://fxg.jinritemai.com/product/tproduct/searchCategoryN?key=${item.name}`);
                const cateItemJson = await cateItemRes.json();
                const compareItem = cateItemJson.data[0];
                goodsInfo.categoryPath = ['first', 'second', 'third', 'fourth'].map(key => {
                    return compareItem[key + '_name'];
                }).filter(_ => _);
                validateGoodsCate();
            } catch (error) {
                
            }
        }

        async function validateGoodsCate() {
            const likeCategroyPath = goodsInfo.likeCategroyPath;
            // 不一致
            if (likeCategroyPath[likeCategroyPath.length - 1] != goodsInfo.categoryPath[goodsInfo.categoryPath.length - 1]) {
                const btns = document.querySelectorAll('.ecom-g-btn-link');
                const tuijianBtn = [...btns].find(_ => _.innerText == '更多推荐');
                const becopyDiv = tuijianBtn.previousElementSibling;
                const copyDiv = becopyDiv.cloneNode();
                copyDiv.innerText = `检测到榜单同商品类目: ${goodsInfo.categoryPath.join(' > ')}，非平台推荐`;
                copyDiv.style.color = '#ff3b52';
                becopyDiv.parentNode.insertBefore(copyDiv, becopyDiv);
                mdLoadsh.showToast({
                    message: '监测到平台推荐类目与榜单同品类目不一致，自行选择后点击【下一步】',
                    duration: -1
                });
                tuijianBtn.click();
            }
        }

        const api_hook = {
            'tshopuser/getContractTemplate': () => {
                uploadMainImage();
            },
            'refetchSchema?action=weight_unit_refresh': async (res, options = {}) => {
                setCate()

                if (app.step !== 'AI_PUT_GOODS_INFO') return;
                const btns = document.querySelectorAll('.ecom-g-btn');
                const nextBtn = [...btns].find(_ => _.innerText == '下一步');
                if (nextBtn) nextBtn.click();
            },
            'product/img/batchupload?_bid=ffa_goods|repeat': (res) => {
                if (app.step !== 'ADD_GOODS_DRAFT_INFO') return;
                if (uploadDetailImageCount == 0) {
                    const defaultDetailImgDelIcon = document.querySelector('[class*="styles_previewInstanceImgSortableList"] div[role="button"]:first-of-type [class*="styles_iconDelete"]');
                    defaultDetailImgDelIcon && defaultDetailImgDelIcon.click();
                    console.log(defaultDetailImgDelIcon, 'defaultDetailImgDelIcon');
                }
                uploadDetailImageCount = res.result.data.length + uploadDetailImageCount;
                if ((uploadDetailImageCount == app.goodsInfo.detailImages.length)) {
                    addSchemeRuleDangerLevel({
                        modifier: `(body) => {
            const skuAndSpecs = ${JSON.stringify(skuAndSpecs)};
            body.schema.model.sku_detail = skuAndSpecs.sku_detail;
            body.schema.model.spec_detail = skuAndSpecs.spec_detail;
            return body
            }`
                    });

                    const btns = document.querySelectorAll('.ecom-g-btn');
                    const saveBtn = [...btns].find(_ => _.innerText == '保存草稿');
                    saveBtn && saveBtn.click();
                }
            },
            'tproduct/addWithSchema': async (res) => {
                removeSchemeRuleSafeLevel();
                if (app.step !== 'ADD_GOODS_DRAFT_INFO') return;
                const data = res.result.data || {};
                await CR.commit('DOUYIN_GOODS2/RESET');
                if (!data.product_id) {
                    setTimeout(() => {
                        mdLoadsh.showToast({
                            message: '创建失败，请手动创建该商品!',
                            duration: -1
                        });
                    }, 800)
                    return
                };
                window.close();
                window.open(`https://fxg.jinritemai.com/ffa/g/create?product_id=${data.product_id}`)
            },
            'tproduct/predictCategoryN': (res) => {
                const data = res.result?.data?.candidate_category_details || [];
                const compareItem = data[0];
                const likeCategroyPath = ['first', 'second', 'third', 'fourth'].map(key => {
                    return compareItem[key + '_cname'];
                }).filter(_ => _);
                goodsInfo.likeCategroyPath = likeCategroyPath;
            },
            'tproduct/listProductTemplate': () => {
                if (app.step != 'ADD_GOODS_DRAFT_INFO') return;
                setTimeout(() => {
                    updateDetailImage();
                }, 60)
            },
            'tproduct/getSchema|repeat': async (res) => {
                const result = res.result;
                const items = result.data?.model?.spec_detail.items;
                const specDetail = result.data?.model?.spec_detail;
                skuAndSpecs = utils.parseSku(app.goodsInfo.skuInfo, items || [], specDetail);
                console.log(skuAndSpecs, items, 'items');
            },
        };

        window.addEventListener('message', function (event) {
            const { type, data } = event.data;
            if (type == 'WEB_REQUEST_RESPONSE') {
                const url = data ? data.url : '-';
                const regex = /^([^|]+)(?:\|([a-zA-Z]+))?$/;
                let action = '';
                const matchUrl = Object.keys(api_hook).find(matchUrl => {
                    const match = matchUrl.match(regex);
                    const [_, originUrl, matchAction] = match || [];
                    action = matchAction;
                    if (url.indexOf(originUrl) > -1) return true;
                });
                const hook = api_hook[matchUrl] || (() => { });
                if (!hook.isExec) {
                    hook(data, event.data);
                    action != 'repeat' && (hook.isExec = true);
                }
            }
        });

        window.addEventListener('click', async (e) => {
            if (e.target.closest('.ecom-g-btn') && e.target.innerText == '下一步') {
                await CR.commit('DOUYIN_GOODS2/SET_STEP', 'ADD_GOODS_DRAFT_INFO');
                app = await CR.get('DOUYIN_GOODS2');
            }
        });




    }

}

initApp();