!function () {
    if (location.href.indexOf('https://agent.oceanengine.com/') === -1) return;
    const mdChrome = _require("mdChrome");
    function changeAccount(e) {
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();
        mdChrome.web.cmd({ cmd: 'changeAccount', origins: ["https://agent.oceanengine.com", "https://oceanengine.com", "https://api.feelgood.cn"] },);
        window.location.href = 'https://agent.oceanengine.com/login';
    }
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        if (target.innerText.indexOf('退出登录') > -1) {
            changeAccount(e);
        }
    }, true);
}();

!function () {
    if (location.href.indexOf('https://agent.oceanengine.com/agent/redirect/ad') === -1) return;
    // if(window)
    setTimeout(() => {
        window.location.href = 'https://agent.oceanengine.com/login';
    }, 900);

}();

