

import Publish from './publish';
import Move from './move';
const initApp = async () => {
    const HAOHUO_HREF = location.href;
    // 获取mdChrome依赖  
    const mdChrome = _require('mdChrome');
    await Promise.all([
        mdChrome.web.injectScript('cp_modules/store/index.js'),
        mdChrome.web.injectScript('cp_modules/loadsh/index.js'),
        mdChrome.web.injectScript('cp_modules/web-hook/index.js'),
    ])
    // 获取依赖
    const CR = _require('chromeRedux');
    // // 初始化ChromeRedux状态管理
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
    if(HAOHUO_HREF.indexOf('https://haohuo.jinritemai.com/') >= 0) return Move();
    if(HAOHUO_HREF.indexOf('https://fxg.jinritemai.com/ffa/g/create') >= 0) return Publish();
}

initApp();