
!function () {
    if (location.href.indexOf('https://qianchuan.jinritemai.com/creation/uni-prom-product') < 0) return;
    const api = 'https://ad.itaored.com';
    const initApp = () => {
        const mdChrome = _require("mdChrome");
        const info = {
            productId: null,
            campaignCost: null
        };

        const insetCostInput = async () => {
            try {
                const res = await mdChrome.web.cmd({
                    url: api + "/api/qc/campaign/report/iu/list/product",
                    cmd: 'fetch',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        productIdList: [info.productId],
                    })
                });
                (res.result.data || []).map(_ => {
                    info.campaignCost = _.campaignCost;
                    costInputDivInput.value = _.campaignCost || '';
                });

            } catch (error) {
                console.log('获取保本成本失败', error);

            }

            if (document.querySelector('#costInputDiv')) return;
            const costInputDiv = document.createElement('div');
            costInputDiv.id = 'costInputDiv';
            // const target = document.querySelector('#overAllRoiBlock');

            const target = document.querySelector('.creation-suggest-budget-input');
            target.style.display = 'flex';
            target.appendChild(costInputDiv);
            costInputDiv.innerHTML = `<div class='oc-row' style='margin-left: 6px;'>
                                            <div class='oc-title'>
                                                <div class='oc-title-prefix'>
                                                    <div class='oc-typography oc-typography-bold oc-typography-size-sm oc-typography-color-default oc-typography-type-paragraph oc-typography-span-undefined oc-title-text'>保本成本</div>
                                                </div>
                                            </div>
                                            <div class='oc-space oc-space-vertical' style='margin-top: 8px;'>
                                                <input id="costInputDivInput" placeholder='请输入保本成本' style="font-size: 18px;background-color: #f4f4f5;height: 44px;padding: 5px 16px;border-radius: 3px;border: none;outline: none;max-width: 160px;" />
                                            </div>
                                        </div>`;

                                      
            const costInputDivInput = document.querySelector('#costInputDivInput');
            if (info.campaignCost) {
            
                costInputDivInput.value = info.campaignCost;
            }

            costInputDiv.addEventListener('input', (e) => {
                let value = e.target.value;
                // e.target.value = value.replace(/[^\d]/g, '');
                // value = e.target.value;
                console.log('保本成本变化了', value);
            });

            costInputDivInput.addEventListener('blur', async (e) => {
                let value = e.target.value;
                console.log('保本成本最终值', value);
                try {
                    const res = await mdChrome.web.cmd({
                        url: api + "/api/qc/campaign/report/iu/save/product",
                        cmd: 'fetch',
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        data: JSON.stringify({
                            productId: info.productId,
                            campaignCost: value,
                        })
                    });
                } catch (error) {

                }
                // 保存
            })


        }


        const api_hook = {
            'ad/api/creation/v1/audit/async-check-product|repeat': function (data) {
                console.log(data, '数据来了');
                const { url } = data;
                const [_, productid] = url.match(/.*product=([\d,]+)/) || [];
                info.productId = productid;
                productid && insetCostInput();

            }
        }



        function listenMessage(event) {
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

        };
        // 监听请求响应
        window.addEventListener("message", listenMessage);

    }
    initApp();
}()
