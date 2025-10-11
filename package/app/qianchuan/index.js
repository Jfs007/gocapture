!function () {
    "use strict";
    const initApp = async () => {
        console.log("🚀 千川站点初始化...");
        const mdChrome = _require("mdChrome");
        await mdChrome.web.injectScript("cp_modules/web-hook/index.js");

        // 处理列表接口返回
        function handleAdList(res) {
            const adInfos = res?.result?.data?.adInfos || [];
            console.log("📊 广告列表数据:", adInfos);

            setTimeout(() => {
                insertTableColumns(adInfos.length);
            }, 600);
        }

        // 在表格中插入列
        function insertTableColumns(rowCount) {
            // 找到表头行
            const theadRow = document.querySelector('.ovui-thead .ovui-tr');
            const summaryRow = document.querySelector('.ovui-thead .ovui-tr.ovui-t-summary');
            const summaryRowTh = document.querySelector('.ovui-thead .ovui-tr.ovui-t-summary > th:first-child');

            if (!theadRow) {
                console.log("未找到表头行，稍后重试");
                return;
            }

            // 获取所有th，找到插入位置（第N个th后面）
            const thList = theadRow.querySelectorAll('th');
            // 假设在第3个th后面插入（可根据需求调整）
            const insertIndex = 3;

            if (thList.length < insertIndex) {
                console.log("表头列数不足");
                return;
            }

            const targetTh = thList[insertIndex - 1];

            // 检查是否已经插入过
            if (theadRow.querySelector('th[data-md-custom="budget"]')) {
                console.log("已经插入过自定义列");
                return;
            }

            // 插入三个表头
            const headers = [
                { text: '预算', key: 'budget' },
                { text: '成本', key: 'cost' },
                { text: '余额', key: 'balance' }
            ];

            headers.forEach((header, index) => {
                const th = document.createElement('th');
                th.className = 'ovui-th ovui-th--sticky ovui-th--sticky-left ovui-table-cell ovui-table-cell--left ovui-th__no-left-border ovui-th__no-bottom-border';
                th.setAttribute('data-md-custom', header.key);
                th.innerHTML = `<div class="ovui-table-cell-inner">${header.text}</div>`;
                targetTh.insertAdjacentElement('afterend', th);

                // 如果有汇总行，也要插入
                if (summaryRow) {
                    return;
                    const summaryTh = document.createElement('th');
                    summaryTh.className = 'ovui-table-cell';
                    summaryTh.setAttribute('data-md-custom', header.key);
                    summaryTh.innerHTML = `<div class="ovui-table-cell-inner">-</div>`;
                    const summaryThList = summaryRow.querySelectorAll('th');
                    if (summaryThList[insertIndex - 1]) {
                        summaryThList[insertIndex - 1].insertAdjacentElement('afterend', summaryTh);
                    }
                }
            });
            if (summaryRowTh) {
                const colspan = +(summaryRowTh.getAttribute('colspan'))
                summaryRowTh.setAttribute('colspan', colspan + headers.length);
            }

            // 给每个tbody的tr插入td
            const tbody = document.querySelector('.ovui-tbody');
            if (tbody) {
                const rows = tbody.querySelectorAll('.ovui-tr');
                rows.forEach((row, rowIndex) => {
                    if (rowIndex < rowCount) {
                        const tdList = row.querySelectorAll('td');
                        if (tdList.length >= insertIndex) {
                            const targetTd = tdList[insertIndex - 1];
                            // 检查是否已经插入过
                            if (!row.querySelector('td[data-md-custom="budget"]')) {
                                headers.forEach((header) => {
                                    const td = document.createElement('td');
                                    td.className = 'ovui-td ovui-td--sticky ovui-table-cell ovui-table-cell--left';
                                    td.setAttribute('data-md-custom', header.key);
                                    td.innerHTML = `<div class="ovui-table-cell-inner">-</div>`;
                                    targetTd.insertAdjacentElement('afterend', td);
                                });
                            }
                        }
                    }
                });
            }

            console.log("✅ 表格列插入完成");
        }

        // API钩子配置
        const api_hook = {
            "ad/api/pmc/v1/uni-promotion/ad/list-optional": (res) => {
                handleAdList(res);
            }
        };

        // 监听请求响应
        window.addEventListener("message", function (event) {
            const { type, data } = event.data;
            if (type === "WEB_REQUEST_RESPONSE") {
                const url = data ? data.url : "";
                const matchUrl = Object.keys(api_hook).find((pattern) => {
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

        console.log("✅ 千川站点初始化完成");
    };

    initApp();
}()