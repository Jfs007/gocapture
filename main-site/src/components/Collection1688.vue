<template>
  <n-space vertical :size="16">
    <!-- 金牛行业分类 -->
    <n-card title="金牛行业分类" size="small" :content-style="{ padding: '0 10px 10px 10px' }"
      :header-style="{ padding: '10px' }">
      <template #header-extra>
        <n-text depth="3" class="font-12">
          将自动获取该分类下的商品信息
        </n-text>
      </template>

      <n-space vertical>
        <!-- 商品分类和榜单时效 -->
        <n-space align="center">
          <n-space align="center" :size="[4, 8]">
            <n-text class="font-12">商品分类</n-text>
            <n-cascader :max-tag-count="1" v-model:value="currentCategory" :options="categoryOptions" size="small"
              placeholder="商品分类" style="width: 130px" @update:value="handleCategorySelect" />
            <n-text depth="3" class="font-12">{{ selectedCategories.length }}/10</n-text>
          </n-space>

          <n-space align="center" :size="[4, 8]">
            <n-text class="font-12">榜单时效</n-text>
            <n-select size="small" v-model:value="settings.rankingTime" :options="rankingTimeOptions"
              style="width: 120px" />
          </n-space>
        </n-space>

        <!-- 已选类目 -->
        <div v-if="selectedCategories.length > 0" class="flex">
          <n-text class="font-12 flex-none mr-4">已选类目</n-text>
          <n-space :size="8">
            <n-tag v-for="cat in selectedCategories" :key="cat.value" size="small" closable
              @close="handleRemoveCategory(cat.value)">
              {{ cat.label }}
            </n-tag>
          </n-space>
        </div>

        <!-- 采集设置 -->
        <n-space align="center" :size="12">
          <n-space align="center" :size="[4, 8]">
            <n-text class="font-12">单类目最多采集</n-text>
            <n-input-number size="small" v-model:value="settings.maxProductsPerCategory" :min="1" :max="40000/settings.maxFactoriesPerProduct"
              :show-button="false" style="width: 60px" />
            <n-text class="font-12">条商品</n-text>
          </n-space>
          <n-space align="center" :size="[4, 8]">
            <n-text class="font-12">单商品最多采集</n-text>
            <n-input-number size="small" v-model:value="settings.maxFactoriesPerProduct" :min="1" :max="40000/settings.maxProductsPerCategory"
              :show-button="false" style="width: 60px" />
            <n-text class="font-12">条工厂信息</n-text>
          </n-space>
        </n-space>

        <!-- 开始采集按钮 -->
        <n-button size="small" type="primary" block :disabled="selectedCategories.length === 0 || isCollecting"
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
    <n-card title="采集记录" size="small" :content-style="{ padding: '0 10px 10px 10px' }"
      :header-style="{ padding: '10px' }">
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
import { ref, h, reactive, computed, watch } from 'vue'
import {
  NSpace,
  NCard,
  NText,
  NCascader,
  NSelect,
  NTag,
  NFlex,
  NInputNumber,
  NButton,
  NAlert,
  NDataTable,
  NPopconfirm,
  NTooltip,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import type { CollectionTask, SelectedCategory, CollectionSettings } from '../types/collection'
import { RANKING_TIME_OPTIONS } from '../data/categories'
import { common, collection1688 } from '../api'
// import { download } from '../utils/request'
import { use1688 } from './use1688'
import useExport from '../hooks/useExport'

const message = useMessage()
const { getUserInfo } = use1688()
const { exportSheets } = useExport()
const loading = ref(false);
const categoryOptions = ref([]);
const rankingTimeOptions = RANKING_TIME_OPTIONS
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
      selectedCategories: selectedCategories.value,
      rankingTime: settings.value.rankingTime,
      maxProductsPerCategory: settings.value.maxProductsPerCategory,
      maxFactoriesPerProduct: settings.value.maxFactoriesPerProduct
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error('保存默认配置失败:', error)
  }
}

const defaultConfig = loadDefaultConfig();
if(defaultConfig?.rankingTime == '3days') {
  defaultConfig.rankingTime = 3;
}

const currentCategory = ref<string | null>(null)
const selectedCategories = ref<SelectedCategory[]>(defaultConfig?.selectedCategories || [])
const isCollecting = ref(false)


const settings = ref<CollectionSettings>({
  categories: [],
  rankingTime: defaultConfig?.rankingTime || 3,
  maxProductsPerCategory: defaultConfig?.maxProductsPerCategory || 100,
  maxFactoriesPerProduct: defaultConfig?.maxFactoriesPerProduct || 50
})

