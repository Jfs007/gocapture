<template>
  <div class="mda-composer-prebar">
    <div class="mda-composer-prebar-main">
      <button
        class="mda-assist-chip"
        :class="{ 'is-active': includeApiEvidence }"
        type="button"
        :disabled="candidateLoading || !!promptText"
        @click="toggleApiEvidence"
      >
        <span class="mda-chip-shield" />
        <span>接口线索</span>
      </button>
      <div v-if="promptAssets.length" class="mda-asset-strip">
        <article
          v-for="asset in promptAssets"
          :key="asset.token"
          class="mda-asset-card"
        >
          <div
            class="mda-asset-chip"
            role="button"
            tabindex="0"
            :title="assetTooltip(asset)"
            @mouseenter="openAssetPopover(asset, $event)"
            @mouseleave="scheduleAssetPopoverHide(asset.uid)"
            @click="$emit('insert-asset', asset)"
            @keydown.enter.prevent="$emit('insert-asset', asset)"
            @keydown.space.prevent="$emit('insert-asset', asset)"
          >
            <span v-if="asset.thumbnailUrl" class="mda-asset-thumb" :style="assetThumbStyle(asset)" />
            <span v-else class="mda-asset-thumb is-empty">{{ asset.index }}</span>
            <button class="mda-asset-remove" type="button" title="移除这个选区" @click.stop="commands.removeSelection(asset.uid)">×</button>
          </div>
        </article>
      </div>
    </div>

    <PopoverPanel
      :visible="!!activeAssetPopover"
      :anchor-rect="activeAssetPopoverRect"
      :width="344"
      placement="top"
      :gap="6"
      :max-height="320"
      @mouseenter="cancelAssetPopoverHide"
      @mouseleave="scheduleAssetPopoverHide()"
    >
      <article v-if="activeAssetPopover" class="mda-asset-popover">
        <header class="mda-asset-popover-head">
          <div class="mda-asset-popover-badge">{{ activeAssetPopover.token }}</div>
          <div class="mda-asset-popover-title-wrap">
            <strong class="mda-asset-popover-title">{{ activeAssetPopover.label }}</strong>
            <div class="mda-asset-popover-subtitle">
              {{ activeAssetPopover.selector || activeAssetPopover.className || activeAssetPopover.text || '-' }}
            </div>
          </div>
        </header>

        <div class="mda-asset-popover-grid">
          <div class="mda-asset-popover-grid-item">
            <span>选区文案</span>
            <pre>{{ activeAssetPopover.text || '-' }}</pre>
          </div>
          <div class="mda-asset-popover-grid-item">
            <span>选区 selector</span>
            <pre>{{ activeAssetPopover.selector || '-' }}</pre>
          </div>
          <div class="mda-asset-popover-grid-item">
            <span>选区 class</span>
            <pre>{{ activeAssetPopover.className || '-' }}</pre>
          </div>
          <div class="mda-asset-popover-grid-item">
            <span>选区盒模型</span>
            <pre>{{ formatAssetValue(activeAssetPopover.box) }}</pre>
          </div>
          <div class="mda-asset-popover-grid-item">
            <span>扩大选区 selector</span>
            <pre>{{ activeAssetPopover.assetSelector || '-' }}</pre>
          </div>
          <div class="mda-asset-popover-grid-item">
            <span>扩大选区盒模型</span>
            <pre>{{ formatAssetValue(activeAssetPopover.assetBox) }}</pre>
          </div>
        </div>

        <section
          v-for="section in assetDetailSections(activeAssetPopover)"
          :key="section.label"
          class="mda-asset-popover-section"
        >
          <span>{{ section.label }}</span>
          <pre>{{ section.value }}</pre>
        </section>
      </article>
    </PopoverPanel>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useMagnusCommands } from '../../app/runtime/commands';
import { useComposerStore } from '../../stores/composer.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';
import PopoverPanel from '../common/PopoverPanel.vue';

defineEmits(['insert-asset']);

const commands = useMagnusCommands();
const composerStore = useComposerStore();
const searchStore = useSearchStore();
const selectionStore = useSelectionStore();
const promptAssets = computed(() => selectionStore.promptAssets);
const includeApiEvidence = computed(() => searchStore.includeApiEvidence);
const candidateLoading = computed(() => searchStore.status === 'loading');
const promptText = computed(() => composerStore.finalPrompt);
const activeAssetPopoverUid = ref('');
const activeAssetPopoverRect = ref(null);
let activeAssetPopoverAnchor = null;
let assetPopoverTimer = 0;

const activeAssetPopover = computed(() => {
  return promptAssets.value.find(item => item.uid === activeAssetPopoverUid.value) || null;
});

onMounted(() => {
  window.addEventListener('scroll', updateAssetPopoverRect, true);
  window.addEventListener('resize', updateAssetPopoverRect, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateAssetPopoverRect, true);
  window.removeEventListener('resize', updateAssetPopoverRect, true);
  clearAssetPopoverTimer();
});

function toggleApiEvidence() {
  commands.setIncludeApiEvidence(!includeApiEvidence.value);
  commands.onSearchOptionChange();
}

function assetTooltip(asset) {
  if (!asset) return '';
  return [
    `${asset.token} · 点击插入`,
    '悬浮查看节点详情',
    asset.text ? `文案: ${asset.text}` : '',
    asset.className ? `class: ${asset.className}` : ''
  ].filter(Boolean).join('\n');
}

function assetThumbStyle(asset) {
  return asset?.thumbnailUrl ? { backgroundImage: `url("${asset.thumbnailUrl}")` } : {};
}

function formatAssetValue(value) {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function assetDetailSections(asset) {
  if (!asset) return [];
  return [
    { label: '选区 inline style', value: asset.inlineStyle || '-' },
    { label: '选区 computed style', value: formatAssetValue(asset.computedStyle) },
    { label: '选区 innerHTML', value: asset.innerHtml || '-' },
    { label: '扩大选区文案', value: asset.assetText || '-' },
    { label: '扩大选区 inline style', value: asset.assetInlineStyle || '-' },
    { label: '扩大选区 computed style', value: formatAssetValue(asset.assetComputedStyle) },
    { label: '扩大选区 innerHTML', value: asset.assetInnerHtml || '-' }
  ];
}

function updateAssetPopoverRect() {
  if (!activeAssetPopoverAnchor || !activeAssetPopoverAnchor.isConnected) return;
  activeAssetPopoverRect.value = activeAssetPopoverAnchor.getBoundingClientRect();
}

function clearAssetPopoverTimer() {
  if (!assetPopoverTimer) return;
  window.clearTimeout(assetPopoverTimer);
  assetPopoverTimer = 0;
}

function cancelAssetPopoverHide() {
  clearAssetPopoverTimer();
}

function closeAssetPopover() {
  clearAssetPopoverTimer();
  activeAssetPopoverUid.value = '';
  activeAssetPopoverRect.value = null;
  activeAssetPopoverAnchor = null;
  commands.restoreSelectionPreview();
}

function scheduleAssetPopoverHide(uid = '') {
  clearAssetPopoverTimer();
  assetPopoverTimer = window.setTimeout(() => {
    if (!uid || activeAssetPopoverUid.value === uid) closeAssetPopover();
  }, 220);
}

function openAssetPopover(asset, event) {
  if (!asset) return;
  clearAssetPopoverTimer();
  commands.previewSelection(asset);
  activeAssetPopoverUid.value = asset.uid;
  activeAssetPopoverAnchor = event?.currentTarget || null;
  updateAssetPopoverRect();
  window.requestAnimationFrame(updateAssetPopoverRect);
}
</script>
