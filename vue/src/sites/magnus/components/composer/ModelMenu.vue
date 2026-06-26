<template>
  <div ref="menuRef" class="mda-model-menu">
    <button
      class="mda-model-trigger"
      :class="{ 'is-active': !!selectedModelId }"
      type="button"
      :disabled="candidateLoading || modelAssistLoading"
      @click="toggleMenu"
    >
      <strong>{{ activeModelLabel }}</strong>
      <em v-if="activeModelMeta">{{ activeModelMeta }}</em>
      <i />
    </button>

    <div v-if="open" class="mda-model-dropdown">
      <button
        class="mda-model-option"
        :class="{ 'is-selected': !selectedModelId }"
        type="button"
        @click="selectDisabledModel"
      >
        <span>不启用</span>
      </button>
      <button
        v-for="model in modelConfigs"
        :key="model.id"
        class="mda-model-option"
        :class="{ 'is-selected': selectedModelId === model.id }"
        type="button"
        @click="selectSavedModel(model)"
      >
        <span>{{ model.name }}</span>
        <em>{{ modelOptionMeta(model) }}</em>
      </button>
      <div v-if="modelConfigs.length" class="mda-model-divider"></div>
      <button
        v-if="selectedModel"
        class="mda-model-option"
        type="button"
        @click="editSelectedModel"
      >
        <span>配置当前模型</span>
      </button>
      <button
        class="mda-model-option"
        type="button"
        @click="createDeepSeekModel"
      >
        <span>DeepSeek</span>
        <em>API</em>
      </button>
      <button
        class="mda-model-option"
        type="button"
        @click="createCustomApiModel"
      >
        <span>新增 API 模型</span>
      </button>
      <button
        class="mda-model-option"
        type="button"
        @click="createExecModel"
      >
        <span>新增 Cli 模型</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useMagnusCommands } from '../../app/runtime/commands';
import { useModelStore } from '../../stores/model.store';
import { useSearchStore } from '../../stores/search.store';

const commands = useMagnusCommands();
const modelStore = useModelStore();
const searchStore = useSearchStore();
const menuRef = ref(null);
const open = ref(false);
const modelConfigs = computed(() => modelStore.configs);
const selectedModelId = computed(() => modelStore.selectedModelId);
const selectedModel = computed(() => modelStore.selectedModel);
const modelAssistLoading = computed(() => modelStore.status === 'running');
const candidateLoading = computed(() => searchStore.status === 'loading');

const activeModelLabel = computed(() => {
  return selectedModel.value?.name || '不启用';
});

const activeModelMeta = computed(() => {
  if (!selectedModel.value) return '';
  if (modelAssistLoading.value) return '定位中';
  if (selectedModel.value.provider === 'deepseek') return 'DeepSeek API';
  return formatModelType(selectedModel.value.type);
});

watch(modelAssistLoading, value => {
  if (value) open.value = false;
});

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
});

function handleGlobalPointerDown(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (menuRef.value && (path.includes(menuRef.value) || menuRef.value.contains(event.target))) return;
  open.value = false;
}

function toggleMenu() {
  open.value = !open.value;
}

function closeMenu() {
  open.value = false;
}

function modelOptionMeta(model) {
  if (!model) return '';
  if (model.provider === 'deepseek') return 'DeepSeek API';
  return formatModelType(model.type);
}

function formatModelType(type) {
  return type === 'api' ? 'API' : 'Cli';
}

function selectDisabledModel() {
  commands.disableModelAssist();
  closeMenu();
}

function selectSavedModel(model) {
  if (!model) return;
  commands.selectModelAndEnable(model.id);
  closeMenu();
}

function editSelectedModel() {
  closeMenu();
  commands.openModelEditor(selectedModel.value);
}

function createDeepSeekModel() {
  closeMenu();
  commands.openProviderModelEditor('deepseek');
}

function createCustomApiModel() {
  closeMenu();
  commands.openModelEditor({
    id: '',
    name: '',
    provider: 'custom',
    type: 'api',
    command: '',
    endpoint: '',
    apiKey: '',
    model: '',
    proxyUrl: '',
    timeoutMs: 120000
  });
}

function createExecModel() {
  closeMenu();
  commands.openModelEditor();
}
</script>
