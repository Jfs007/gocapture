<template>
  <SettingsPage v-if="isSettingsPage" :api="api" />
  <MagnusPanel v-else :api="api" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MagnusPanel from './views/MagnusPanel.vue';
import SettingsPage from './views/SettingsPage.vue';

defineProps<{
  api: Record<string, any>;
}>();

const isSettingsPage = computed(() => {
  return typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/settings';
});
</script>
