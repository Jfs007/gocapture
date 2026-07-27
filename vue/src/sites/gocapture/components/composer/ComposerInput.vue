<template>
  <textarea
    ref="inputRef"
    :value="composerInputValue"
    class="mda-composer-input"
    :readonly="!composerEditable"
    :placeholder="composerPlaceholder"
    rows="1"
    @input="handleComposerInput"
    @click="handleComposerCursor"
    @keyup="handleComposerCursor"
    @select="handleComposerCursor"
    @focus="handleComposerCursor"
    @keydown="handleComposerKeydown"
  />
  <div
    ref="shortcutMenuRef"
    v-if="shortcutMenuOpen"
    class="mda-composer-shortcut"
  >
    <button
      v-for="(asset, index) in shortcutAssets"
      :key="asset.uid"
      class="mda-composer-shortcut-item"
      :class="{ 'is-active': index === shortcutActiveIndex }"
      type="button"
      @mousedown.prevent
      @click.prevent="selectShortcutAsset(asset)"
    >
      <span v-if="asset.thumbnailUrl" class="mda-composer-shortcut-thumb" :style="assetThumbStyle(asset)" />
      <span v-else class="mda-composer-shortcut-thumb is-empty">{{ asset.index }}</span>
      <span class="mda-composer-shortcut-meta">
        <strong>{{ asset.token }}</strong>
        <em>{{ asset.summary }}</em>
      </span>
    </button>
    <div v-if="!shortcutAssets.length" class="mda-composer-shortcut-empty">@ 无匹配选区</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useGoCaptureCommands } from '../../app/runtime/commands';
import { useComposerStore } from '../../stores/composer.store';
import { useModelStore } from '../../stores/model.store';
import { useProjectStore } from '../../stores/project.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';

const commands = useGoCaptureCommands();
const composerStore = useComposerStore();
const modelStore = useModelStore();
const projectStore = useProjectStore();
const searchStore = useSearchStore();
const selectionStore = useSelectionStore();
const inputRef = ref(null);
const shortcutMenuRef = ref(null);
const shortcutMenuOpen = ref(false);
const shortcutMenuQuery = ref('');
const shortcutRangeStart = ref(-1);
const shortcutRangeEnd = ref(-1);
const shortcutActiveIndex = ref(0);
const selectionStart = ref(0);
const selectionEnd = ref(0);
let shortcutMenuTimer = 0;

const composerEditable = computed(() => selectionStore.items.length > 0);
const composerPlaceholder = computed(() => {
  if (!projectStore.current) return '请选择项目源码';
  if (!selectionStore.items.length) return '移动鼠标高亮页面区域，按空格键添加选区';
  if (modelStore.status === 'running') return '模型定位中，可点击停止';
  if (searchStore.showCandidatePicker) return '请选择候选文件后继续';
  return '输入修改要求，可用 @选区 或 @选区1 引用已选区';
});
const promptAssets = computed(() => selectionStore.promptAssets);
const composerInputValue = computed(() => composerEditable.value ? composerStore.content : composerPlaceholder.value);

const shortcutAssets = computed(() => {
  const query = shortcutMenuQuery.value.trim().toLowerCase();
  const items = Array.isArray(promptAssets.value) ? promptAssets.value : [];
  if (!query) return items;
  return items.filter(asset => {
    const text = [
      asset.token,
      asset.label,
      asset.summary,
      asset.text,
      asset.className
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes(query);
  });
});

watch(composerInputValue, () => {
  nextTick(() => {
    syncComposerHeight();
  });
});

watch([promptAssets, composerEditable], ([assets, editable]) => {
  if (!editable || !(assets && assets.length)) closeShortcutMenu();
});

watch(shortcutAssets, assets => {
  if (!assets.length) {
    shortcutActiveIndex.value = 0;
    return;
  }
  if (shortcutActiveIndex.value >= assets.length) {
    shortcutActiveIndex.value = assets.length - 1;
  }
});

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);
  nextTick(() => {
    syncComposerHeight();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
  clearShortcutMenuTimer();
});

defineExpose({
  focusEvidenceInput(cursor = null) {
    focusComposer(cursor);
  },
  insertAsset(asset) {
    insertAssetToken(asset, { replaceMention: false });
  }
});

function handleGlobalPointerDown(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const insideShortcutMenu = shortcutMenuRef.value && path.includes(shortcutMenuRef.value);
  const insideComposerInput = inputRef.value && path.includes(inputRef.value);
  if (!insideShortcutMenu && !insideComposerInput) {
    closeShortcutMenu();
  }
}

function assetThumbStyle(asset) {
  return asset?.thumbnailUrl ? { backgroundImage: `url("${asset.thumbnailUrl}")` } : {};
}

