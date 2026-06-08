<template>
  <n-layout class="layout">
    <n-layout-content class="content">
      <n-space vertical :size="16">
        <n-card>
          <n-space vertical :size="12">
            <n-space justify="space-between" align="center">
              <div>
                <n-text class="title">Chrome Extension Scaffold</n-text>
                <n-text depth="3" class="subtitle">Bridge playground</n-text>
              </div>
              <n-tag :color="bridgeReady ? readyColor : pendingColor">
                {{ bridgeReady ? 'ready' : 'standalone' }}
              </n-tag>
            </n-space>

            <n-space>
              <n-button type="primary" @click="loadManifest">Manifest</n-button>
              <n-button @click="emitPing">Emit</n-button>
              <n-button @click="refreshStatus">Refresh</n-button>
            </n-space>
          </n-space>
        </n-card>

        <n-card>
          <n-code :code="output" language="json" word-wrap />
        </n-card>
      </n-space>
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  NButton,
  NCard,
  NCode,
  NLayout,
  NLayoutContent,
  NSpace,
  NTag,
  NText
} from 'naive-ui'

const output = ref('')

const getBridge = () => {
  try {
    return window._require?.('mdChrome')?.web
  } catch (error) {
    return null
  }
}

const bridgeReady = computed(() => !!getBridge())
const readyColor = { color: '#e7f8ef', textColor: '#17834a', borderColor: '#9ee0bd' }
const pendingColor = { color: '#f1f3f7', textColor: '#606572', borderColor: '#d8dde8' }

const setOutput = (value: unknown) => {
  output.value = JSON.stringify(value, null, 2)
}

const refreshStatus = () => {
  const env = window.__PLG__ENV__ || {}
  setOutput({ bridgeReady: bridgeReady.value, env })
}

const loadManifest = async () => {
  const bridge = getBridge()
  if (!bridge) {
    refreshStatus()
    return
  }
  setOutput(await bridge.cmd({ cmd: 'get-manifest' }))
}

const emitPing = async () => {
  const bridge = getBridge()
  if (!bridge) {
    refreshStatus()
    return
  }
  bridge.send('scaffold:ping', { at: Date.now() })
  setOutput({ event: 'scaffold:ping', sent: true })
}

refreshStatus()
</script>

<style scoped>
.layout {
  min-height: 100vh;
  background: #f6f7fb;
}

.content {
  max-width: 760px;
  margin: 0 auto;
  padding: 24px;
}

.title {
  display: block;
  font-size: 20px;
  font-weight: 650;
}

.subtitle {
  display: block;
  margin-top: 2px;
  font-size: 13px;
}
</style>
