<template>
  <div
    v-if="visible && anchorRect"
    class="mda-popover-panel"
    :style="panelStyle"
    @mouseenter="$emit('mouseenter')"
    @mouseleave="$emit('mouseleave')"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  anchorRect: {
    type: Object,
    default: null
  },
  width: {
    type: Number,
    default: 380
  },
  maxHeight: {
    type: Number,
    default: 360
  },
  placement: {
    type: String,
    default: 'auto'
  },
  gap: {
    type: Number,
    default: 10
  },
  viewportPadding: {
    type: Number,
    default: 12
  }
});

defineEmits(['mouseenter', 'mouseleave']);

const panelStyle = computed(() => {
  const rect = props.anchorRect;
  if (!props.visible || !rect) return {};
  const width = Math.min(props.width, Math.max(260, window.innerWidth - props.viewportPadding * 2));
  const left = Math.max(
    props.viewportPadding,
    Math.min(rect.left, window.innerWidth - width - props.viewportPadding)
  );
  const roomBelow = rect.bottom + props.gap + props.maxHeight <= window.innerHeight - props.viewportPadding;
  const roomAbove = rect.top - props.gap - props.maxHeight >= props.viewportPadding;
  const showBelow = props.placement === 'bottom'
    ? true
    : props.placement === 'top'
      ? !roomAbove && roomBelow
      : roomBelow;
  const top = showBelow
    ? rect.bottom + props.gap
    : Math.max(props.viewportPadding, rect.top - props.gap - props.maxHeight);
  return {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${Math.round(props.maxHeight)}px`
  };
});
</script>
