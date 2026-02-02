<template>
  <n-space vertical :size="16">
    <!-- 采集方式 -->
    <n-card size="small" :content-style="{ padding: '0 6px 10px 6px' }"
      :header-style="{ padding: '0 10px 10px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }">
      <template #header>
        <n-space align="center" :size="12">
          <n-text style="font-size: 14px">采集方式</n-text>
          <n-space :size="0" align="center" class="ranking-type-tabs">
            <div v-for="type in rankingTypeOptions" :key="type.value"
              :class="['ranking-tab', { 'ranking-tab-active': activeRankingType === type.value }]"
              @click="switchRankingType(type.value)">
              <n-checkbox :checked="isRankingEnabled(type.value)"
                @update:checked="(checked) => toggleRankingEnabled(type.value, checked)" @click.stop size="small" />
              <span class="tab-label">{{ type.label }}</span>
            </div>
          </n-space>
        </n-space>
      </template>
      <template #header-extra>
        <!-- <n-text depth="3" class="font-12">
          (支持多选一起采集)
        </n-text> -->
      </template>

      <n-space vertical>

        <!-- 榜单类目和榜单时效 -->
        <n-space align="center" v-if="activeRankingType && activeRankingType !== 'search1688'">
          <n-space align="center" :size="[4, 8]">
            <n-text class="font-12">榜单类目</n-text>
            <n-select filterable :loading="loadins.jnCate" v-if="activeRankingType === 'jinniu'"
              v-model:value="currentCategory" :consistent-menu-width="false" :options="categoryOptions" size="small"
              placeholder="榜单类目" style="width: 130px" @update:value="handleCategorySelect" />
            <n-select filterable :loading="loadins.dyCate" v-else-if="activeRankingType === 'douyin'"
              v-model:value="currentCategory" :options="douyinCategoryOptions" size="small" placeholder="榜单类目"
              :consistent-menu-width="false" style="width: 130px" @update:value="handleCategorySelect" />
            <n-text depth="3" class="font-12">{{ currentSelectedCategories.length }}/10</n-text>
          </n-space>

          <n-space align="center" :size="[4, 8]">
            <n-text class="font-12">榜单时效</n-text>
            <n-select size="small" v-model:value="currentSettings.rankingTime" :options="rankingTimeOptions"
              style="width: 120px" @update:value="refreshCategories" />
          </n-space>
        </n-space>
        <template v-if="activeRankingType && activeRankingType === 'search1688'">
          <!-- 1688 搜索结果采集指导 -->
          <n-space vertical :size="8" style="width: 100%">
            <n-tooltip trigger="hover" placement="bottom-start" :show-arrow="true" style="max-width: 440px;">
              <template #trigger>
                <n-button text type="primary" size="small" class="font-12">
                  📸 如何获取
                </n-button>
              </template>
              <div>
                <img :src="img1688step1" style="width: 100%; margin-bottom: 12px; border-radius: 4px" />
                <img :src="img1688step2" style="width: 100%; border-radius: 4px" />
              </div>
            </n-tooltip>
            <n-input size="small" v-model:value="currentSettings.url" placeholder="支持找货源/找工厂/供应商三种类型搜索结果地址"
              style="width: 100%" />
            <div v-if="currentSettings.url && !isValid1688Url(currentSettings.url)" class="color-error font-12">
              地址格式不正确，请使用上方支持的 1688 搜索结果链接（可包含 query 参数）
            </div>
          </n-space>
        </template>
        <template v-if="activeRankingType && activeRankingType !== 'search1688'">
          <!-- 已选类目 -->
          <div v-if="currentSelectedCategories.length > 0" class="flex">
            <n-text class="font-12 flex-none mr-4">已选类目</n-text>
            <n-space :size="8">
              <n-tag v-for="cat in currentSelectedCategories" :key="cat.value" size="small" closable
                @close="handleRemoveCategory(cat.value)">
                {{ cat.label }}
              </n-tag>
            </n-space>
          </div>

          <!-- 采集设置 -->
          <n-space align="center" :size="12">
            <n-space align="center" :size="[4, 8]">
              <n-text class="font-12">单类目最多采集</n-text>
              <n-input-number size="small" v-model:value="currentSettings.maxProductsPerCategory" :min="1"
                :max="40000 / currentSettings?.maxFactoriesPerProduct" :show-button="false" style="width: 60px" />
              <n-text class="font-12">条商品</n-text>
            </n-space>
            <n-space align="center" :size="[4, 8]">
              <n-text class="font-12">单商品最多采集</n-text>
              <n-input-number size="small" v-model:value="currentSettings.maxFactoriesPerProduct" :min="1"
                :max="40000 / currentSettings?.maxProductsPerCategory" :show-button="false" style="width: 60px" />
              <n-text class="font-12">条工厂信息</n-text>
            </n-space>
          </n-space>

          <!-- 附加选项 -->
          <n-space align="center" :size="[12, 8]">
            <n-checkbox v-model:checked="dropShippingEnabled" size="small">
              <n-text class="font-12">一键代发</n-text>
            </n-checkbox>
            <n-checkbox v-model:checked="douyinLabelEnabled" size="small">
              <n-text class="font-12">支持抖音面单</n-text>
            </n-checkbox>
          </n-space>
        </template>
        <!-- 开始采集按钮 -->
        <n-button size="small" type="primary" block
          :disabled="!activeRankingType || (activeRankingType !== 'search1688' && currentSelectedCategories.length === 0) || isCollecting"
          :loading="isCollecting" @click="handleStartCollection">
          开始采集
        </n-button>
        <!-- 提示信息 -->
        <div v-if="!isLoggedTo1688" type="warning" class="color-error font-12">
          请确保此刻浏览器已登录1688.com
        </div>
      </n-space>
    </n-card>

    <!-- 采集记录 -->
    <n-card size="small" :content-style="{ padding: '0 6px 10px 6px' }" :header-style="{ padding: '10px' }">
      <template #header>
        <n-text style="font-size: 14px;">采集记录</n-text>
      </template>
      <template #header-extra>
        <n-space align="center">
          <n-button size="small" text type="primary" @click="loadTaskList" :disabled="loading">
            刷新
          </n-button>
          <n-button size="small" text type="primary" :disabled="tasks.length === 0" @click="handleClearAll">
            全部清空
          </n-button>
          <n-button size="small" text type="primary" :disabled="tasks.length === 0" @click="handleAllDownload">
            全部下载
          </n-button>
        </n-space>
      </template>
      <n-data-table :columns="columns" :loading="loading" :remote="true" :data="tasks" row-class-name="font-12"
        :pagination="pagination" :bordered="false" size="small" />
    </n-card>
  </n-space>
