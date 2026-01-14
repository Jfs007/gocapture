/**
 * API 响应类型定义
 */

// 通用响应结构
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  success: boolean
}

// 分页信息
export interface PageInfo {
  pageNum: number
  pageSize: number
  total: number
}

// 1688 采集任务
export interface Task1688 {
  id: number
  userId: string
  taskNo: string
  daqCount: number
  taskStatus: number  // 0-采集中, 1-已完成
  createdAt: string
  finishedAt: string | null
  deletedFlag: number
}

// 任务列表响应
export interface TaskListResponse {
  success: boolean
  code: string
  message: string
  data: Task1688[]
  page: PageInfo
}

