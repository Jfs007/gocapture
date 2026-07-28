<template>
  <span
    class="mda-model-brand-icon"
    :style="{ width: `${size}px`, height: `${size}px`, color: brand.color }"
    aria-hidden="true"
  >
    <svg v-if="brand.body" viewBox="0 0 24 24" v-html="brand.body"></svg>
    <b v-else>{{ brand.text }}</b>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { resolveModelBrand } from '../../config/model-brands';

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: Number, default: 20 }
});

const brand = computed(() => resolveModelBrand(props.name));
</script>