</template>

<script setup lang="ts">
import { ref, h, reactive, computed, watch, nextTick } from 'vue'
import {
  NSpace,
  NCard,
  NText,
  NSelect,
  NTag,
  NInputNumber,
  NInput,
  NButton,
  NDataTable,
  NPopconfirm,
  NTooltip,
  NCheckbox,
  useMessage,
  type DataTableColumns,
  NScrollbar
} from 'naive-ui'
import type { CollectionTask, SelectedCategory, CollectionSettings } from '../types/collection'
import { RANKING_TIME_OPTIONS } from '../data/categories'
import { common, collection1688 } from '../api'
import { use1688 } from './use1688'
import img1688step1 from '../images/1688search1_compressed.jpg'
import img1688step2 from '../images/1688search2_compressed.jpg'

const message = useMessage()
const { getUserInfo } = use1688()
const loading = ref(false);
const categoryOptions = ref([]);
const douyinCategoryOptions = ref([]);
const rankingTimeOptions = RANKING_TIME_OPTIONS

// 榜单类型选项
const rankingTypeOptions = [
  { label: '抖音榜单', value: 'douyin' },
  { label: '金牛榜单', value: 'jinniu' },
  { label: '1688结果采集', value: 'search1688' }
]

// 当前激活的榜单类型（单选）- 用于编辑
const activeRankingType = ref<string>('')

// 已启用的榜单类型（多选）- 用于采集
const enabledRankings = ref<string[]>([])

// 附加选项
const dropShippingEnabled = ref(false) // 一键代发
const douyinLabelEnabled = ref(false)  // 支持抖音面单

// 每个榜单类型的独立数据
const rankingData = ref<Record<string, {
  selectedCategories: SelectedCategory[],
  settings: CollectionSettings
}>>({
  douyin: {
    selectedCategories: [],
    settings: {
      categories: [],
      rankingTime: 3,
      maxProductsPerCategory: 100,
      maxFactoriesPerProduct: 50
    }
  },
  jinniu: {
    selectedCategories: [],
    settings: {
      categories: [],
      rankingTime: 3,
      maxProductsPerCategory: 100,
      maxFactoriesPerProduct: 50
    }
  },
  search1688: {
    // selectedCategories: [],
    settings: {
      // maxProductsPerCategory: 100,
      // maxFactoriesPerProduct: 50,
      url: ''
    }
  }
})


