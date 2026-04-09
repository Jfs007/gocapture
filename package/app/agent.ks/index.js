!async function () {

    const href = location.href;
    const mdChrome = _require('mdChrome');
    const search = new URLSearchParams(window.location.search);
    let AUTH_REDIREURL = search.get('AUTH_REDIREURL');
    const redirectUrl = search.get('redirectUrl') || '';
    const search2patch = new URLSearchParams(redirectUrl.split("?")[1]);
    AUTH_REDIREURL = AUTH_REDIREURL || search2patch.get('AUTH_REDIREURL');
    if (AUTH_REDIREURL) {
        // console.log('HELLO KS');
        const res = await fetch('https://jinfu.e.kuaishou.com/rest/dsp/agent/infov2', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const result = await res.json();
        const redirectUrlSearch = ((AUTH_REDIREURL || '').replaceAll('@', '&').replace('&', '?'));
        const [_, agentId] = redirectUrlSearch.match(/agentId=(\d*)/) || [];
        try {

            const data = result?.data;
            if (!Array.isArray(data)) return;
            const agent = data.find(agent => agent.agentId == agentId) || {};
            if (href.indexOf('jinfu.e') > -1) {
                const rhref = `https://niu.e.kuaishou.com/` + (redirectUrlSearch.replace('AGENTUSERID', agent.agentUserId || ''));
                console.log('AUTH_REDIREURL', rhref);
                window.location.href = rhref;
            }
            // console.log('dsp/agent/extra/info', result);


        } catch (error) {
            console.error('agent.ks error', error);
        }

    }



    // __WEB_REQUEST_API__.onResponse(({ url, result, request, method, modified }) => {


    // });



   

    if (href.indexOf('https://niu.e.kuaishou.com/') > -1) {
        // 实现一个悬浮按钮 ，量多多授权，蓝色风格
        const btn = document.createElement('button');
        btn.textContent = '量多多授权';
        btn.style.position = 'fixed';
        btn.id = 'ldd-niu-auth-btn';
        btn.style.top = '20px';
        btn.style.right = '20px';
        btn.style.zIndex = '9999';
        btn.style.backgroundColor = '#007bff';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.padding = '10px 20px';
        btn.style.borderRadius = '5px';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => {
            window.location.href = 'https://niu.e.kuaishou.com/?LDD_NIU_AUTH=1';
        });
        document.body.appendChild(btn);
        console.log(btn, 'btndsdsds');
    }

     if (href.indexOf('niu.e') > -1) {
        try {
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

        } catch (error) {

        }

    }


}()