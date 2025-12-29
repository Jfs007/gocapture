!function () {
    if (location.href.indexOf('https://agent.oceanengine.com/') === -1) return;
    function changeAccount(e) {
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();
        mdChrome.web.cmd({ cmd: 'changeAccount', origins: ["https://agent.oceanengine.com", "https://oceanengine.com", "https://api.feelgood.cn"] },);
    }
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        if (target.innerText.indexOf('退出登录') > -1) {
            changeAccount(e);
        }
    }, true);
}()