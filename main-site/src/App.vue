<template>
  <n-config-provider :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <LoginPage v-if="!isLogin" />
      <MainLayout v-else />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NConfigProvider, NMessageProvider, zhCN, dateZhCN } from 'naive-ui'
import { useLogin } from './hooks/useLogin'
import LoginPage from './components/LoginPage.vue'
import MainLayout from './components/MainLayout.vue'
// 获取 CSS 变量的计算值
const getCssVar = (name: string): string => {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '';
}

// 使用 ref 来存储主题配置，以便在 onMounted 后更新
const themeOverrides = ref({
  common: {
    successColor: getCssVar('--success-color') || '#22B46B',
    warningColor: '#FDAA29',
    errorColor: getCssVar('--error-color') || '#FD494D',
    textColorBase: getCssVar('--text-color-base') || '#1F2225',
    textColorDisabled: '#888',
    infoColor: getCssVar('--n-color') || "#3777FF",
    primaryColor: getCssVar('--primary-color') || '#3777FF',
    primaryColorHover: getCssVar('--primary-color-hover') || 'rgba(55, 119, 255, 0.9)',
    primaryColorPressed: getCssVar('--primary-color') || '#3777FF',
    primaryColorSuppl: getCssVar('--primary-color-hover') || 'rgba(55, 119, 255, 0.9)',
  },
  Input: {
    height: 30
  }
});
const { isLogin, login } = useLogin()
const url = new URL(location.href)

const token = url.searchParams.get('token') as string
login({ token })
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