// 校验 1688 搜索结果地址（允许携带 query params）
const isValid1688Url = (url: string) => {
  if (!url) return false
  try {
    const u = url.trim()
    const re = /^https:\/\/s\.1688\.com(?:\/company\/company_search\.htm|\/company\/pc\/factory_search\.htm|\/selloffer\/offer_search\.htm)(?:[?#].*)?$/i
    return re.test(u)
  } catch (e) {
    return false
  }
}

// 当前激活榜单的选中类目
const currentSelectedCategories = computed(() => {
  if (!activeRankingType.value) return []
  return rankingData.value[activeRankingType.value]?.selectedCategories || []
})

// 当前激活榜单的设置
const currentSettings = computed(() => {
  if (!activeRankingType.value) return {
    categories: [],
    rankingTime: 3,
    maxProductsPerCategory: 100,
    maxFactoriesPerProduct: 50
  }
  return rankingData.value[activeRankingType.value]?.settings || {
    categories: [],
    rankingTime: 3,
    maxProductsPerCategory: 100,
    maxFactoriesPerProduct: 50
  }
})
// const down2 = () => {
//   download({
//     data: { "campaignTimeRange": [1768320000000, 1768320000000], "statCostFlag": 0, "pnlExceptionFlag": 0, "balanceInsufficientFlag": 0, "startDate": "2026-01-14", "endDate": "2026-01-14", "columns": ["optStatus", "campaignId", "campaignStatusMark", "campaignBudget", "costChart", "operate", "statCost", "pnlDealAmount", "dealPnlRate", "gmvDealPnlRate", "totalReturnRate", "totalOrderSettleCountRate", "totalRefundOrderGmvRate", "totalRefundOrderCount", "totalPayOrderCount", "totalPayOrderRoi", "totalPayOrderCost", "costDealAmount", "operatorName", "campaignCreateTime", "totalRefundOrderGmv", "totalPayOrderGmv", "actualPayOrderGmv", "totalPayOrderCouponAmount", "totalEcomPlatformSubsidyAmount", "accountCode", "costRate", "materialCount", "costPayAmount"] },
//     url: 'https://ad.itaored.com/api/qc/campaign/info/download',
//     filename: 'campaign_info.xlsx',
//     headers: {
//       'x-permission': 'YWRzLWR5LXFj'
//     }
//   })
// }
const STORAGE_KEY = 'collection1688_default_config'
console.log(window.__PLG__ENV__, 'plg_env');
// 从 localStorage 加载默认配置
const loadDefaultConfig = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('加载默认配置失败:', error)
  }
  return null
}

