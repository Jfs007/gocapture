<template>
  <section class="mda-composer-wrap">
    <div v-if="showCandidatePicker" class="mda-composer-options">
      <div class="mda-collapsible-head">
        <div class="mda-option-title">存在多个命中文件，请确认</div>
        <button class="mda-collapse-btn" type="button" @click="candidatePanelCollapsed = !candidatePanelCollapsed">
          {{ candidatePanelCollapsed ? '展开' : '收起' }}
        </button>
      </div>
      <div v-if="candidatePanelCollapsed" class="mda-collapsed-summary">
        已选 {{ selectedCandidatePaths.length || 0 }} / {{ candidateHits.length }} 个文件
      </div>
      <div v-else class="mda-choice-list">
        <article
          v-for="hit in candidateHits"
          :key="hit.file"
          class="mda-choice-card"
          :class="{ 'is-selected': isCandidateSelected(hit) }"
        >
          <div class="mda-choice-check">
            <input type="checkbox" :checked="isCandidateSelected(hit)" @change="api.toggleCandidateFile(hit)">
            <button class="mda-file-link" type="button" @click.stop="api.openSourceFile(hit.file)">{{ hit.file }}</button>
          </div>
          <div class="mda-choice-meta">{{ candidateStageLabel(hit) }} · {{ hit.score }}</div>
          <button class="mda-link-btn" type="button" @click="api.toggleCandidateDetail(hit)">
            {{ expandedCandidatePath === hit.file ? '收起' : candidateDetailTitle(hit) }}
          </button>
          <pre v-if="expandedCandidatePath === hit.file" class="mda-candidate-log">{{ candidateLogText(hit) }}</pre>
        </article>
      </div>
    </div>

    <div v-if="needsMoreEvidence" class="mda-composer-options">
      <div class="mda-option-title">线索不足，需要补充页面证据</div>
      <div class="mda-option-desc">这些候选文件缺少唯一命中文案，可能是重复复制粘贴的组件。请继续在页面上选择更外层/更独特的区域，或在输入框补充页面位置、业务模块、交互目标。</div>
    </div>

    <div v-if="selectedItems.length" class="mda-selection-tags-panel">
      <div class="mda-collapsible-head">
        <div class="mda-option-title">选区 {{ selectedItems.length }}</div>
        <button class="mda-collapse-btn" type="button" @click="selectionPanelCollapsed = !selectionPanelCollapsed">
          {{ selectionPanelCollapsed ? '展开' : '收起' }}
        </button>
      </div>

      <div v-if="selectionPanelCollapsed" class="mda-collapsed-summary">
        {{ selectionCollapsedSummary }}
      </div>

      <template v-else>
        <div class="mda-selection-tags">
          <button
            v-for="(item, index) in selectedItems"
            :key="item.uid"
            class="mda-selection-tag"
            :class="{ 'is-active': item.uid === editingUid, 'has-note': hasChangeNote(item) }"
            type="button"
            @click="api.openSelectionEditor(item)"
          >
            <span>{{ selectionTagLabel(item, index) }}</span>
            <em v-if="hasChangeNote(item)">有改动</em>
          </button>
        </div>

        <div v-if="editingSelection" class="mda-selection-detail">
          <div class="mda-selection-detail-head">
            <div class="mda-selection-detail-title">{{ selectedNodeTitle(editingSelection) }}</div>
            <button class="mda-mini-btn" type="button" @click="api.removeSelection(editingSelection.uid)">移除</button>
          </div>
          <div class="mda-selection-detail-grid">
            <span>class</span>
            <strong>{{ editingSelection.info.className || '-' }}</strong>
            <span>文案</span>
            <strong>{{ shortText(editingSelection.info.text) || '-' }}</strong>
          </div>
          <textarea
            :value="editingSelection.changeNote"
            :data-selection-uid="editingSelection.uid"
            class="mda-selection-note"
            rows="3"
            placeholder="输入这个选区的改动点"
            @input="api.updateSelectionNote(editingSelection.uid, $event.target.value)"
          />
        </div>
      </template>
    </div>

    <div v-if="modelEditorOpen" class="mda-model-editor">
      <div class="mda-model-editor-head">
        <strong>模型适配器</strong>
        <button class="mda-mini-btn" type="button" @click="api.closeModelEditor">关闭</button>
      </div>
      <div class="mda-model-grid">
        <label v-if="modelConfigs.length" class="is-wide">
          <span>当前模型</span>
          <select :value="selectedModelId" class="mda-model-input" @change="onModelEditorSelect">
            <option value="">新增模型</option>
            <option v-for="model in modelConfigs" :key="model.id" :value="model.id">
              {{ model.name }} · {{ model.type }}
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
        <label>
          <span>类型</span>
          <select v-model="modelForm.type" class="mda-model-input">
            <option value="exec">exec</option>
            <option value="api">api</option>
          </select>
        </label>
        <label v-if="modelForm.type === 'exec'" class="is-wide">
          <span>命令</span>
          <input v-model="modelForm.command" class="mda-model-input" placeholder="codex exec">
        </label>
        <label v-if="modelForm.type === 'api'" class="is-wide">
          <span>Endpoint</span>
          <input v-model="modelForm.endpoint" class="mda-model-input" placeholder="https://api.openai.com/v1/chat/completions">
        </label>
        <label v-if="modelForm.type === 'api' && modelForm.provider === 'deepseek'">
          <span>Model</span>
          <select v-model="modelForm.model" class="mda-model-input">
            <option value="deepseek-v4-pro">deepseek-v4-pro</option>
            <option value="deepseek-v4-flash">deepseek-v4-flash</option>
          </select>
        </label>
        <label v-else-if="modelForm.type === 'api'">
          <span>Model</span>
          <input v-model="modelForm.model" class="mda-model-input" placeholder="gpt-4.1">
        </label>
        <label v-if="modelForm.type === 'api'">
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
      <div class="mda-model-actions">
        <button v-if="selectedModel" class="mda-mini-btn" type="button" :disabled="candidateLoading || modelAssistLoading" @click="api.removeSelectedModel">删除模型</button>
        <button class="mda-btn mda-btn-primary" type="button" @click="api.saveModelForm">保存模型</button>
      </div>
    </div>

    <div class="mda-composer-prebar">
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
    </div>

    <div class="mda-composer">
      <input
        ref="evidenceInput"
        :value="composerInputValue"
        class="mda-composer-input"
        :readonly="!composerEditable"
        :placeholder="composerPlaceholder"
        @input="api.onComposerInput"
        @keydown.enter.prevent="api.sendComposer"
      >
      <div class="mda-composer-toolbar">
        <div class="mda-toolbar-left">
          <button
            v-if="project"
            class="mda-tool-icon-btn"
            type="button"
            title="重新选择项目"
            :disabled="sourceServiceStatus === 'loading'"
            @click="api.chooseProject"
          />
          <button v-if="selectedItems.length" class="mda-inline-text-btn" type="button" @click="api.clearSelections">清空选区</button>
        </div>
        <div class="mda-toolbar-right">
          <div ref="modelMenuRef" class="mda-model-menu">
            <button
              class="mda-model-trigger"
              :class="{ 'is-active': !!selectedModelId }"
              type="button"
              :disabled="candidateLoading || modelAssistLoading"
              @click="toggleModelMenu"
            >
              <strong>{{ activeModelLabel }}</strong>
              <em v-if="activeModelMeta">{{ activeModelMeta }}</em>
              <i />
            </button>

            <div v-if="modelMenuOpen" class="mda-model-dropdown">
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
                <span>新增 Exec 模型</span>
              </button>
            </div>
          </div>
          <button class="mda-send-btn" type="button" :disabled="!composerCanSend" @click="api.sendComposer">
            <span v-if="candidateLoading">{{ modelAssistLoading ? '模型' : '检索' }}</span>
            <span v-else class="mda-send-arrow" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="routeResolverTrace" class="mda-route-inline">
      <span class="mda-route-label">页面源码地址</span>
      <button v-if="routeFilePath" class="mda-route-file" type="button" @click="api.openSourceFile(routeFilePath)">
        {{ routeFilePath }}
      </button>
      <span v-else class="mda-route-empty">暂无命中</span>
      <button
        v-if="routeFilePath"
        class="mda-copy-icon"
        type="button"
        title="复制页面源码地址"
        aria-label="复制页面源码地址"
        @click="copyRouteFilePath"
      />
    </div>

    <div class="mda-toast">{{ toastText }}</div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { candidateDetailTitle, candidateLogText, candidateStageLabel } from '../candidate-presenter';
