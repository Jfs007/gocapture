!function () {
    // const mdChrome = _require('mdChrome');
    console.log("HELLO AGENT>KS");
    const search = new URLSearchParams(window.location.search);
    const AUTH = search.get('LDD_NIU_AUTH');
    console.log(AUTH, 'auth ks');
    if (AUTH != 1) return;

    const xpath = `//*[@id="root"]/section/section/main/div/div[1]/div[2]/div[2]`;
    const btn = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    ).singleNodeValue
    btn?.click()


}()