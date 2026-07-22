<template>
  <Teleport to="body">
    <div
      v-if="modelEditorOpen"
      class="mda-model-modal"
      role="presentation"
      @click.self="commands.closeModelEditor"
    >
      <section
        ref="dialogRef"
        class="mda-model-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mda-model-editor-title"
        tabindex="-1"
        @keydown.esc.prevent.stop="commands.closeModelEditor"
      >
        <div class="mda-model-editor-head">
          <div>
            <strong id="mda-model-editor-title">模型配置</strong>
            <p>配置用于源码定位与修改计划的 API 模型。</p>
          </div>
          <button class="mda-model-close" type="button" aria-label="关闭模型配置" title="关闭" @click="commands.closeModelEditor">×</button>
        </div>
        <div class="mda-model-editor-body">
          <div class="mda-model-grid">
            <label v-if="modelConfigs.length" class="is-wide">
              <span>当前模型</span>
              <select :value="selectedModelId" class="mda-model-input" @change="onModelEditorSelect">
                <option value="">新增模型</option>
                <option v-for="model in modelConfigs" :key="model.id" :value="model.id">
                  {{ model.name }} · {{ formatModelType(model.type) }}
                </option>
              </select>
            </label>
            <label>
              <span>供应商</span>
              <select :value="modelForm.provider || 'custom'" class="mda-model-input" @change="onModelProviderChange">
                <option value="custom">自定义</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </label>
            <label>
              <span>名称</span>
              <input v-model="modelForm.name" class="mda-model-input" placeholder="Codex / Claude / OpenAI">
            </label>
            <label class="is-wide">
              <span>Endpoint</span>
              <input v-model="modelForm.endpoint" class="mda-model-input" placeholder="https://api.openai.com/v1/chat/completions">
            </label>
            <label v-if="modelForm.provider === 'deepseek'">
              <span>Model</span>
              <select v-model="modelForm.model" class="mda-model-input">
                <option value="deepseek-v4-pro">deepseek-v4-pro</option>
                <option value="deepseek-v4-flash">deepseek-v4-flash</option>
              </select>
            </label>
            <label v-else>
              <span>Model</span>
              <input v-model="modelForm.model" class="mda-model-input" placeholder="gpt-4.1">
            </label>
            <label>
              <span>API Key</span>
              <input v-model="modelForm.apiKey" class="mda-model-input" type="password" placeholder="sk-...">
            </label>
            <label class="is-wide">
              <span>代理地址</span>
              <input v-model="modelForm.proxyUrl" class="mda-model-input" placeholder="http://127.0.0.1:7890，可留空">
            </label>
            <label>
              <span>超时 ms</span>
              <input v-model.number="modelForm.timeoutMs" class="mda-model-input" type="number" min="5000" step="1000">
            </label>
          </div>
          <p class="mda-model-hint">{{ modelTypeHint }}</p>
        </div>
        <div class="mda-model-actions">
          <button v-if="selectedModel" class="mda-mini-btn mda-model-delete" type="button" :disabled="candidateLoading || modelAssistLoading" @click="commands.removeSelectedModel">删除模型</button>
          <button class="mda-mini-btn" type="button" @click="commands.closeModelEditor">取消</button>
          <button class="mda-btn mda-btn-primary" type="button" @click="commands.saveModelForm">保存模型</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useMagnusCommands } from '../../app/runtime/commands';
import { useModelStore } from '../../stores/model.store';
import { useSearchStore } from '../../stores/search.store';

const commands = useMagnusCommands();
const modelStore = useModelStore();
const searchStore = useSearchStore();
const modelConfigs = computed(() => modelStore.configs);
const selectedModelId = computed(() => modelStore.selectedModelId);
const selectedModel = computed(() => modelStore.selectedModel);
const modelEditorOpen = computed(() => modelStore.editorOpen);
const modelForm = computed({
  get: () => modelStore.form,
  set: value => {
    modelStore.form = value || {};
  }
});
const modelAssistLoading = computed(() => modelStore.status === 'running');
const candidateLoading = computed(() => searchStore.status === 'loading');
const dialogRef = ref(null);

watch(modelEditorOpen, open => {
  if (!open) return;
  nextTick(() => dialogRef.value?.focus());
});

const modelTypeHint = computed(() => {
  return '仅支持 OpenAI Chat Completions 兼容的 API 模型。';
});

function onModelEditorSelect(event) {
  const id = event.target.value || '';
  if (!id) {
    commands.setSelectedModel('');
    commands.openModelEditor();
    return;
  }
  const model = modelConfigs.value.find(item => item.id === id);
  commands.setSelectedModel(id);
  commands.openModelEditor(model);
}

function onModelProviderChange(event) {
  const provider = event.target.value || 'custom';
  if (provider === 'deepseek') {
    modelForm.value = {
      ...modelForm.value,
      provider: 'deepseek',
      type: 'api',
      endpoint: 'https://api.deepseek.com/chat/completions',
      model: modelForm.value.model || 'deepseek-v4-pro',
      name: modelForm.value.name || 'DeepSeek'
    };
    return;
  }
  modelForm.value = {
    ...modelForm.value,
    provider: 'custom'
  };
}

function formatModelType(type) {
  return 'API';
}
</script>
