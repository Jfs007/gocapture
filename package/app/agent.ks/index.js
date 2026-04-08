!function () {
    const href = location.href;
    // const mdChrome = _require('mdChrome');
    const search = new URLSearchParams(window.location.search);
    console.log('__WEB_REQUEST_API__', window.__WEB_REQUEST_API__);
   
    __WEB_REQUEST_API__.onResponse(({ url, result, request, method, modified }) => {
        const AUTH_REDIREURL = search.get('AUTH_REDIREURL');
        const redirectUrlSearch = ((AUTH_REDIREURL || '').replaceAll('@', '&').replace('&', '?'));
        const [_, agentId] = redirectUrlSearch.match(/agentId=(\d*)/) || [];
         console.log('dsp/agent/extra/infomatxh', _, agentId, result);
        try {
             if (url.indexOf('dsp/agent/extra/info') > -1) {
            
            const data = result?.data;
            const agent = data.find(agent => agent.agentId == agentId) || {};
            if (href.indexOf('jinfu.e') > -1) {
                const AUTH_REDIREURL = search.get('AUTH_REDIREURL');
                if (!AUTH_REDIREURL) return;
                const rhref = `https://niu.e.kuaishou.com/` + (redirectUrlSearch.replace('AGENTUSERID', agent.agentUserId || ''));
                console.log('AUTH_REDIREURL', rhref);
                window.location.href = rhref;
            }
            // console.log('dsp/agent/extra/info', result);
        }
            
        } catch (error) {
            console.error('agent.ks error', error);
        }
       
    });
    


    if (href.indexOf('niu.e') > -1) {
        const AUTH = search.get('LDD_NIU_AUTH');
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
    }

}()