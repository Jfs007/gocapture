import { useMessage } from 'naive-ui'

import { formatDate } from '../utils/date'

function detectExcelMime(buffer: ArrayBuffer) {
    return {
        mime: 'text/csv',
        suffix: '.xls'
    }
    
}


export default () => {
    const message = useMessage()
    return {
        async exportSheets(fetch: { (value: any): Promise<any> }, requestData: Record<string, any>, fileName?: string) {
            try {
                const buffer = await fetch(requestData);
                let { mime, suffix } = detectExcelMime(buffer)
                const blob = new Blob([buffer], { type: mime })
                if (blob instanceof Blob) {
                    // 默认文件后缀

                    const blobTypeList: any = {
                        xls: 'application/vnd.ms-excel',
                        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        csv: 'text/csv'
                    }
                    // 根据blob.type，匹配文件后缀
                    for (const key in blobTypeList) {
                        if (blob?.type.includes(blobTypeList[key])) {
                            suffix = `.${key}`
                        }
                    }
                    const a = document.createElement('a')
                    const finalFileName = fileName ? fileName : `【导出文件】${formatDate(new Date(), 'yyyyMMddhhmmss')}`
                    if (window.navigator && window.navigator?.msSaveOrOpenBlob) {
                        // 兼容ie浏览器下数据流处理
                        window.navigator?.msSaveOrOpenBlob(blob, `${finalFileName}${suffix}`)
                    } else {
                        a.href = URL.createObjectURL(blob)
                        a.download = `${finalFileName}${suffix}`
                        a.style.display = 'none'
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                    }
                    message.success('导出成功')
                } else {
                    Promise.reject()
                }
            } catch (e: any) {
                console.log(e, 'e');
                message.error(e)
            }
        }
    }
}
