!async function () {
    // if (window.top !== window.self) return;
    const mdChrome = _require('mdChrome');
    const common = mdChrome.web.common;
    // 使用示例：为 iframe 创建包裹器
    const manifest = await mdChrome.web.cmd({ cmd: "get-manifest" });
    const tokenInfo = JSON.parse(localStorage.getItem("TOKEN") || '{}');
    const token = tokenInfo.value;
    if (!token) return;

    const { env, site } = manifest.env || {};
    const iframe = document.createElement("iframe");
    iframe.src = `${site}?env=${env}&token=${token}&t=${Date.now()}`;
    common.createDraggableCollapsibleWrapper(iframe, {
        env,
        title: '线索采集器',
        width: '500px',
        height: '480px',
        position: { top: '20px', right: '20px' }
    });





    // 导出到全局，供其他地方使用
    // common.createDraggableCollapsibleWrapper = createDraggableCollapsibleWrapper;

}()