// 保存配置到 localStorage
const saveDefaultConfig = () => {
  try {
    const config = {
      activeRankingType: activeRankingType.value,
      enabledRankings: enabledRankings.value,
      rankingData: rankingData.value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error('保存默认配置失败:', error)
  }
}

const currentCategory = ref<string | null>(null)
const isCollecting = ref(false)

// 监听榜单数据变化，自动保存配置
watch(
  () => rankingData.value,
  () => {
    saveDefaultConfig()
  },
  { deep: true }
)

const tasks = ref<CollectionTask[]>([

])

const pagination = reactive({
  page: 1,
  pageSize: 15,
  itemCount: 0,
  pageCount: 0,
  showSizePicker: true,
  pageSizes: [10, 15, 20, 30],
  onChange: (page: number) => {
    pagination.page = page
    loadTaskList()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    loadTaskList()
  }
})

const handleAllDownload = async () => {
  const info = user1688Info.value
  if (!info.object.unb) {
    message.warning('请先登录1688账号')
    return
  }

  if (tasks.value.length === 0) {
    message.warning('当前页没有可下载的任务')
    return
  }

  // 只下载当前页的任务
  const taskIdList = tasks.value.map(task => Number(task.id));
  handleDownload(taskIdList);


}

// 检查榜单是否启用
const isRankingEnabled = (type: string) => {
  return enabledRankings.value.includes(type)
}

// 切换榜单启用状态
const toggleRankingEnabled = (type: string, enabled: boolean) => {
  if (enabled) {
    if (!enabledRankings.value.includes(type)) {
      enabledRankings.value.push(type)
    }
  } else {
    enabledRankings.value = enabledRankings.value.filter(t => t !== type)
  }
}

const loadins = reactive({
  dyCate: false,
  jnCate: false,
})
const loadCategories = () => {
  if (activeRankingType.value === 'douyin' && douyinCategoryOptions.value.length === 0) {
    loadDouyinCategories()
  } else if (activeRankingType.value === 'jinniu' && categoryOptions.value.length === 0) {
    loadJinniuCategories()
  }
}
// 切换榜单类型（用于编辑）
const switchRankingType = async (type: string) => {
  // 单选模式，直接切换到编辑模式
  activeRankingType.value = type
  currentCategory.value = null;
  toggleRankingEnabled(type, true)

  loadCategories();
}

const refreshCategories = () => {
  douyinCategoryOptions.value = [];
  categoryOptions.value = [];
  nextTick(() => {
    loadCategories();
  })


}



// 加载抖音类目
const loadDouyinCategories = async () => {
  if (loadins.dyCate) return;
  try {
    loadins.dyCate = true;
    const dayType = rankingData.value[activeRankingType.value]?.settings?.rankingTime;
    const res = await common.getIdustryNameList({
      platform: 2,
      dayType: dayType
    })
    const categories = res.data || []
    // 将字符串数组转换为 select options
    douyinCategoryOptions.value = categories.map((cat: string) => ({
      label: cat,
      value: cat
    }));
    loadins.dyCate = false;
  } catch (error) {
    loadins.dyCate = false;
  }
}

// 加载金牛类目
const loadJinniuCategories = async () => {
  if (loadins.jnCate) return;
  try {
    loadins.jnCate = true
    const dayType = rankingData.value[activeRankingType.value]?.settings?.rankingTime;
    const res = await common.getIdustryNameList({
      platform: 1,
      dayType: dayType
    });
    const categories = res.data || []
    categoryOptions.value = categories.map((cat: string) => ({
      label: cat,
      value: cat
    }));
    loadins.jnCate = false;
  } catch (error) {
    loadins.jnCate = false;
    console.error('加载金牛类目失败:', error)
    // message.error('加载金牛类目失败')
  }
}

const handleCategorySelect = (value: string, option: any) => {
  if (!value || !activeRankingType.value) return

  const currentData = rankingData.value[activeRankingType.value]

  if (currentData.selectedCategories.length >= 10) {
    message.warning('最多只能选择10个榜单类目')
    currentCategory.value = null
    return
  }

  const exists = currentData.selectedCategories.find(cat => cat.value === value)
  if (exists) {
    message.warning('该类目已选择')
    currentCategory.value = null
    return
  }

  // 处理抖音榜单（字符串）和金牛榜单（级联）
  const label = activeRankingType.value === 'douyin' ? value : (option?.label || value)

  currentData.selectedCategories.push({
    label: label,
    value: value,
    path: option?.path || []
  })

  // 保存配置
  saveDefaultConfig()

  currentCategory.value = null
}

const handleRemoveCategory = (value: string) => {
  if (!activeRankingType.value) return

  const currentData = rankingData.value[activeRankingType.value]
  currentData.selectedCategories = currentData.selectedCategories.filter(cat => cat.value !== value)

  // 保存配置
  saveDefaultConfig()
}

const user1688Info = ref<any>({
  object: {},
  cookie: ''
});

const isLoggedTo1688 = computed(() => {
  const info = user1688Info.value
  return !!info.object.unb
})
const set1688UserInfo = async () => {
  const info = await getUserInfo();
  user1688Info.value = info;

  return info;
}

const remove1688UserInfo = async () => {
  user1688Info.value = {
    object: {},
    cookie: ''
  };
}

// 将榜单时效转换为 dayType
const getDayTypeValue = (rankingTime: number): number => {
  return rankingTime;
}

// 加载任务列表
const loadTaskList = async () => {
  try {
    // pagination.page = 1;
    loading.value = true;
    tasks.value = [];
    const res = await collection1688.getTaskList({
      // userId: info.object.unb,
      pageNum: pagination.page || 1,
      pageSize: pagination.pageSize || 15
    });
    // const
    // 转换后端数据为前端格式
    tasks.value = res.data.map((task: any) => ({
      ...task,
      id: task.id.toString(),
      taskName: task.taskNo,
      count: task.daqCount,
      taskStatus: task.taskStatus,

      createTime: task.createdAt,
      categories: [],
      productCount: 0,
      factoryCount: 0
    }));
    // 更新分页信息
    if (res.pageInfo) {
      pagination.itemCount = res.pageInfo.total
      pagination.pageCount = Math.ceil(res.pageInfo.total / res.pageInfo.pageSize);
    }


    loading.value = false;
  } catch (error) {
    loading.value = false;
    console.error('加载任务列表失败', error)
  }
}

const refresh = () => {
  pagination.page = 1;
  loadTaskList();
}

const handleStartCollection = async () => {
  // 检查是否有启用的榜单
  if (enabledRankings.value.length === 0) {
    message.warning('请至少勾选一个榜单类型')
    return
  }

  // 验证所有启用的榜单都有选择类目或有效 URL（针对 1688 搜索结果采集）
  const invalidRankings = enabledRankings.value.filter(type => {
    const data = rankingData.value[type]
    if (!data) return true
    if (type === 'search1688') {
      const u = data.settings?.url || ''
      return !u || !isValid1688Url(u)
    }
    return data.selectedCategories.length === 0
  })

  if (invalidRankings.length > 0) {
    const rankingNames = invalidRankings.map(type => {
      const option = rankingTypeOptions.find(opt => opt.value === type)
      return option?.label || type
    }).join('、')
    message.warning(`${rankingNames} 配置不完整（请检查类目或 URL）`)
    return
  }

  let info = user1688Info.value;
  if (!info.object.unb) {
    info = await set1688UserInfo();
  }
  if (!info.object.unb) {
    message.warning('1688未登录~，2秒后跳转1688');
    setTimeout(() => {
      // 没有登陆，去登陆
      window.open('https://s.1688.com/factory/image_search.htm?tab=imageSearch&imageId=1706208665481339070&imageIdList=1706208665481339070&spm=a260k.22462580.imagesearch.upload&__AUTH_TYPE__=LOGIN');
    }, 2000)

    return;
  }

  isCollecting.value = true;
  const res = await collection1688.checkCookie({
    cookie: info.cookie
  });
  if (res.code != 200) {
    remove1688UserInfo();
    // cookie无效，去滑块验证吧
    window.open('https://s.1688.com/factory/image_search.htm?tab=imageSearch&imageId=1706208665481339070&imageIdList=1706208665481339070&spm=a260k.22462580.imagesearch.upload&__AUTH_TYPE__=SLIDING_BLOCK');
    isCollecting.value = false;
    return;
  }


  try {
    // 构建所有启用榜单的任务数据数组
    const taskList = enabledRankings.value.map(type => {
      const data = rankingData.value[type]
      if (type === 'search1688') {
        // 按要求：1688 结果采集只提交链接
        return {
          taskType: 3,
          cookie: info.cookie,
          userId: info.object.unb,
          taskUrl: data.settings?.url || ''
        }
      }
      const taskType = type === 'douyin' ? 2 : 1
      return {
        userId: info.object.unb,
        cookie: info.cookie,
        taskType: taskType,
        industryNameList: data.selectedCategories.map(cat => cat.label),
        dayType: getDayTypeValue(data.settings.rankingTime),
        productCountPerIndustry: data.settings.maxProductsPerCategory,
        factoryCountPerProduct: data.settings.maxFactoriesPerProduct,
        dropShipping: dropShippingEnabled.value ? '1988226' : '', // 一键代发
        taskTags: douyinLabelEnabled.value ? '386434' : ''        // 抖音面单
      }
    })

    // 调用创建任务接口（提交数组）
    const res = await collection1688.saveTask({
      taskList: taskList,
    });
    if (res?.code != 200) throw new Error(res?.msg)
    // 刷新任务列表
    await loadTaskList()
  } catch (error: any) {
    message.error(error.message || '创建任务失败')
  } finally {
    isCollecting.value = false
  }
}

const handleStopTask = async (taskId: string) => {
  const info = user1688Info.value
  // if (!info.object.unb) {
  //   message.warning('请先登录1688账号')
  //   return
  // }

  try {
    const res = await collection1688.stopTasks({
      taskIdList: [Number(taskId)],
      userId: info.object.unb
    })

    if (res.success || res.code === '200' || res.code === 200) {
      message.success('任务已停止')
      // 刷新任务列表
      await loadTaskList()
    } else {
      message.error(res.message || '停止任务失败')
    }
  } catch (error: any) {
    message.error(error.message || '停止任务失败')
  }
}

const exportLoading = ref<any>({});
const handleDownload = async (taskIdList: number[]) => {
  const info = user1688Info.value
  // if (!info.object.unb) {
  //   message.warning('请先登录1688账号')
  //   return
  // }
  try {
    taskIdList.map(id => {
      exportLoading.value[id] = true;
    })
    const res = await collection1688.exportTasks({
      taskIdList: taskIdList,
      userId: info.object.unb
    });
    // console.log(res.data);
    window.open(res.data);
    taskIdList.map(id => {
      exportLoading.value[id] = false;
    })
  } catch (err) {
    taskIdList.map(id => {
      exportLoading.value[id] = false;
    })
  }
}

const handleDelete = async (taskId: string) => {
  const info = user1688Info.value
  // if (!info.object.unb) {
  //   message.warning('请先登录1688账号')
  //   return
  // }

  try {
    const res = await collection1688.deleteTasks({
      taskIdList: [Number(taskId)],
      userId: info.object.unb
    })

    if (res.success || res.code === '200' || res.code === 200) {
      message.success('删除成功')
      // 刷新任务列表
      await loadTaskList()
    } else {
      message.error(res.message || '删除失败')
    }
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}

const handleClearAll = async () => {
  const info = user1688Info.value
  if (!info.object.unb) {
    message.warning('请先登录1688账号')
    return
  }

  if (tasks.value.length === 0) {
    message.warning('当前页没有可删除的任务')
    return
  }

  // 只删除当前页的任务
  const taskIdList = tasks.value.map(task => Number(task.id))

  try {
    const res = await collection1688.deleteTasks({
      taskIdList,
      userId: info.object.unb
    })

    if (res.success || res.code === '200' || res.code === 200) {
      message.success('删除成功')
      // 刷新任务列表
      await loadTaskList()
    } else {
      message.error(res.message || '删除失败')
    }
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}


const statusMap = {
  0: '采集中',
  1: '已完成',
  2: '失败',
}
const getStatusText = (taskStatus: CollectionTask['taskStatus']) => {

  return statusMap[taskStatus]
}
function formatDatetime(datetime: string, options: { removeYear?: boolean, removeSecond?: boolean } = {}) {
  const {
    removeYear = true,
    removeSecond = true
  } = options

  if (!datetime) return '-';

  const [datePart, timePart = ''] = datetime.split(' ')
  let [year, month, day] = datePart.split('-')
  let [hour = '00', minute = '00', second = '00'] = timePart.split(':')

  let date = removeYear ? `${month}-${day}` : `${year}-${month}-${day}`
  let time = removeSecond ? `${hour}:${minute}` : `${hour}:${minute}:${second}`

  return time ? `${date} ${time}` : date
}


/**
 * 计算两个时间的耗时，显示为「X分Y秒」
 * @param {string | null | undefined} start
 * @param {string | null | undefined} end
 * @returns {string}
 */
function calcDurationMinSecText(start?: string, end?: string) {
  if (!start) return '--'

  const startTime = Date.parse(start.replace(/-/g, '/'))
  if (Number.isNaN(startTime)) return '--'

  const endTime = end
    ? Date.parse(end.replace(/-/g, '/'))
    : Date.now()

  if (Number.isNaN(endTime)) return '--'

  const diffSeconds = Math.floor(Math.abs(endTime - startTime) / 1000)

  const minutes = Math.floor(diffSeconds / 60)
  const seconds = diffSeconds % 60

  return `耗时: ${minutes}m${seconds}s`
}


const columns: DataTableColumns<CollectionTask> = [
  {
    title: '采集任务',
    key: 'taskNo',
    width: 120,
    render(row: any) {
      let industryName = JSON.parse(row.industryName || '[]');
      return h(
        NTooltip,
        {
          trigger: 'hover'
        },
        {
          trigger: () => h('div', {}, [
            h('div', { class: 'font-weight-bold' }, row.taskNo),
            h(NText, { class: 'font-12 text-underline cusor-pointer', depth: 3 }, () => [calcDurationMinSecText(row.createdAt, row.finishedAt), row.taskStatus == 0 ? h('span', { class: 'dot-loading' }) : null]),
          ]),
          default: () => h('div', {}, [
            h(NScrollbar, { class: 'font-12', style: 'margin-bottom: 4px;max-width: 240px;', xScrollable: true }, h('div', { style: 'white-space: nowrap' }, industryName.map(_ => {
              return h(NTag, { size: 'small', style: 'margin-right: 4px' }, _)
            }))),
            h('div', `开始: ${formatDatetime(row.createdAt, { removeYear: false, removeSecond: false })}`),
            h('div', `结束: ${formatDatetime(row.finishedAt, { removeYear: false, removeSecond: false })}`)
          ])
        }
      )
    }
  },
  {
    title: '榜单类型',
    key: 'count',
    width: 80,
    render: (row: any) => {
      if(row.taskType == 3) return h('div', '1688s结果采集');
      return [
        
        h('div', row.taskType == 1 ? '金牛' : '抖音'),
        // h('span', '' + (row.count || '--')),
      ]

    }
  },
  {
    title: '采集条数',
    key: 'count',
    width: 80,
    render: (row: any) => {
      return [
        // h('div', row.taskType == 1 ? '金牛' : '抖音'),
        h('span', '' + (row.count || '--')),
      ]

    }
  },
  {
    title: '采集状态',
    key: 'status',
    width: 80,
    render: (row) => {
      return getStatusText(row.taskStatus);
    }
  },
  {
    title: '操作',
    key: 'actions',
    align: 'center',
    fixed: 'right',
    width: 100,
    render: (row) => {
      return h(NSpace, { size: 8, align: 'center', justify: 'center' }, () => [
        row.taskStatus == 0 && h(
          NPopconfirm,
          {
            onPositiveClick: () => handleStopTask(row.id)
          },
          {
            trigger: () => h(
              NButton,
              { text: true, type: 'primary', size: 'small', class: 'font-12' },
              { default: () => '停止任务' }
            ),
            default: () => '确定停止该任务吗？'
          }
        ),
        (row.taskStatus == 1) && h(
          NButton,
          {
            text: true,
            type: 'primary',
            size: 'small',
            class: 'font-12',
            loading: exportLoading.value[row.id],
            onClick: () => handleDownload([Number(row.id)])
          },
          { default: () => '下载' }
        ),
        (row.taskStatus == 1 || row.taskStatus == 2) && h(
          NPopconfirm,
          {
            onPositiveClick: () => handleDelete(row.id)
          },
          {
            trigger: () => h(
              NButton,
              { text: true, type: 'primary', size: 'small', class: 'font-12' },
              { default: () => '删除' }
            ),
            default: () => '确定删除该记录吗？'
          }
        )
      ])
    }
  }
]

const setup = async () => {
  // 加载保存的配置
  const savedConfig = loadDefaultConfig()
  if (savedConfig) {
    if (savedConfig.activeRankingType) {
      activeRankingType.value = savedConfig.activeRankingType
    }
    if (savedConfig.enabledRankings) {
      enabledRankings.value = savedConfig.enabledRankings
    }
    if (savedConfig.rankingData) {
      // 合并保存的配置与默认值，防止新增采集方式丢失
      rankingData.value = {
        ...rankingData.value,
        ...savedConfig.rankingData
      }
    }
  }

  await set1688UserInfo();
  if (!isLoggedTo1688.value) {
    message.warning('请登录1688.com')
  }
  switchRankingType(activeRankingType.value)
  // 加载任务列表
  loadTaskList();
};
setup()
</script>

<style scoped>
.ranking-type-tabs {
  display: flex;
  align-items: center;
  border-bottom: 2px solid #e0e0e6;
}

.ranking-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: transparent;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  position: relative;
}

.ranking-tab:hover {
  background-color: #f5f5f5;
}

.ranking-tab-active {
  border-bottom-color: var(--n-bar-color);
  color: var(--n-bar-color);
}

.ranking-tab .tab-label {
  font-size: 13px;
  user-select: none;
}

.ranking-tab-active .tab-label {
  font-weight: 500;
  color: var(--n-bar-color);
}

.ranking-tab :deep(.n-checkbox) {
  cursor: pointer;
}

.ranking-tab :deep(.n-checkbox .n-checkbox-box) {
  border-radius: 3px;
}
</style>
