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
        const widget = document.createElement('div');
        widget.id = 'ldd-niu-auth-widget';
        widget.innerHTML = `
            <div style="text-align: center;">
                <img src="https://cdn.itaored.com/static/fed/testldd-pro-chrome-plugin/app/icon.png" 
                     alt="量多多授权" 
                     referrerpolicy="no-referrer"
                     style="width: 28px; height: 28px; display: block; border-radius: 50%; margin: 0 auto;">
                <div style="font-size: 12px; color: #333; margin-top: 4px; white-space: nowrap;">量多多快手授权</div>
            </div>
        `;
        
        Object.assign(widget.style, {
            position: 'fixed',
            top: '50%',
            right: '10px',
            width: 'auto',
            height: 'auto',
            zIndex: '9999',
            cursor: 'pointer',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            transition: 'right 0.3s ease, left 0.3s ease',
            userSelect: 'none',
            padding: '4px'
        });

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        widget.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = widget.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            widget.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;
            
            widget.style.left = newLeft + 'px';
            widget.style.top = newTop + 'px';
            widget.style.right = 'auto';
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            const rect = widget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const windowWidth = window.innerWidth;
            
            widget.style.transition = 'right 0.3s ease, left 0.3s ease';
            
            if (centerX < windowWidth / 2) {
                widget.style.left = '10px';
                widget.style.right = 'auto';
            } else {
                widget.style.right = '10px';
                widget.style.left = 'auto';
            }
        });

        widget.addEventListener('click', (e) => {
            if (Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5) {
                mdChrome.web.send('ldd-niu-account-auth', {});
            }
        });

        document.body.appendChild(widget);
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