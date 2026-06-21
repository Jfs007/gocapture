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
        <label>
          <span>类型</span>
          <select v-model="modelForm.type" class="mda-model-input">
            <option value="exec">Cli</option>
            <option value="api">API</option>
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
              @click="handleAssetInsert(asset)"
              @keydown.enter.prevent="handleAssetInsert(asset)"
              @keydown.space.prevent="handleAssetInsert(asset)"
            >
              <span v-if="asset.thumbnailUrl" class="mda-asset-thumb" :style="assetThumbStyle(asset)" />
              <span v-else class="mda-asset-thumb is-empty">{{ asset.index }}</span>
              <button class="mda-asset-remove" type="button" title="移除这个选区" @click.stop="api.removeSelection(asset.uid)">×</button>
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

    <div class="mda-composer">
      <textarea
        ref="evidenceInput"
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
                <span>新增 Cli 模型</span>
              </button>
            </div>
          </div>
          <button
            class="mda-send-btn"
            type="button"
            :class="{ 'is-stopping': modelAssistLoading }"
            :title="modelAssistLoading ? '停止模型定位' : '提交'"
            :disabled="!composerCanSend"
            @click="api.sendComposer"
          >
            <span v-if="modelAssistLoading" class="mda-stop-icon" />
            <span v-else-if="candidateLoading">检索</span>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { candidateDetailTitle, candidateLogText, candidateStageLabel } from '../../presenters/candidate-presenter';
import { useApi, useForm } from '../../core/ctx';
import PopoverPanel from '../common/PopoverPanel.vue';

const evidenceInput = ref(null);
const shortcutMenuRef = ref(null);
const modelMenuRef = ref(null);
const modelMenuOpen = ref(false);
const candidatePanelCollapsed = ref(false);
const activeAssetPopoverUid = ref('');
const activeAssetPopoverRect = ref(null);
const shortcutMenuOpen = ref(false);
const shortcutMenuQuery = ref('');
const shortcutRangeStart = ref(-1);
const shortcutRangeEnd = ref(-1);
const shortcutActiveIndex = ref(0);
const composerSelectionStart = ref(0);
const composerSelectionEnd = ref(0);
let activeAssetPopoverAnchor = null;
let assetPopoverTimer = 0;
let shortcutMenuTimer = 0;
const api = useApi();
const showCandidatePicker = useForm('showCandidatePicker');
const needsMoreEvidence = useForm('needsMoreEvidence');
const candidateHits = useForm('candidateHits');
const selectedCandidatePaths = useForm('selectedCandidatePaths');
const expandedCandidatePath = useForm('expandedCandidatePath');
const includeApiEvidence = useForm('includeApiEvidence');
const candidateLoading = useForm('candidateLoading');
const promptText = useForm('promptText');
const promptAssets = useForm('promptAssets');
const selectedItems = useForm('selectedItems');
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

const activeModelLabel = computed(() => {
  return selectedModel.value?.name || '不启用';
});

const activeModelMeta = computed(() => {
  if (!selectedModel.value) return '';
  if (modelAssistLoading.value) return '定位中';
  if (selectedModel.value.provider === 'deepseek') return 'DeepSeek API';
  return formatModelType(selectedModel.value.type);
});

const activeAssetPopover = computed(() => {
  return promptAssets.value.find(item => item.uid === activeAssetPopoverUid.value) || null;
});

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

watch(modelAssistLoading, value => {
  if (!value) return;
  candidatePanelCollapsed.value = true;
  modelMenuOpen.value = false;
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

function handleGlobalPointerDown(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (modelMenuRef.value && (path.includes(modelMenuRef.value) || modelMenuRef.value.contains(event.target))) return;
  modelMenuOpen.value = false;
  const insideShortcutMenu = shortcutMenuRef.value && path.includes(shortcutMenuRef.value);
  const insideComposerInput = evidenceInput.value && path.includes(evidenceInput.value);
  if (!insideShortcutMenu && !insideComposerInput) {
    closeShortcutMenu();
  }
}

function updateAssetPopoverRect() {
  if (!activeAssetPopoverAnchor || !activeAssetPopoverAnchor.isConnected) return;
  activeAssetPopoverRect.value = activeAssetPopoverAnchor.getBoundingClientRect();
}

onMounted(() => {
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);
  window.addEventListener('scroll', updateAssetPopoverRect, true);
  window.addEventListener('resize', updateAssetPopoverRect, true);
  nextTick(() => {
    syncComposerHeight();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
  window.removeEventListener('scroll', updateAssetPopoverRect, true);
  window.removeEventListener('resize', updateAssetPopoverRect, true);
  clearAssetPopoverTimer();
  clearShortcutMenuTimer();
});

defineExpose({
  focusEvidenceInput() {
    focusComposer();
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
  return formatModelType(model.type);
}

function formatModelType(type) {
  return type === 'api' ? 'API' : 'Cli';
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

function syncComposerHeight(target = evidenceInput.value) {
  if (!target) return;
  target.style.height = 'auto';
  target.style.height = `${Math.min(Math.max(target.scrollHeight, 72), 184)}px`;
}

function focusComposer(cursor = null) {
  nextTick(() => {
    if (!evidenceInput.value || typeof evidenceInput.value.focus !== 'function') return;
    evidenceInput.value.focus();
    if (cursor != null && typeof evidenceInput.value.setSelectionRange === 'function') {
      evidenceInput.value.setSelectionRange(cursor, cursor);
      composerSelectionStart.value = cursor;
      composerSelectionEnd.value = cursor;
    }
    syncComposerHeight(evidenceInput.value);
  });
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
  activeAssetPopoverUid.value = asset.uid;
  activeAssetPopoverAnchor = event?.currentTarget || null;
  updateAssetPopoverRect();
  window.requestAnimationFrame(updateAssetPopoverRect);
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
  composerSelectionStart.value = Number(target.selectionStart || 0);
  composerSelectionEnd.value = Number(target.selectionEnd || composerSelectionStart.value);
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
  api.onComposerInput(event);
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
    : Math.min(composerSelectionStart.value, currentValue.length);
  const replaceEnd = replaceMention && shortcutRangeEnd.value >= replaceStart
    ? shortcutRangeEnd.value
    : Math.min(composerSelectionEnd.value, currentValue.length);
  const result = api.insertPromptAsset(asset.token, {
    replaceStart,
    replaceEnd,
    replaceMention
  });
  closeShortcutMenu();
  focusComposer(result?.cursor ?? replaceStart + String(asset.token || '').length + 1);
}

function handleAssetInsert(asset) {
  insertAssetToken(asset, { replaceMention: false });
}

function selectShortcutAsset(asset) {
  insertAssetToken(asset, { replaceMention: true });
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

</script>
