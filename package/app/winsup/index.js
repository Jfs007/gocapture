!function () {
    /**
     *  逻辑监听 mdChrome.web.once('getToken', () => {
     * 
     * 
     *  })
     * 
     * 
     */

    const mdChrome = _require('mdChrome');
    const search = new URLSearchParams(window.location.search);
    const authType = search.get('__AUTH_TYPE__');
    if(authType!= 'token') return;
    mdChrome.web.once('getToken', () => {
        const id = Date.now() + Math.random() + ':md.local.set';
        const tokenInfo = JSON.parse(localStorage.getItem("WINSUP_TOKEN") || '{}');
        const token = tokenInfo.value;
        window.postMessage({
            sender: { id, name: 'web-page' },
            params: [{ ['WinSupAccessToken']: token }],
            cmd: "chrome",
            call: 'storage.local.set'
        }, "*");
        window.close();
    });

}()