// 监听设置变化，自动保存配置
watch(
  () => settings.value,
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

const handleCategorySelect = (value: string, option: any) => {
  if (!value || !option) return

  if (selectedCategories.value.length >= 10) {
    message.warning('最多只能选择10个行业类目')
    currentCategory.value = null
    return
  }
  const exists = selectedCategories.value.find(cat => cat.value === value)
  if (exists) {
    message.warning('该类目已选择')
    currentCategory.value = null
    return
  }

  selectedCategories.value.push({
    label: option.label,
    value: value,
    path: option.path || []
  })

  // 保存配置
  saveDefaultConfig()

  currentCategory.value = null
}

const handleRemoveCategory = (value: string) => {
  selectedCategories.value = selectedCategories.value.filter(cat => cat.value !== value)
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
    loading.value = true;
    tasks.value = [];
    const res = await collection1688.getTaskList({
      // userId: info.object.unb,
      pageNum: pagination.page || 1,
      pageSize: pagination.pageSize || 15
    });

    // 转换后端数据为前端格式
    tasks.value = res.data.map((task: any) => ({
      ...task,
      id: task.id.toString(),
      taskName: task.taskNo,
      count: task.daqCount,
      status: task.taskStatus === 1 ? 'completed' : 'collecting',
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

const handleStartCollection = async () => {
  if (selectedCategories.value.length === 0) {
    message.warning('请至少选择一个商品分类')
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
    // 调用创建任务接口
    const res = await collection1688.saveTask({
      industryNameList: selectedCategories.value.map(cat => cat.label),
      dayType: getDayTypeValue(settings.value.rankingTime),
      productCountPerIndustry: settings.value.maxProductsPerCategory,
      factoryCountPerProduct: settings.value.maxFactoriesPerProduct,
      userId: info.object.unb,
      cookie: info.cookie
    })

    if (res.success || res.code === '200') {
      message.success('采集任务已创建')
      // 刷新任务列表
      await loadTaskList()
    } else {
      message.error(res.message || '创建任务失败')
    }
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

const getStatusText = (status: CollectionTask['status']) => {
  const statusMap = {
    collecting: '采集中',
    completed: '已完成',
    failed: '失败',
    stopped: '已停止'
  }
  return statusMap[status]
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
function calcDurationMinSecText(start, end) {
  if (!start || !end) return '--'

  const startTime = Date.parse(start.replace(/-/g, '/'))
  const endTime = Date.parse(end.replace(/-/g, '/'))

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return '--'
  }

  const diffSeconds = Math.floor(Math.abs(endTime - startTime) / 1000)
  const minutes = Math.floor(diffSeconds / 60)
  const seconds = diffSeconds % 60

  // 始终显示 分 + 秒（哪怕为 0）
  return `耗时: ${minutes}m${seconds}s`
}

const columns: DataTableColumns<CollectionTask> = [
  {
    title: '采集任务',
    key: 'taskNo',
    width: 120,
    render(row: any) {
      return h(
        NTooltip,
        {
          trigger: 'hover'
        },
        {
          trigger: () => h('div', {}, [
            h('div', { class: 'font-weight-bold' }, row.taskNo),
            h(NText, { class: 'font-12 text-underline cusor-pointer', depth: 3 }, calcDurationMinSecText(row.createdAt, row.finishedAt))
          ]),
          default: () => h('div', {}, [
            h('div', `开始: ${formatDatetime(row.createdAt, { removeYear: false, removeSecond: false })}`),
            h('div', `结束: ${formatDatetime(row.finishedAt, { removeYear: false, removeSecond: false })}`)
          ])
        }
      )
    }
  },
  {
    title: '采集条数',
    key: 'count',
    width: 80,
    render: (row: any) => row.count || '--'
  },
  {
    title: '采集状态',
    key: 'status',
    width: 70,
    render: (row) => {
      return getStatusText(row.status);
    }
  },
  {
    title: '操作',
    key: 'actions',
    align: 'left',
    width: 100,
    render: (row) => {
      return h(NSpace, { size: 8, align: 'center', justify: 'center' }, () => [
        row.status === 'collecting' && h(
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
        (row.status === 'completed' || row.status === 'stopped') && h(
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
        (row.status === 'completed' || row.status === 'stopped' || row.status === 'failed') && h(
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
  const res = await common.getJnCategories();
  const categories = res.data[0]?.children || [];
  categoryOptions.value = categories;
  await set1688UserInfo();
  if (!isLoggedTo1688.value) {
    message.warning('请登录1688.com')
  }
  // 加载任务列表
  loadTaskList();

};
setup()
</script>

<style scoped></style>
