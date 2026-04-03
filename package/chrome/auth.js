!async function () {
    // const url = window.location.href;
    const mdChrome = _require('mdChrome');
    
    // if (url && url.indexOf('__LDD_EXTENSIONS_AUTH__') === -1) return;
    const manifest = await mdChrome.web.cmd({ cmd: "get-manifest" });
    if((manifest && manifest.env && manifest.env.api) !== (window.location.origin + '/')){
        return;
    }
    const id = Date.now() + Math.random() + ':md.local.set';

    const tokenInfo = JSON.parse(localStorage.getItem("TOKEN") || '{}');
    const token = tokenInfo.value;
    window.postMessage({
        sender: { id, name: 'web-page' },
        params: [{ ['accessToken']: token }],
        cmd: "chrome",
        call: 'storage.local.set'
    }, "*");

}()