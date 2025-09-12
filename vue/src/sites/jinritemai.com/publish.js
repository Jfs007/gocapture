const App = async () => {
    const loadsh = _require('loadsh');
    const CR = _require('chromeRedux');
    const webHook = _require('webHook');
    let app = await CR.get('DOUYIN_GOODS2');
    // await CR.commit('DOUYIN_GOODS2/SET_STEP', 'AI_PUT_GOODS_INFO');
    if (app.step == "AI_PUT_GOODS_INFO") {
        loadsh.showToast({
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
        loadsh.simulateInput(document.querySelector('#pg-title-input'), title);

        const getBlobs = (mainImages || []).map(image => {
            return loadsh.imageToBlob(image.url);
        });
        const blobs = await Promise.all(getBlobs);
        loadsh.simulateUpload(uploader, blobs.map((blob, i) => {
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

        loadsh.showToast({
            message: '上传详情图中,请勿操作...',
            duration: -1
        });
        const uploader = document.querySelector('.goods-publish-highlight-item input[type="file"]');
        const { detailImages, baseInfo } = app.goodsInfo || { detailImages: [], baseInfo: {} };
        const safeTitle = baseInfo?.title_info?.safeTitle;
        try {
            const getBlobs = (detailImages || []).filter(image => image.url_list && image.url_list[0]).map(image => {
                return loadsh.imageToBlob(image.url_list[0]);
            });
            const blobs = await Promise.all(getBlobs);
            loadsh.simulateUpload(uploader, blobs.map((blob, i) => {
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
            loadsh.showToast({
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
                    loadsh.showToast({
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
export default App;