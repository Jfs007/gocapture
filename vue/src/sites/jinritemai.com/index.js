
import App from "./components/app.vue";
import Publish from './publish';
import Move from './move';
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
    const { createBaseApp } = MdUiComponent.Components;
    const app = createBaseApp(App, {
        options: {
            id: 'jinritemai-floating-toolbox',
            style: 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;'
        }
    });
    document.body.appendChild(app.__el__);
    if(HAOHUO_HREF.indexOf('https://haohuo.jinritemai.com/') >= 0) return Move();
    if(HAOHUO_HREF.indexOf('https://fxg.jinritemai.com/ffa/g/create') >= 0) return Publish();
}

initApp();