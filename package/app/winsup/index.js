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
    console.log(authType, 'at');
    if (authType != 'token') return;
    
    const id = Date.now() + Math.random() + ':md.local.set';
    const tokenInfo = JSON.parse(localStorage.getItem("WINSUP_TOKEN") || '{}');
    const token = tokenInfo.value;
    window.postMessage({
        sender: { id, name: 'web-page' },
        params: [{ ['WinSupAccessToken']: token }],
        cmd: "chrome",
        call: 'storage.local.set'
    }, "*");
    mdChrome.web.send('getToken', {
        token
    });
    window.close();


}()