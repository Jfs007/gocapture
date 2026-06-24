<template>
  <MagnusPanel :api="api" />
</template>

<script setup lang="ts">
import MagnusPanel from './views/MagnusPanel.vue';

defineProps<{
  api: Record<string, any>;
}>();
</script>
