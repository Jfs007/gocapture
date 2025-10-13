!function () {
    "use strict";

    /**
 *  await xlsx.setup();
 *  xlsx.design(columns, { name: 'Sheet1' }).sheet(data)
 *  xlsx.download('商品列表.xlsx');
 * 
 */
    function xlsxUltra() {
        let workbook = null;
        let sheetIndex = 0;
        let sheet = null;

        // 初始化空工作簿
        async function initWorkbook() {
            workbook = await XlsxPopulate.fromBlankAsync();

            // 添加一个临时 sheet（先占位）
            // const tempSheet = workbook.addSheet("temp");

            // 删除默认 sheet（只有在添加了新 sheet 后才安全）
            // workbook.deleteSheet("Sheet1");

            // 删除临时 sheet，真正的 sheet 会在 design 中创建
            // workbook.deleteSheet("temp");

            sheetIndex = 0;
        }

        // 创建一个 sheet 并填入表头结构
        function design(options = {}, columns) {
            const { sheetName } = options;
            if (!workbook) throw new Error("请先初始化 workbook");
            if (sheetIndex === 0) {
                // 第一次用默认 sheet，并改名
                sheet = workbook.sheet(0).name(sheetName);
            } else {
                // 后续添加新的 sheet
                sheet = workbook.addSheet(sheetName);
            }
            sheet._options = options;
            sheetIndex++;
            // 表头样式
            columns.forEach((col, colIndex) => {
                const cell = sheet.cell(1, colIndex + 1);
                cell.value(col.title).style({
                    bold: true,
                    fill: "D9D9D9",
                    horizontalAlignment: "center",
                    verticalAlignment: "center",
                    border: true
                });

                // 列宽
                if (col.wch) {
                    sheet.column(colIndex + 1).width(col.wch);
                }

            });

            const context = {
                sheet,
                columns,
                rowIndex: 2,
                input(data) {
                    const _options = sheet._options || {};
                    data.forEach((row) => {
                        columns.forEach((col, colIndex) => {
                            let value = "";
                            if (col.get) {
                                value = col.get(row);
                            } else if (col.key) {
                                value = loadsh.getProperty(row, col.key);
                            }

                            const cell = sheet.cell(context.rowIndex, colIndex + 1);
                            cell.value(value).style({
                                wrapText: true,
                                verticalAlignment: "top",
                                border: true
                            });

                        });
                        if (_options.hpx) {
                            sheet.row(context.rowIndex).height(_options.hpx)
                        }
                        context.rowIndex++;
                    });

                    // 设置下拉选项列
                    columns.forEach((col, colIndex) => {
                        if (col.options && Array.isArray(col.options)) {
                            const formula = '"' + col.options.join(',') + '"';
                            const range = sheet.range(
                                `${String.fromCharCode(65 + colIndex)}2:${String.fromCharCode(65 + colIndex)}${context.rowIndex - 1}`
                            );
                            range.dataValidation({
                                type: "list",
                                formula1: formula,
                                allowBlank: true,
                                showInputMessage: true
                            });
                        }
                    });

                    return context;
                }
            };
            return context;
        }

        // 下载文件
        async function download(filename = "导出.xlsx") {
            if (!workbook) throw new Error("没有 workbook 可导出");
            const blob = await workbook.outputAsync("blob");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // window.open(a.href, '_blank');
            workbook = null; // 清空
        }

        // 清空所有 sheet
        function empty() {
            workbook = null;
        }

        return {
            async setup() {
                try {
                    await initWorkbook();
                } catch (error) {
                    console.error('workbook失败');

                }

            },
            design,
            download,
            empty
        };
    }

    const xlsx = xlsxUltra();


    async function exportPlans(data) {
        await xlsx.setup();
        const columns = [
            { title: '商品名称', wch: 20, get(row) { return `${row.mainGoodsName}` } },
            { title: '商品价格', wch: 20, get(row) { return `${row.price3Label ? row.price3Label : '-'}` } },
            { title: '计划ID', wch: 20, get(row) { return `${row.id}` } },
            { title: '计划ID', wch: 20, get(row) { return `${row.id}` } },
            { title: '目标roi', wch: 14, get(row) { return `${row.ecpRoi2Goal}` } },
            { title: '整体消耗', wch: 14, get(row) { return `${row.statCostForRoi2?.value}` } },
            { title: '整体成交订单数', wch: 18, get(row) { return `${row.totalPayOrderCountForRoi2?.value}` } },
            { title: '整体成交金额', wch: 18, get(row) { return `${row.totalPayOrderGmvIncludeCouponForRoi2?.value}` } },
            { title: '整体支付ROI', wch: 18, get(row) { return `${row.totalPrepayAndPayOrderRoi2?.value}` } },
            { title: '整体成交订单成本', wch: 18, get(row) { return `${row.totalCostPerPayOrderForRoi2Primary?.value}` } },
            { title: '用户实际支付金额', wch: 18, get(row) { return `${row.totalPayOrderGmvForRoi2?.value}` } },
            { title: '电商平台补贴金额', wch: 18, get(row) { return `${row.totalEcomPlatformSubsidyAmountForRoi2Primary?.value}` } },
            { title: '保本成本', wch: 14, get(row) { return `${row.cost3 || ''}` } },
            { title: '运营预估盈亏', wch: 15, get(row) { return `${row.profit3 ? row.profit3.toFixed(2) : ''}` } },
            { title: '运营预估盈亏率', wch: 16, get(row) { return `${row.profitRate3 ? row.profitRate3.toFixed(2) : ''}` } },
        ];
        xlsx.design({ sheetName: 'Sheet12', hpx: 30 }, columns).input(data);
        xlsx.download('计划列表.xlsx');

    }

    const api = 'https://testad.itaored.com';
    async function getPlanInfo(params) {
        const mdChrome = _require("mdChrome");
        try {
            const res = await mdChrome.web.cmd({
                url: api + "/api/qc/campaign/report/iu/list",
                cmd: 'fetch',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(params)
            });
            // const json = await res.json();
            const info = {};
            (res.result.data || []).map(_ => {
                info[_.campaignId] = Object.assign(_, {
                    price: (_.campaignPrice || '').split('-'),
                    cost: _.campaignCost
                })
            });
            console.log('getPlanInfo:Success', info);
            return { data: info };

        } catch (error) {
            console.log('getPlanInfo:Error', error);
            return { data: {} }
        }

    }
    async function savePlanInfo0(params) {
        const mdChrome = _require("mdChrome");
        const res = await mdChrome.web.cmd({
            url: api + "/api/qc/campaign/report/iu/save",
            cmd: 'fetch',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(params)
        });
    }

    const initApp = async () => {
        console.log("🚀 千川站点初始化...");
        const mdChrome = _require("mdChrome");
        await Promise.all([
            // mdChrome.web.injectScript("cp_modules/store/index.js"),
            mdChrome.web.injectScript("cp_modules/web-hook/index.js")
        ]);

        const waits = { 'UserConfAndDataSetReady': false }
        let state = {
            list: [],
            pagination: { page: 0 },
            goodsInfoMaps: {},
            planInfo: {}
        }
        // 加载已保存的成本数据
        async function loadPlanInfo(params) {

            try {
                const { data } = await getPlanInfo(params);
                state.planInfo = Object.assign(state.planInfo, data);
            } catch (error) {
                console.log("加载成本数据失败:", error);
            }
        }

        // 保存成本
        async function savePlanInfo(adId, payload) {
            try {
                state.planInfo[adId] = Object.assign(state.planInfo[adId] || {}, payload);
                const plan = state.list.find(_ => _.id == adId) || {};
                savePlanInfo0({
                    campaignId: adId,
                    campaignName: plan.name,
                    accountCode: '-',
                    campaignPrice: payload.price ? payload.price.join('-') : undefined,
                    campaignCost: payload.cost
                })
            } catch (error) {
                console.error("保存成本失败:", error);
            }
        }

        // loadPlanInfo();

        function waitTableLoadingDisappear() {
            return new Promise((resolve) => {
                const container = document.querySelector('.table-container')
                if (!container) return resolve() // 容器都没了

                // 如果 loading 已经不存在，直接返回
                if (!container.querySelector('.loading')) {
                    return resolve()
                }
                const observer = new MutationObserver(() => {
                    if (!container.querySelector('.loading')) {
                        observer.disconnect()
                        resolve()
                    }
                })
                observer.observe(container, { childList: true, subtree: true })
            })
        }



        // 处理列表接口返回
        async function handleAdList(page, handleName) {
            alert('list长度' + state.list.length + handleName);
            if (!waits.UserConfAndDataSetReady) return;
            if (state.list.length == 0) {
                // waits.UserConfAndDataSetReady = false;
                return;
            }
            await loadPlanInfo({
                campaignIdList: state.list.map(_ => _.id)
            });
            
            if(state.pagination.page!=page && page) return;
            await waitTableLoadingDisappear();
            setTimeout(async () => {
                // 插入导出按钮
                insertExportButton();
                insertTableColumns(state.list);
            }, 120);
        }

        // 创建编辑按钮
        function createEditButton(adId, adInfo, options = {}) {
            const btn = document.createElement('span');
            btn.innerText = '编辑';
            btn.style.cssText = 'margin-left: 8px; color: #2a55e5; cursor: pointer; font-size: 12px;';
            btn.onclick = async (e) => {
                e.stopPropagation();
                const info = state.planInfo[adId] || {};
                const newValue = prompt(options.message, info[options.key] || '');
                if (newValue !== null && newValue !== '') {
                    const val = parseFloat(newValue);
                    if (!isNaN(val)) {
                        await savePlanInfo(adId, { [options.key]: val });
                        // 重新渲染该行数据
                        updateRowData(adId, adInfo);
                    } else {
                        alert('请输入有效的数字');
                    }
                }
            };
            return btn;
        }
        function createSyncPriceBtn(adId, adInfo, options = {}) {
            const btn = document.createElement('span');
            btn.innerText = '同步';
            btn.style.cssText = 'margin-left: 8px; color: #2a55e5; cursor: pointer; font-size: 12px;';
            btn.onclick = async (e) => {
                e.stopPropagation();
                const has = adInfo.aboutGoodsId.find(goodsId => goodsId == state.goodsInfoMaps[goodsId]);
                if (has) return;
                const product = document.querySelector(`[data-ad-id="${adId}"] .oc-promotion-product-adinfo-product-img-wrap-pop img`);
                product.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                setTimeout(() => { product.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })); }, 0)
            };
            return btn;
        }

        // 计算数据（纯函数，不涉及DOM操作）
        function calculateRowData(adInfo, payload = {}) {
            const { cost, price } = payload || {};
            const consume = parseFloat(adInfo.statCostForRoi2?.value) || 0; // 消耗
            const totalOrderCount = parseInt(adInfo.totalPayOrderCountForRoi2?.value) || 0; // 整体成交订单数
            // 运营预估盈亏 = 保本成本 × 整体成交订单数 - 消耗
            const profit = cost * totalOrderCount - consume;
            // 盈亏率 = (预估盈亏 / 消耗) × 100%
            const profitRate = consume > 0 ? (profit / consume) * 100 : 0;

            adInfo.profit3 = profit;
            adInfo.cost3 = cost;
            adInfo.profitRate3 = profitRate;
            adInfo.price3 = price;
            if (Array.isArray(price)) {
                adInfo.price3Label = price[0] != price[1] ? price.join('-') : price[0]
            }

            return {
                // price3Label,
                price,
                cost,
                consume,
                totalOrderCount,
                profit,
                profitRate
            };
        }

        // 渲染单行的三个自定义列（统一渲染逻辑）
        function renderCustomColumns(row, adInfo, computed) {
            let { cost, profit, profitRate, price } = computed;
            const adId = adInfo.id;

            // 渲染保本成本列
            const budgetTd = row.querySelector('td[data-md-custom="budget"]');
            if (budgetTd) {
                const inner = budgetTd.querySelector('.ovui-table-cell-inner');
                inner.innerHTML = '';
                const costSpan = document.createElement('span');
                costSpan.innerText = cost > 0 ? cost.toFixed(2) : '-';
                inner.appendChild(costSpan);
                inner.appendChild(createEditButton(adId, adInfo, {
                    message: '请输入保本成本:',
                    key: 'cost'
                }));
            }
            // 渲染运营预估盈亏列
            const costTd = row.querySelector('td[data-md-custom="cost"]');
            if (costTd) {
                const inner = costTd.querySelector('.ovui-table-cell-inner');
                if (cost > 0) {
                    const color = profit >= 0 ? '#52c41a' : '#ff4d4f';
                    inner.innerHTML = `<span style="color: ${color}">${profit.toFixed(2)}</span>`;
                } else {
                    inner.innerText = '-';
                }
            }
            // 渲染预估盈亏率列
            const balanceTd = row.querySelector('td[data-md-custom="balance"]');
            if (balanceTd) {
                const inner = balanceTd.querySelector('.ovui-table-cell-inner');
                if (cost > 0) {
                    const color = profitRate >= 0 ? '#52c41a' : '#ff4d4f';
                    inner.innerHTML = `<span style="color: ${color}">${profitRate.toFixed(2)}%</span>`;
                } else {
                    inner.innerText = '-';
                }
            }
            // 售价
            const PriceTd = row.querySelector('td[data-md-custom="price"]');
            if (PriceTd) {
                const inner = PriceTd.querySelector('.ovui-table-cell-inner');
                inner.innerHTML = '';
                const priceSpan = document.createElement('span');
                // price = Array.isArray(price) ? price.join('-') : price;
                if (Array.isArray(price)) {
                    price = price[0] != price[1] ? price.join('-') : price[0]
                }
                priceSpan.innerText = price ? price : '-';
                inner.appendChild(priceSpan);
                // inner.appendChild(createEditButton(adId, adInfo, {
                //     message: '请输入售价:',
                //     key: 'price'
                // }));
                inner.appendChild(createSyncPriceBtn(adId, adInfo, {}))
            }
        }

        // 更新单行数据（对外接口）
        function updateRowData(adId, adInfo) {
            const row = document.querySelector(`.ovui-tr[data-ad-id="${adId}"]`);
            if (!row) return;

            const payload = state.planInfo[adId] || {};
            const computed = calculateRowData(adInfo, payload);
            renderCustomColumns(row, adInfo, computed);
        }

        async function updateGoodsPrice(info = {}) {
            const { goodsId, price } = info;

            state.list.map(async adInfo => {
                if (!(adInfo.aboutGoodsId || []).find(id => id == goodsId)) return;
                const adId = adInfo.id;
                await savePlanInfo(adId, { price });
                updateRowData(adId, adInfo);
            })

        }
        // 插入导出按钮
        function insertExportButton() {
            const targetContainer = document.querySelector('.oc-more-filter-tile-body.tile-filter-body .title-item-suffix .oc-space');
            if (!targetContainer) {
                console.log('未找到导出按钮容器');
                return;
            }

            // 检查是否已经插入过
            if (targetContainer.querySelector('.export-plan-button')) {
                return;
            }

            // 创建按钮容器
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'oc-space-item export-plan-button';
            buttonWrapper.style.cssText = 'margin: 0 16px;width: auto;padding-left: 4px;padding-right: 4px;font-size: 12px;';
            // 创建按钮
            const exportButton = document.createElement('button');
            exportButton.className = 'ovui-button ovui-button--md ovui-button--square ovui-button--default ovui-button--default-fill ovui-button--fill oc-button-icon';
            exportButton.innerHTML = '<span>导出当前页计划</span>';
            exportButton.style.cssText = 'cursor: pointer;width: auto;padding-left: 6px;padding-right: 6px;font-size: 12px;';
            exportButton.onclick = async () => {
                if (state.list.length === 0) {
                    alert('当前页没有数据可导出');
                    return;
                }
                // 在导出前，先计算所有行的数据
                state.list.forEach(adInfo => {
                    const payload = state.planInfo[adInfo.id] || {};
                    calculateRowData(adInfo, payload);
                });

                exportButton.disabled = true;
                exportButton.innerHTML = '<span>导出中...</span>';

                try {
                    await exportPlans(state.list);
                } catch (error) {
                    console.error('导出失败:', error);
                    alert('导出失败，请查看控制台');
                } finally {
                    exportButton.disabled = false;
                    exportButton.innerHTML = '<span>导出当前页计划</span>';
                }
            };

            buttonWrapper.appendChild(exportButton);

            // 插入到第一个位置
            const firstItem = targetContainer.querySelector('.oc-space-item');
            if (firstItem) {
                targetContainer.insertBefore(buttonWrapper, firstItem);
            } else {
                targetContainer.appendChild(buttonWrapper);
            }

            console.log('✅ 导出按钮插入完成');
        }

        // 在表格中插入列
        function insertTableColumns(adInfos) {
            // 找到表头行
            const theadRow = document.querySelector('.ovui-thead .ovui-tr');
            const summaryRow = document.querySelector('.ovui-thead .ovui-tr.ovui-t-summary');
            const colRow = document.querySelector('.ovui-table__head-wrapper .ovui-table colgroup');

            if (!theadRow || !colRow || !summaryRow) {
                console.log("未找到表头行，稍后重试");
                return;
            }

            // 获取所有th，找到插入位置（第N个th后面）
            const thList = theadRow.querySelectorAll('th');
            const colList = colRow.querySelectorAll('col');
            const summaryThList = summaryRow.querySelectorAll('th');
            // 假设在第N个th后面插入（可根据需求调整）
            const insertIndex = 6;

            if (thList.length < insertIndex) {
                console.log("表头列数不足");
                return;
            }

            const targetTh = thList[insertIndex - 1];
            const targetCol = colList[insertIndex - 1];
            const targetSummaryTh = summaryThList[insertIndex - 1];

            // 检查是否已经插入过
            if (theadRow.querySelector('th[data-md-custom="budget"]')) {
                console.log("已经插入过自定义列");
                return;
            }
            // 计算插入位置的left值（累加前面所有col的宽度）
            let leftOffset = 0;
            for (let i = 0; i < insertIndex; i++) {
                const width = parseInt(colList[i].getAttribute('width')) || 0;
                leftOffset += width;
            }
            // 插入三个表头
            const headers = [
                { text: '保本成本', key: 'budget', width: 100 },
                { text: '运营预估盈亏', key: 'cost', width: 100 },
                { text: '运营预估盈亏率', key: 'balance', width: 100 },
                { text: '售价', key: 'price', width: 130 }
            ];
            let lastInsertedTh = targetTh;
            let lastInsertedCol = targetCol;
            let lastInsertedSummaryTh = targetSummaryTh;

            headers.forEach((header) => {
                const th = document.createElement('th');
                th.className = 'ovui-th ovui-table-cell ovui-table-cell--right ovui-th__no-left-border ovui-th__no-bottom-border';
                th.setAttribute('data-md-custom', header.key);
                th.innerHTML = `<div class="ovui-table-cell-inner">${header.text}</div>`;
                lastInsertedTh.insertAdjacentElement('afterend', th);
                lastInsertedTh = th;
                const col = document.createElement('col');
                col.setAttribute('width', header.width);
                lastInsertedCol.insertAdjacentElement('afterend', col);
                lastInsertedCol = col;

                // 统计行
                const summaryth = document.createElement('th');
                summaryth.className = 'ovui-t-summary-cell ovui-table-cell ovui-table-cell--right';
                summaryth.setAttribute('data-md-custom', header.key);
                lastInsertedSummaryTh.insertAdjacentElement('afterend', summaryth);
                lastInsertedSummaryTh = summaryth;
            });
            // 给每个tbody的tr插入td
            const tbody = document.querySelector('.ovui-tbody');
            const bodyColRow = document.querySelector('.ovui-table__body-wrapper .ovui-table colgroup');
            if (tbody) {
                // 先在tbody的colgroup中插入col
                if (bodyColRow) {
                    const bodyColList = bodyColRow.querySelectorAll('col');

                    if (bodyColList.length >= insertIndex) {
                        const targetBodyCol = bodyColList[insertIndex - 1];
                        let lastInsertedBodyCol = targetBodyCol;
                        headers.forEach((header) => {
                            const col = document.createElement('col');
                            col.setAttribute('width', header.width);
                            lastInsertedBodyCol.insertAdjacentElement('afterend', col);
                            lastInsertedBodyCol = col;
                        });
                        console.log('✅ tbody colgroup插入完成');
                    }
                } else {
                    console.log('❌ 未找到bodyColRow');
                }

                const rows = tbody.querySelectorAll('.ovui-tr');
                rows.forEach((row, rowIndex) => {
                    const adInfo = adInfos[rowIndex];
                    if (!adInfo) return;
                    const adId = adInfo.id;
                    // 给行添加标识
                    row.setAttribute('data-ad-id', adId);
                    const tdList = row.querySelectorAll('td');
                    if (tdList.length >= insertIndex) {
                        const targetTd = tdList[insertIndex - 1];
                        // 检查是否已经插入过
                        if (!row.querySelector('td[data-md-custom="budget"]')) {
                            // 重新计算left值
                            let tdLeftOffset = 0;
                            for (let i = 0; i < insertIndex; i++) {
                                const width = parseInt(colList[i].getAttribute('width')) || 0;
                                tdLeftOffset += width;
                            }

                            // 计算数据
                            const payload = state.planInfo[adId] || {};
                            const computed = calculateRowData(adInfo, payload);

                            let lastInsertedTd = targetTd;
                            headers.forEach((header) => {
                                const td = document.createElement('td');
                                td.className = 'ovui-td ovui-table-cell ovui-table-cell--right';
                                // td.style.left = `${tdLeftOffset}px`;
                                td.setAttribute('data-md-custom', header.key);

                                const inner = document.createElement('div');
                                inner.className = 'ovui-table-cell-inner';
                                td.appendChild(inner);

                                lastInsertedTd.insertAdjacentElement('afterend', td);
                                lastInsertedTd = td;
                            });

                            // 使用统一的渲染方法填充内容
                            renderCustomColumns(row, adInfo, computed);
                        }
                    }
                });
            }

            console.log("✅ 表格列插入完成");
        }


        // API钩子配置
        const api_hook = {
            "creation/v1/product/product-detail-info|repeat": (res) => {
                const { id, priceHigher, priceLower } = res?.result?.data?.productInfo || {};
                state.goodsInfoMaps[id] = [priceLower / 100, priceHigher / 100];
                updateGoodsPrice({
                    goodsId: id,
                    price: state.goodsInfoMaps[id]
                })
            },
            "ad/api/pmc/v1/uni-promotion/ad/list-optional|repeat": (res) => {

                const { adInfos, adStatsMap, pagination, adGoodsMap } = res?.result?.data || { adInfos: [], adStatsMap: {}, pagination: {} };
                console.log('%接口-list-optional' + adInfos.length + waits.UserConfAndDataSetReady, 'color: #00C853');
                if (state.pagination.page && (state.pagination.page != pagination.page)) {
                    waits.UserConfAndDataSetReady = false;
                };
                state.list = adInfos;
                state.list.map(_ => {
                    const stat = adStatsMap[_.id] || {};
                    _.mainGoodsName = ((adGoodsMap[_.id] || [])[0] || {}).name;
                    _.aboutGoodsId = (adGoodsMap[_.id] || []).map(_ => _.id);
                    _.totalPayOrderCountForRoi2 = stat?.metrics['totalPayOrderCountForRoi2'] || {};
                    _.statCostForRoi2 = stat?.metrics['statCostForRoi2'] || {};
                    _.totalPayOrderGmvIncludeCouponForRoi2 = stat?.metrics['totalPayOrderGmvIncludeCouponForRoi2'] || {};
                    _.totalPrepayAndPayOrderRoi2 = stat?.metrics['totalPrepayAndPayOrderRoi2'] || {};
                    _.totalCostPerPayOrderForRoi2Primary = stat?.metrics['totalCostPerPayOrderForRoi2Primary'] || {};
                    _.totalPayOrderGmvForRoi2 = stat?.metrics['totalPayOrderGmvForRoi2'] || {};
                    _.totalEcomPlatformSubsidyAmountForRoi2Primary = stat?.metrics['totalEcomPlatformSubsidyAmountForRoi2Primary'] || {};
                });
                state.pagination = pagination;

                // console.log(state.list, 'state.list');
                handleAdList(page, 'list-optional');
            },
            "standard/get_summary_info|repeat": (res) => {
                console.log('%接口-getUserConfAndDataSet', 'color: #00C853');
                waits.UserConfAndDataSetReady = true;
                handleAdList(state.pagination.page, 'getUserConfAndDataSet');
            }
        };

        // 监听请求响应
        window.addEventListener("message", function (event) {
            const { type, data } = event.data;
            if (type === "WEB_REQUEST_RESPONSE") {
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
                    action != 'repeat' && (hook.isExec = true);
                    hook(data, event.data);
                }

            }
        });

        console.log("✅ 千川站点初始化完成");
    };

    initApp();
}()