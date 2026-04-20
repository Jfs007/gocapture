// import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import { userInfo } from '../hooks/useLogin';




export type HttpOptions = {
    url: string;
    filename?: string;
    method?: string;
    headers?: any;
    data?: any;
    buffer?: boolean | undefined;
}
const request = async ({ url, method, headers, data, buffer }: HttpOptions) => {
    try {
        const mdChrome = _require('mdChrome');
        const token = userInfo.value.token;
        console.log(url, token, data);
        const res = await mdChrome.web.cmd({
            buffer,
            cmd: 'fetch',
            url: url,
            method: method || 'get',
            headers: {
                accessToken: token,
                'Content-Type': 'application/json',
                ...(headers || {})
            },
            data: data
        });
        return res?.result || { code: 0, message: 'success', data: null }
    } catch (error) {
        return {
            code: -1,
            message: error,
            data: null
        }
    }

}
// 功能未实现
const download = async ({ url, headers, data, filename }: HttpOptions) => {
    const mdChrome = _require('mdChrome');
    const token = userInfo.value.token;
    const res = await mdChrome.web.cmd({
        blob: true,
        cmd: 'downFile',
        filename: filename,
        url: url,
        headers: {
            accessToken: token,
            'Content-Type': 'application/json',
            ...(headers || {})
        },
        data: data
    });
    return res?.result || { code: 0, message: 'success', data: null }
}

export { download }
export default request
