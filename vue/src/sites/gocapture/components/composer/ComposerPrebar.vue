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
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useGoCaptureCommands } from '../../app/runtime/commands';
import { useComposerStore } from '../../stores/composer.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';

defineEmits(['insert-asset']);

const commands = useGoCaptureCommands();
const composerStore = useComposerStore();
const searchStore = useSearchStore();
const selectionStore = useSelectionStore();
const promptAssets = computed(() => selectionStore.promptAssets);
const includeApiEvidence = computed(() => searchStore.includeApiEvidence);
const candidateLoading = computed(() => searchStore.status === 'loading');
const promptText = computed(() => composerStore.finalPrompt);

function toggleApiEvidence() {
  commands.setIncludeApiEvidence(!includeApiEvidence.value);
  commands.onSearchOptionChange();
}

function assetTooltip(asset) {
  if (!asset) return '';
  return [
    `${asset.token} · 点击插入`,
    '可在设置页查看资产详情',
    asset.text ? `文案: ${asset.text}` : '',
    asset.className ? `class: ${asset.className}` : ''
  ].filter(Boolean).join('\n');
}

function assetThumbStyle(asset) {
  return asset?.thumbnailUrl ? { backgroundImage: `url("${asset.thumbnailUrl}")` } : {};
}

</script>
