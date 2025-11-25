!function () {

    if (location.href.indexOf('https://business.oceanengine.com/site/index') < 0) return;
    const mdChrome = _require("mdChrome");
    setTimeout(() => {
        const uerid = localStorage.getItem('__Garfish__bp-web____tea_cache_tokens_1892');
        console.log(uerid, 'userid');
        // __Garfish__bp-web____tea_cache_tokens_1892
        // if (location.href === 'https://business.oceanengine.com/brand/index' || location.href.indexOf('https://business.oceanengine.com/site/index') > -1) {
        mdChrome.web.cmd({
            cmd: 'openPopup'
        });

        // console.log(JSON.parse(token || '{}'), 'ldd-token');

    }, 1200);



}()