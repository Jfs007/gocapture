<template>
  <n-layout style="height: 100vh;">
    <n-layout-content style="padding: 0 8px;">
      <n-tabs v-model:value="activeTab" type="line" animated>
        <n-tab-pane name="1688" tab="1688厂家收集">
          <Collection1688 />
        </n-tab-pane>

        <n-tab-pane name="douyin" tab="抖音商家收集" :disabled="true">
          <n-card title="抖音商家收集" style="margin-top: 16px;">
            <n-empty description="功能开发中...">
              <template #extra>
                <n-text depth="3">
                  此功能用于收集抖音平台的商家信息
                </n-text>
              </template>
            </n-empty>
          </n-card>
        </n-tab-pane>
      </n-tabs>
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  NLayout,
  NLayoutContent,
  NText,
  NTabs,
  NTabPane,
  NCard,
  NEmpty
} from 'naive-ui'
import Collection1688 from './Collection1688.vue'

const activeTab = ref('1688')
</script>

<style scoped></style>