import { useApi, useForm } from '../ctx';

const evidenceInput = ref(null);
const modelMenuRef = ref(null);
const modelMenuOpen = ref(false);
const candidatePanelCollapsed = ref(false);
const selectionPanelCollapsed = ref(false);
const api = useApi();
const showCandidatePicker = useForm('showCandidatePicker');
const needsMoreEvidence = useForm('needsMoreEvidence');
const candidateHits = useForm('candidateHits');
const selectedCandidatePaths = useForm('selectedCandidatePaths');
const expandedCandidatePath = useForm('expandedCandidatePath');
const includeApiEvidence = useForm('includeApiEvidence');
const candidateLoading = useForm('candidateLoading');
const promptText = useForm('promptText');
const selectedItems = useForm('selectedItems');
const editingUid = useForm('editingUid');
const project = useForm('project');
const modelConfigs = useForm('modelConfigs');
const selectedModelId = useForm('selectedModelId');
const selectedModel = useForm('selectedModel');
const modelEditorOpen = useForm('modelEditorOpen');
const modelForm = useForm('modelForm');
const modelAssistLoading = useForm('modelAssistLoading');
const routeResolverTrace = useForm('routeResolverTrace');
const sourceServiceStatus = useForm('sourceServiceStatus');
const composerInputValue = useForm('composerInputValue');
const composerEditable = useForm('composerEditable');
const composerPlaceholder = useForm('composerPlaceholder');
const composerCanSend = useForm('composerCanSend');
const toastText = useForm('toastText');

