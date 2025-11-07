
!function () {
    if (location.href.indexOf('https://qianchuan.jinritemai.com/creation/uni-prom-product') < 0) return;
    const initApp = () => {

        const insetCostInput = () => {
            if(document.querySelector('#costInputDiv')) return;
            const costInputDiv = document.createElement('div');
            costInputDiv.id = 'costInputDiv';

            const target = document.querySelector('#overAllRoiBlock');
            target.parentNode.insertBefore(costInputDiv, target.nextSibling);
            costInputDiv.innerHTML = `<div class='oc-row'>
                                            <div class='oc-title'>
                                                <div class='oc-title-prefix'>
                                                    <div class='oc-typography oc-typography-bold oc-typography-size-sm oc-typography-color-default oc-typography-type-paragraph oc-typography-span-undefined oc-title-text'>保本成本</div>
                                                </div>
                                            </div>
                                            <div class='oc-space oc-space-vertical'>
                                                <input style="background-color: #f4f4f5;height: 32px;padding: 4px 12px;border-radius: 3px;border: none;outline: none;" />
                                            </div>
                                        </div>`;
            costInputDiv.addEventListener('input', (e) => {
                const value = e.target.value;
                console.log('保本成本变化了', value);
            })


        }


        const api_hook = {
            'ad/api/creation/v1/audit/async-check-product|repeat': function (data) {
                console.log(data, fullData, '数据来了');
                const { url } = data;
                const [_, productid] = url.match(/.*product=([\d,]+)/) || [];
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
