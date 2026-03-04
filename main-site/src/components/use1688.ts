

function use1688() {

    const mdChrome = _require('mdChrome');
    const getUserInfo = async () => {
        const cookieAwait = ['.1688.com', '.mmstat.com'].map(origin => {
            return mdChrome.web.cmd({ cmd: 'getCookie', myDomain: origin });
        });


        // const cookieAwait = ['https://s.1688.com/'].map(origin => {
        //     return mdChrome.web.cmd({ cmd: 'getCookie' });
        // });
        
        const cookiesGroupRes = await Promise.all(cookieAwait);
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