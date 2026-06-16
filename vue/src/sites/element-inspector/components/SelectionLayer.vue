<template>
  <div
    v-for="(item, index) in changedItems"
    :key="`${item.uid}-badge`"
    class="mda-change-badge"
    :style="selectionBadgeStyle(item, index)"
    title="查看这个选区的改动"
    @click.stop="api.openSelectionEditor(item)"
  >
    有改动
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useApi, useForm } from '../ctx';

const api = useApi();
const selectedItems = useForm('selectedItems');
const layoutTick = useForm('layoutTick');
const changedItems = computed(() => selectedItems.value.filter(item => hasChangeNote(item)));

function hasChangeNote(item) {
  return !!(item && item.changeNote && item.changeNote.trim());
}

function itemRect(item) {
  layoutTick.value;
  return item?.element && document.documentElement.contains(item.element)
    ? item.element.getBoundingClientRect()
    : item?.info?.viewportBox;
}

function round(value) {
  return Math.round(value);
}

function selectionBadgeStyle(item, index) {
  const rect = itemRect(item);
  const width = 62;
  const fallbackTop = 44 + index * 10;
  const fallbackLeft = 10 + index * 10;
  const left = rect ? Math.max(8, Math.min(rect.left + 8, window.innerWidth - width - 8)) : fallbackLeft;
  const top = rect ? Math.max(42, Math.min(rect.top - 28, window.innerHeight - 28)) : fallbackTop;
  return {
    left: `${round(left)}px`,
    top: `${round(top)}px`
  };
}
</script>
