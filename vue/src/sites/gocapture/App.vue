<template>
  <SettingsPage v-if="isSettingsPage" :api="api" />
  <GoCapturePanel v-else :api="api" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GoCapturePanel from './views/GoCapturePanel.vue';
import SettingsPage from './views/SettingsPage.vue';

defineProps<{
  api: Record<string, any>;
}>();

const isSettingsPage = computed(() => {
  return typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/settings';
});
</script>