const routeHit = computed(() => {
  const trace = routeResolverTrace.value;
  if (!trace || !trace.matched || !Array.isArray(trace.hits) || !trace.hits.length) return null;
  return trace.hits[0];
});

const routeFilePath = computed(() => routeHit.value?.file || '');

const editingSelection = computed(() => {
  return selectedItems.value.find(item => item.uid === editingUid.value) || null;
});

const selectionCollapsedSummary = computed(() => {
  const changedCount = selectedItems.value.filter(item => hasChangeNote(item)).length;
  const active = editingSelection.value ? selectedNodeTitle(editingSelection.value) : selectionTagLabel(selectedItems.value[0], 0);
  return `${active}；${changedCount}/${selectedItems.value.length} 个有改动`;
});

const activeModelLabel = computed(() => {
  return selectedModel.value?.name || '不启用';
});

const activeModelMeta = computed(() => {
  if (!selectedModel.value) return '';
  if (modelAssistLoading.value) return '定位中';
  if (selectedModel.value.provider === 'deepseek') return 'DeepSeek API';
  return selectedModel.value.type === 'api' ? 'API' : 'Exec';
});

watch(modelAssistLoading, value => {
  if (!value) return;
  candidatePanelCollapsed.value = true;
  selectionPanelCollapsed.value = true;
  modelMenuOpen.value = false;
});

function handleGlobalPointerDown(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (modelMenuRef.value && (path.includes(modelMenuRef.value) || modelMenuRef.value.contains(event.target))) return;
  modelMenuOpen.value = false;
}

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
});

defineExpose({
  focusEvidenceInput() {
    if (evidenceInput.value && typeof evidenceInput.value.focus === 'function') {
      evidenceInput.value.focus();
    }
  }
});

function isCandidateSelected(hit) {
  return !!hit && selectedCandidatePaths.value.includes(hit.file);
}

function toggleApiEvidence() {
  api.setIncludeApiEvidence(!includeApiEvidence.value);
  api.onSearchOptionChange();
}

function onModelEditorSelect(event) {
  const id = event.target.value || '';
  if (!id) {
    api.setSelectedModel('');
    api.openModelEditor();
    return;
  }
  const model = modelConfigs.value.find(item => item.id === id);
  api.setSelectedModel(id);
  api.openModelEditor(model);
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

function toggleModelMenu() {
  modelMenuOpen.value = !modelMenuOpen.value;
}

function closeModelMenu() {
  modelMenuOpen.value = false;
}

function modelOptionMeta(model) {
  if (!model) return '';
  if (model.provider === 'deepseek') return 'DeepSeek API';
  return model.type === 'api' ? 'API' : 'Exec';
}

function selectDisabledModel() {
  api.disableModelAssist();
  closeModelMenu();
}

function selectSavedModel(model) {
  if (!model) return;
  api.selectModelAndEnable(model.id);
  closeModelMenu();
}

function editSelectedModel() {
  closeModelMenu();
  api.openModelEditor(selectedModel.value);
}

function createDeepSeekModel() {
  closeModelMenu();
  api.openProviderModelEditor('deepseek');
}

function createCustomApiModel() {
  closeModelMenu();
  api.openModelEditor({
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
  closeModelMenu();
  api.openModelEditor();
}

function copyRouteFilePath() {
  if (!routeFilePath.value) return;
  api.copyTextWithToast(routeFilePath.value);
}

function hasChangeNote(item) {
  return !!(item && item.changeNote && item.changeNote.trim());
}

function shortText(text, limit = 90) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function selectedNodeTitle(item) {
  if (!item || !item.info) return '选区';
  const index = selectedItems.value.findIndex(selection => selection.uid === item.uid) + 1;
  return `选区 ${index} · <${item.info.tag || '-'}>`;
}

function selectionTagLabel(item, index) {
  const info = item.info || {};
  const className = String(info.className || '').split(/\s+/).filter(Boolean)[0];
  return `选区 ${index + 1} · ${info.tag || '-'}${className ? `.${className}` : ''}`;
}
</script>
