!function () {

    if (location.href.indexOf('https://business.oceanengine.com/site/index') < 0) return;
    const mdChrome = _require("mdChrome");
    setTimeout(() => {
        // if (location.href === 'https://business.oceanengine.com/brand/index' || location.href.indexOf('https://business.oceanengine.com/site/index') > -1) {
        mdChrome.web.cmd({
            cmd: 'openPopup'
        })
        // }
        // auth.doAuth({ host: 'business.oceanengine.com', value: getUserInfo() });

    }, 1200)

}()