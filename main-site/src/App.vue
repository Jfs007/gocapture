<template>
  <n-config-provider :theme="theme">
    <n-space vertical>
      <n-layout>
        <n-layout-header style="padding: 24px">
          <n-space align="center" justify="space-between">
            <n-h1 style="margin: 0">Main Site</n-h1>
            <n-button @click="toggleTheme">
              切换主题
            </n-button>
          </n-space>
        </n-layout-header>
        <n-layout-content style="padding: 24px">
          <n-card title="欢迎使用 Vue3 + Naive UI">
            <n-space vertical>
              <n-text>这是一个基于 Vue3 + TypeScript + Naive UI 的项目</n-text>
              <n-divider />
              <n-space>
                <n-button type="primary">主要按钮</n-button>
                <n-button type="info">信息按钮</n-button>
                <n-button type="success">成功按钮</n-button>
                <n-button type="warning">警告按钮</n-button>
                <n-button type="error">错误按钮</n-button>
              </n-space>
            </n-space>
          </n-card>
        </n-layout-content>
      </n-layout>
    </n-space>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  NConfigProvider,
  NSpace,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NH1,
  NButton,
  NCard,
  NText,
  NDivider,
  darkTheme,
  type GlobalTheme
} from 'naive-ui'

const theme = ref<GlobalTheme | null>(null)

const toggleTheme = () => {
  theme.value = theme.value === null ? darkTheme : null
}
</script>

<style scoped>
</style>
