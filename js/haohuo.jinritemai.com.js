!function () {
    // 初始化
    const CR = _require('chromeRedux');
    const DOUYIN_GOODS = {
        state: {
            goodsInfo: {
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
                console.log('SET_GOODS_INFO: ------', payload, state.goodsInfo);
            },

            SET_STEP(state, payload) {
                state.step = payload || 'PRE_GET_GOODS_INFO';
            }


        }
    }
    CR.registerModule('DOUYIN_GOODS2', DOUYIN_GOODS);
    CR.init();
}();

// https://fxg.jinritemai.com/ffa/g/create
const HAOHUO_HREF = location.href;
const HAOHUO_HREF_PARAMS = new URLSearchParams(window.location.search);
(function () {
    const mdChrome = _require('mdChrome');
    mdChrome.web.injectScript('hack_scripts/web-request.js');


    // setTimeout(() => {
    //     chrome.runtime.sendMessage({
    //         cmd: "webRequest.addRule",
    //         rule: {
    //             urlPattern: "addWithSchema",
    //             modifier: (bodyData) => {
    //                 bodyData.schema.model.sku_detail = sku_detail;
    //                 bodyData.schema.model.spec_detail = spec_detail;
    //                 return bodyData;
    //             }
    //         }
    //     });
    // })


})();
// https://haohuo.jinritemai.com/
(function () {
    if (HAOHUO_HREF.indexOf('https://haohuo.jinritemai.com/') < 0) return;
    const mdLoadsh = _require('mdLoadsh');
    const CR = _require('chromeRedux');
    async function setBaseInfo(res) {
        const mediaList = mdLoadsh.getProperty(res.result, 'promotion_h5.head_figure_data.media_list');
        const basicInfoData = mdLoadsh.getProperty(res.result, 'promotion_h5.basic_info_data') || {};
        const imageList = (mediaList || []).find(_ => _.type == 'image') || {};
        const mainImages = (imageList.content_list || []);
        console.log('mainImages,', mainImages, res);
        try {
            await CR.commit('DOUYIN_GOODS2/SET_GOODS_INFO', {
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
            console.log('api_hook/saas/pc', error);

        }


    }
    const api_hook = {
        'v2/shop/promotion/pack/h5': setBaseInfo,
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
                console.log('api_hook', error);
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
        'product/detail/saas/pc': setBaseInfo
    }
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        // console.log(msg, 'dsadfasdfas', msg.url);
        if (msg.cmd === "response_info") {
            const data = msg.data;
            const url = msg.url || '-';
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
                hook(data);
                action != 'repeat' && (hook.isExec = true);
            }

        }

    });

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



})();
// https://fxg.jinritemai.com
(async function () {

    if (HAOHUO_HREF.indexOf('https://fxg.jinritemai.com/ffa/g/create') < 0) return;

    const CR = _require('chromeRedux');
    const mdLoadsh = _require('mdLoadsh');
    const utils = _require('fxg.jinritemai.com.utils');
    let app = await CR.get('DOUYIN_GOODS2');

    // await CR.commit('DOUYIN_GOODS2/SET_STEP', 'AI_PUT_GOODS_INFO');
    if (app.step == "AI_PUT_GOODS_INFO") {
        mdLoadsh.showToast({
            message: '上传主图中',
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
    // let CHROME_WEB_REQUEST_SCRIPTS = null;
    let __WEB_REQUEST_API__ = {};
    // const CHROME_WEB_REQUEST_SCRIPTS = document.querySelector(`#CHROME_WEB_REQUEST_SCRIPTS`);
    // const __WEB_REQUEST_API__ = CHROME_WEB_REQUEST_SCRIPTS ? CHROME_WEB_REQUEST_SCRIPTS.__WEB_REQUEST_API__ : {};
    // console.log(CHROME_WEB_REQUEST_SCRIPTS, 'CHROME_WEB_REQUEST_SCRIPTS');

    // 该行为极度危险
    function addSchemeRuleDangerLevel() {

        return;
        if (app.step !== 'ADD_GOODS_DRAFT_INFO') return;

        __WEB_REQUEST_API__.addRule({
            urlPattern: "addWithSchema",
            modifier: (bodyData) => {
                const sku_detail = {
                    "value": [
                        {
                            "id": "a2bff75f3699-b96f75-9dd998f1d26c",
                            "stock_info": {
                                "stock_num": 0
                            },
                            "sku_status": true,
                            "confirm_no_barcode": false,
                            "spec_detail_ids": [
                                "-996662214245076355"
                            ],
                            "spec_price_unit_info": [
                                {
                                    "correction_type": 0,
                                    "is_updated": false,
                                    "property_name": "件数",
                                    "value_name": "3瓶"
                                },
                                {
                                    "correction_type": 0,
                                    "is_updated": false,
                                    "property_name": "总净含量",
                                    "value_name": "810g"
                                }
                            ],
                            "price": "39.9"
                        },
                        {
                            "id": "bcaefa0e2da1-956a79-b939f6d4441a",
                            "stock_info": {
                                "stock_num": 0
                            },
                            "sku_status": true,
                            "confirm_no_barcode": false,
                            "spec_detail_ids": [
                                "997852115074171730"
                            ],
                            "spec_price_unit_info": [
                                {
                                    "correction_type": 0,
                                    "is_updated": false,
                                    "property_name": "件数",
                                    "value_name": "1瓶"
                                },
                                {
                                    "correction_type": 0,
                                    "is_updated": false,
                                    "property_name": "总净含量",
                                    "value_name": "270g"
                                }
                            ],
                            "price": "28.9"
                        }
                    ]
                };

                const spec_detail = {
                    "value": [
                        {
                            // "cp_id": 3164,
                            "id": "-10000",
                            "name": "套餐类型",
                            "spec_values": [
                                {
                                    "id": "-996662214245076355",
                                    "name": "【买二加一 大半年用量】270g*3瓶",
                                    "measure_info": {
                                        // "template_id": 98,
                                        "values": [
                                            {
                                                "module_id": -155,
                                                "prefix": "",
                                                "suffix": "",
                                                "value": "【买二加一 大半年用量】"
                                            },
                                            {
                                                "module_id": -156,
                                                "prefix": "",
                                                "suffix": "*",
                                                "value": "270",
                                                // "unit_id": 2,
                                                "unit_name": "g"
                                            },
                                            {
                                                "module_id": -157,
                                                "prefix": "",
                                                "suffix": "",
                                                "value": "3",
                                                // "unit_id": 118,
                                                "unit_name": "瓶"
                                            }
                                        ]
                                    },
                                    "invalid": false,
                                    "img_url": "https://p3-aio.ecombdimg.com/obj/ecom-shop-material/webp_m_abe6ce6b50b24eed36b3c496479ff396_sx_65552_www800-800"
                                },
                                {
                                    "id": "-997852115074171730",
                                    "name": "【贵在运费】270g*1瓶",
                                    "measure_info": {
                                        // "template_id": -98,
                                        "values": [
                                            {
                                                "module_id": -155,
                                                "prefix": "",
                                                "suffix": "",
                                                "value": "【贵在运费】"
                                            },
                                            {
                                                "module_id": -156,
                                                "prefix": "",
                                                "suffix": "*",
                                                "value": "270",
                                                "unit_id": 2,
                                                "unit_name": "g"
                                            },
                                            {
                                                "module_id": -157,
                                                "prefix": "",
                                                "suffix": "",
                                                "value": "1",
                                                "unit_id": 118,
                                                "unit_name": "瓶"
                                            }
                                        ]
                                    },
                                    "invalid": false,
                                    "img_url": "https://p3-aio.ecombdimg.com/obj/ecom-shop-material/png_m_4da83a62ae28301394bfbd172c25b3e9_sx_41869_www300-300"
                                }
                            ]
                        }
                    ]
                }
                bodyData.schema.model.sku_detail = sku_detail;
                bodyData.schema.model.spec_detail = spec_detail;

                return bodyData;
            }
        });
    }
    // 
    function removeSchemeRuleSafeLevel() {
        return;
        __WEB_REQUEST_API__.removeRule('addWithSchema')
    }



    const api_hook = {
        'tshopuser/getContractTemplate': () => {
            uploadMainImage();
        },
        'refetchSchema?action=spec_price_unit_predict_for_title_and_spec': async () => {
            const btns = document.querySelectorAll('.ecom-g-btn');
            const nextBtn = [...btns].find(_ => _.innerText == '下一步');
            await CR.commit('DOUYIN_GOODS2/SET_STEP', 'ADD_GOODS_DRAFT_INFO');
            app = await CR.get('DOUYIN_GOODS2');
            addSchemeRuleDangerLevel();
            if (nextBtn) nextBtn.click();


        },
        'tproduct/addWithSchema': () => {
            removeSchemeRuleSafeLevel();
        },
        'tproduct/getSchema': (res) => {
            const result = res.result;
            const items = result.data?.model?.spec_detail.items;
            const skuAndSpecs = utils.parseTToSku(app.goodsInfo.skuInfo, items || []);

        }


    };
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

    // window.addEventListener('click', (e) => {
    //     if(e.target.closest('.next-btn.next-medium.next-btn-primary') && e.target.innerText == '下一步') {

    //     }
    // })


})();