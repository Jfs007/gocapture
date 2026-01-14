import type { CategoryOption } from '../types/collection'

export const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    label: '节日用品/礼品',
    value: 'festival_gifts',
    children: [
      { label: '节日用品/礼品', value: 'festival_gifts_sub1' },
      { label: '零食/坚果/特产', value: 'snacks' },
      { label: '玩具/早教益智', value: 'toys' }
    ]
  },
  {
    label: '家居用品',
    value: 'home_products',
    children: [
      { label: '家居日用', value: 'home_daily' },
      { label: '厨房用品', value: 'kitchen' },
      { label: '收纳整理', value: 'storage' }
    ]
  },
  {
    label: '服装配饰',
    value: 'clothing',
    children: [
      { label: '女装', value: 'women_clothing' },
      { label: '男装', value: 'men_clothing' },
      { label: '童装', value: 'children_clothing' }
    ]
  },
  {
    label: '数码电器',
    value: 'electronics',
    children: [
      { label: '手机配件', value: 'phone_accessories' },
      { label: '电脑配件', value: 'computer_accessories' },
      { label: '智能设备', value: 'smart_devices' }
    ]
  },
  {
    label: '美妆个护',
    value: 'beauty',
    children: [
      { label: '护肤品', value: 'skincare' },
      { label: '彩妆', value: 'makeup' },
      { label: '个人护理', value: 'personal_care' }
    ]
  }
]

export const RANKING_TIME_OPTIONS = [
  { label: '近3天', value: '3days' },
  { label: '近7天', value: '7days' },
  { label: '近30天', value: '30days' }
]
