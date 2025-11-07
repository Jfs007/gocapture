
!function () {
    if (location.href.indexOf('https://qianchuan.jinritemai.com/creation/uni-prom-product') < 0) return;
    const initApp = () => {


        const api_hook = {
            'ad/api/creation/v1/audit/async-check-product|repeat': function (data, fullData) {
                console.log(data, fullData, '数据来了');
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
