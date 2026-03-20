
async function getCache() {
    return new Promise((resolve) => {
        const id = Date.now() + Math.random() + ':md.local.get';
        function handler(e: any) {
            const msg = e.data;
            const sender = msg.sender || {};
            if (sender.id === id && sender.name == 'content-script') {
                window.removeEventListener("message", handler);
                resolve(msg.result);
            }
        }
        window.addEventListener("message", handler);
        window.postMessage({
            params: [['BROWSER_CACHE']],
            cmd: "chrome",
            sender: { id, name: 'web-page' },
            call: 'storage.local.get'
        }, "*");
    });

}

const whiteCookie = ["_m_h5_tk_enc", "_m_h5_tk"];
function transformCookieStr(input: string) {
    if (!input || typeof input !== 'string') {
        return { cookiesStr: input, cookies: [] };
    }

    const cookies = input
        .split(';')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => {
            // if(whiteCookie.indexOf(item) < 0) return null;
            const idx = item.indexOf('=');

            if (idx === -1) {
                return { name: item, value: '' };
            }

            return {
                name: item.slice(0, idx).trim(),
                value: item.slice(idx + 1).trim()
            };
        }).filter(Boolean);


    return {
        cookiesStr: input,
        cookies
    };
}
function use1688() {

    const mdChrome = _require('mdChrome');
    const getUserInfo = async () => {
        const cookieAwait = ['.1688.com','.tmall.com', '.mmstat.com', 'detail.1688.com'].map(origin => {
            return mdChrome.web.cmd({ cmd: 'getCookie', myDomain: origin });
        });


        // const cookieAwait = ['https://s.1688.com/'].map(origin => {
        //     return mdChrome.web.cmd({ cmd: 'getCookie' });
        // });

        const cookiesGroupRes = await Promise.all(cookieAwait);
        
        try {
            const info = await getCache() as any;
            const cache1688 = info && info['BROWSER_CACHE'] && info['BROWSER_CACHE']['1688'];
            
            const patchCookie = transformCookieStr(cache1688.cookie);
            cookiesGroupRes.push(patchCookie);
        } catch (error) {

        }
        let cookiesArr: any[] = [];
        cookiesGroupRes.map(res => { cookiesArr.push(...((res && res.cookies) ? res.cookies : [])) });
        const map: any = {};
        const keys: any = [];
        cookiesArr.forEach(c => {
            if (map[c.name]) return;
            map[c.name] = c.value;
            keys.push(c.name);
        });

       



        const filtered = keys.map(name => {
            const val = map[name];
            if (!val) return null;
            return name + '=' + val;
        }).filter(Boolean);

        const cookie = filtered.join('; ');

            console.log(map, cookie, 'cks');

        // console.log(cookiesGroupRes, 'cookiesGroupRes', cookie);
        return {
            cookie,
            object: map,
        }


    };
    return {
        getUserInfo
    }

}

export { use1688 }