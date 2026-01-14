

function use1688() {
    
    const mdChrome = _require('mdChrome');
    const getUserInfo = async () => {
        const cookieAwait = ['.1688.com', '.mmstat.com'].map(origin => {
            return mdChrome.web.cmd({ cmd: 'getCookie', myDomain: origin });
        });
        const cookiesGroupRes = await Promise.all(cookieAwait);
        let cookiesArr: any[] = [];
        cookiesGroupRes.map(res => { cookiesArr.push(...((res && res.cookies) ? res.cookies : [])) });
        const map: any = {};
        cookiesArr.forEach(c => {
            map[c.name] = c.value;
        });
        const filtered = [
            "xlly_s",
            "leftMenuLastMode",
            "leftMenuModeTip",
            "cookie2",
            "t",
            "_tb_token_",
            "lid",
            "__last_loginid__",
            "__last_memberid__",
            "mtop_partitioned_detect",
            "_m_h5_tk",
            "_m_h5_tk_enc",
            "trackId",
            "plugin_home_downLoad_cookie",
            "_samesite_flag_",
            "tracknick",
            "ali_apache_track",
            "ali_apache_tracktmp",
            "union",
            "cna",
            "cookie1",
            "cookie17",
            "sgcookie",
            "sg",
            "csg",
            "unb",
            "uc4",
            "_nk_",
            "__cn_logon__",
            "__cn_logon_id__",
            "last_mid",
            "_csrf_token",
            "isg",
            "_user_vitals_session_data_",
            "tfstk"
        ].map(name => {
            const val = map[name];
            if (!val) return null;
            return name + '=' + val;
        }).filter(Boolean);
        const cookie = filtered.join('; ');
        console.log('cookie', map);
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