function syncComposerHeight(target = inputRef.value) {
  if (!target) return;
  target.style.height = 'auto';
  target.style.height = `${Math.min(Math.max(target.scrollHeight, 72), 184)}px`;
}

function focusComposer(cursor = null) {
  nextTick(() => {
    if (!inputRef.value || typeof inputRef.value.focus !== 'function') return;
    inputRef.value.focus();
    if (cursor != null && typeof inputRef.value.setSelectionRange === 'function') {
      inputRef.value.setSelectionRange(cursor, cursor);
      selectionStart.value = cursor;
      selectionEnd.value = cursor;
    }
    syncComposerHeight(inputRef.value);
  });
}

function clearShortcutMenuTimer() {
  if (!shortcutMenuTimer) return;
  window.clearTimeout(shortcutMenuTimer);
  shortcutMenuTimer = 0;
}

function closeShortcutMenu() {
  clearShortcutMenuTimer();
  shortcutMenuOpen.value = false;
  shortcutMenuQuery.value = '';
  shortcutRangeStart.value = -1;
  shortcutRangeEnd.value = -1;
  shortcutActiveIndex.value = 0;
}

function resolveShortcutState(value, caret) {
  if (!promptAssets.value.length) return null;
  const before = String(value || '').slice(0, Math.max(0, caret));
  const match = before.match(/(^|[\s(（,，;；])@([^\s@]*)$/);
  if (!match) return null;
  return {
    start: before.length - match[2].length - 1,
    end: before.length,
    query: match[2] || ''
  };
}

function updateComposerSelection(target) {
  if (!target) return;
  selectionStart.value = Number(target.selectionStart || 0);
  selectionEnd.value = Number(target.selectionEnd || selectionStart.value);
}

function updateShortcutMenu(target) {
  if (!target || !composerEditable.value) {
    closeShortcutMenu();
    return;
  }
  const state = resolveShortcutState(target.value, target.selectionStart || 0);
  if (!state) {
    closeShortcutMenu();
    return;
  }
  shortcutMenuOpen.value = true;
  shortcutMenuQuery.value = state.query;
  shortcutRangeStart.value = state.start;
  shortcutRangeEnd.value = state.end;
  if (shortcutActiveIndex.value >= shortcutAssets.value.length) {
    shortcutActiveIndex.value = 0;
  }
}

function handleComposerInput(event) {
  composerStore.setContent(event?.target?.value || '');
  updateComposerSelection(event.target);
  updateShortcutMenu(event.target);
  syncComposerHeight(event.target);
}

function handleComposerCursor(event) {
  updateComposerSelection(event.target);
  updateShortcutMenu(event.target);
}

function moveShortcutActive(step) {
  if (!shortcutMenuOpen.value || !shortcutAssets.value.length) return;
  const total = shortcutAssets.value.length;
  shortcutActiveIndex.value = (shortcutActiveIndex.value + step + total) % total;
}

function handleComposerKeydown(event) {
  if (!shortcutMenuOpen.value) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveShortcutActive(1);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveShortcutActive(-1);
    return;
  }
  if (event.key === 'Tab') {
    if (!shortcutAssets.value.length) return;
    event.preventDefault();
    selectShortcutAsset(shortcutAssets.value[shortcutActiveIndex.value]);
    return;
  }
  if (event.key === 'Enter') {
    if (!shortcutAssets.value.length) return;
    event.preventDefault();
    selectShortcutAsset(shortcutAssets.value[shortcutActiveIndex.value]);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeShortcutMenu();
  }
}

function insertAssetToken(asset, options = {}) {
  if (!asset) return;
  const currentValue = String(composerInputValue.value || '');
  const replaceMention = !!options.replaceMention;
  const replaceStart = replaceMention && shortcutRangeStart.value >= 0
    ? shortcutRangeStart.value
    : Math.min(selectionStart.value, currentValue.length);
  const replaceEnd = replaceMention && shortcutRangeEnd.value >= replaceStart
    ? shortcutRangeEnd.value
    : Math.min(selectionEnd.value, currentValue.length);
  const before = currentValue.slice(0, replaceStart);
  const after = currentValue.slice(replaceEnd);
  const prefix = replaceMention || !before || /\s$/.test(before) ? '' : ' ';
  const suffix = after && /^\s/.test(after) ? '' : ' ';
  const nextValue = `${before}${prefix}${asset.token}${suffix}${after}`;
  const cursor = (before + prefix + asset.token + suffix).length;
  composerStore.setContent(nextValue);
  closeShortcutMenu();
  focusComposer(cursor);
}

function selectShortcutAsset(asset) {
  insertAssetToken(asset, { replaceMention: true });
}
</script>
