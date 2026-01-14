// import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import { userInfo } from '../hooks/useLogin';




export type HttpOptions = {
    url: string;
    method?: string;
    headers?: any;
    data?: any;
    buffer?: boolean | undefined;
}
const request = async ({ url, method, headers, data, buffer }: HttpOptions) => {
    try {
        const mdChrome = _require('mdChrome');
        const token = userInfo.value.token;
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


// ============================================
// request2 - 使用 axios 实现
// ============================================

// import axios, { AxiosInstance, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios'

// // 创建 axios 实例
// const axiosInstance: AxiosInstance = axios.create({
//   baseURL: import.meta.env.VITE_API_BASE_URL,  // 不设置 baseURL，让请求使用相对路径，这样 /api 开头的请求会被 Vite 代理拦截
//   timeout: 30000,
//   headers: {
//     'Content-Type': 'application/json'
//   }
// })

// // 请求拦截器
// axiosInstance.interceptors.request.use(
//   (config: any) => {
//     // 从 userInfo 获取 token
//     const token = userInfo.value.token
//     if (token) {
//       config.headers.accessToken = token
//     }
//     // 调试信息
//     console.log('🚀 Axios Request:', {
//       url: config.url,
//       baseURL: config.baseURL,
//       fullURL: config.baseURL ? config.baseURL + config.url : config.url,
//       method: config.method,
//       headers: config.headers
//     })
//     return config
//   },
//   (error: AxiosError) => {
//     console.error('请求错误:', error)
//     return Promise.reject(error)
//   }
// )

// // 响应拦截器
// axiosInstance.interceptors.response.use(
//   (response: AxiosResponse) => {
//     const { data } = response

//     // 如果是 Blob 类型（文件下载），直接返回
//     if (response.config.responseType === 'blob') {
//       return data
//     }

//     // 根据实际后端返回格式调整
//     if (data.code === '200' || data.code === 0 || data.success) {
//       return data
//     }

//     // 处理业务错误
//     console.error('业务错误:', data.message || '请求失败')
//     return Promise.reject(new Error(data.message || '请求失败'))
//   },
//   (error: AxiosError) => {
//     // 处理 HTTP 错误
//     if (error.response) {
//       const { status } = error.response

//       switch (status) {
//         case 401:
//           console.error('未授权，请重新登录')
//           localStorage.removeItem('TOKEN')
//           break
//         case 403:
//           console.error('拒绝访问')
//           break
//         case 404:
//           console.error('请求资源不存在')
//           break
//         case 500:
//           console.error('服务器错误')
//           break
//         default:
//           console.error(`请求错误: ${status}`)
//       }
//     } else if (error.request) {
//       console.error('网络错误，请检查网络连接')
//     } else {
//       console.error('请求配置错误:', error.message)
//     }

//     return Promise.reject(error)
//   }
// )

// export type HttpOptions2 = {
//   url: string
//   method?: 'get' | 'post' | 'put' | 'delete' | 'patch'
//   headers?: any
//   data?: any
//   params?: any
//   responseType?: 'json' | 'blob' | 'arraybuffer' | 'text'
// }

// const request = async ({ url, method = 'get', headers, data, params, responseType }: HttpOptions2) => {
//   try {
//     const config: AxiosRequestConfig = {
//       url,
//       method,
//       headers,
//       responseType
//     }

//     // GET 请求使用 params，其他请求使用 data
//     if (method.toLowerCase() === 'get') {
//       config.params = data || params
//     } else {
//       config.data = data
//     }

//     const response = await axiosInstance.request(config)
//     return response
//   } catch (error: any) {
//     throw error
//   }
// }

// export { request2 }
export default request
