import request from '../utils/request'

/**
 * API 接口示例
 * 所有接口都会自动添加 /api 前缀（开发环境）
 * 或直接使用配置的 BASE_URL（生产环境）
 */

// 示例：获取用户信息


export const common = {
    getJnCategories: () => {
        return request({ url: 'api/dictionary/iu/list', method: 'get', data: { dictNames: 'KS_SYT_CATEGORY' } })
    },
    getDouyinIndustryList: (params: { scene: number }) => {
        return request({ url: 'api/material/industry/list', method: 'get', data: params, headers: { 'x-permission': 'bWVkaWEtbGliLWhvdA==' } })
    },
    getIdustryNameList: (params: { platform: 1 | 2, dayType: number }) => {
        return request({ url: 'api/daq/task/industry/name/list', method: 'get', data: params })
    },
}

// 1688 采集相关接口
export const collection1688 = {
    // 创建采集任务
    saveTask: (data: {
        taskList: Array<{
            userId: string
            cookie: string
            taskType: string | number
            industryNameList: string[]
            dayType: number
            productCountPerIndustry: number
            factoryCountPerProduct: number
        }>

    }) => {
        return request({
            url: 'api/upload/daq/task/batch/save',
            method: 'post',
            data,
            headers: { 'x-permission': 'bWVkaWEtbGliLWhvdA==' }
        })
    },

    // 获取任务列表
    getTaskList: (params: {
        // userId: string
        pageNum: number
        pageSize: number
    }) => {
        return request({
            url: 'api/daq/task/list',
            method: 'get',
            data: params
        })
    },

    // 导出任务
    exportTasks: (data: {
        taskIdList: number[]
        userId: string
    }) => {
        return request({
            // buffer: true,
            url: 'api/daq/task/export',
            method: 'post',
            data,
            // headers: {
            //     'x-permission': 'YWxpcGF5LWRo'
            // }
        })
    },

    // 删除任务
    deleteTasks: (data: {
        taskIdList: number[]
        userId: string
    }) => {
        return request({
            url: 'api/daq/task/delete',
            method: 'post',
            data
        })
    },
    // 停止任务
    stopTasks: (data: {
        taskIdList: number[]
        userId: string
    }) => {
        return request({
            url: 'api/daq/task/stop',
            method: 'post',
            data
        })
    },
    checkCookie: (data: {
        cookie: string,
        taskUrl?: string
    }) => {
        return request({
            url: 'api/daq/task/check/cookie',
            method: 'post',
            data
        })
    },
    continueTask: (data: any) => {
        return request({
            url: 'api/upload/daq/task/continue',
            method: 'post',
            data
        })
    }
}

// 示例：抖音采集相关接口
export const collectionDouyin = {

}

export default {
    collection1688,
    collectionDouyin
}
