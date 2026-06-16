<template>
  <div class="mda-root">
    <div
      class="mda-overlay"
      :class="{ 'is-selected': overlay.selected }"
      :style="overlayStyle"
    />
    <div class="mda-badge" :style="badgeStyle">{{ overlay.badgeText }}</div>
    <div class="mda-hotkey-tip">空格键确认选区</div>

    <SelectionLayer />

    <section
      ref="panelRef"
      class="mda-panel"
      :class="{ 'is-collapsed': collapsed, 'is-resizing': resizing }"
      :style="panelStyle"
      aria-label="Magnus"
    >
      <div
        v-if="!collapsed"
        class="mda-resizer"
        title="拖动调整助手宽度"
        @pointerdown.stop.prevent="startPanelResize"
      />
      <header class="mda-head">
        <div class="mda-head-main">
          <div class="mda-title">Magnus</div>
          <div class="mda-subtitle">{{ pageHost }}</div>
        </div>
        <div class="mda-actions">
          <button class="mda-icon" type="button" title="收起/展开" @click.stop="collapsed = !collapsed">
            {{ collapsed ? '<' : '>' }}
          </button>
          <button class="mda-icon" type="button" title="关闭" @click.stop="destroy">x</button>
        </div>
      </header>

      <div class="mda-body mda-chat-body">
        <input
          ref="fileInputRef"
          class="mda-file-input"
          type="file"
          webkitdirectory
          multiple
          @change="onFileInputChange"
        >
        <ChatThread />
        <ComposerPanel
          ref="composerPanelRef"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { sourceServerJson } from './source-service';
import { useCtx } from './ctx';
import {
  compactText,
  getClassName,
  getElementInfo,
  normalizeRequestInfo,
  round
} from './element-context';
import { useChatMessages } from './hooks/use-chat-messages';
import { useModelAdapters } from './hooks/use-model-adapters';
import { usePageRequests } from './hooks/use-page-requests';
import { usePanelLayout } from './hooks/use-panel-layout';
import { useSearchPrompt } from './hooks/use-search-prompt';
import { useSourceProject } from './hooks/use-source-project';
import { useToast } from './hooks/use-toast';
import ChatThread from './components/ChatThread.vue';
import ComposerPanel from './components/ComposerPanel.vue';
import SelectionLayer from './components/SelectionLayer.vue';

const props = defineProps({
  api: {
    type: Object,
    required: true
  }
});

const active = ref(true);
const panelRef = ref(null);
const composerPanelRef = ref(null);
const hoveredElement = shallowRef(null);
const selectedElement = shallowRef(null);
const displayInfo = shallowRef(null);
const selectedItems = ref([]);
const editingUid = ref('');
const candidateHits = ref([]);
const routeResolverTrace = ref(null);
const candidateLoading = ref(false);
const candidateError = ref('');
const searchKeywords = ref('');
const customEvidence = ref('');
const evidenceMessages = ref([]);
const includeApiEvidence = ref(false);
const selectedCandidatePaths = ref([]);
const expandedCandidatePath = ref('');
const selectionConfirmed = ref(false);
const filesConfirmed = ref(false);
const promptText = ref('');
const layoutTick = ref(0);
const currentPageHref = ref(readCurrentHref());
let selectionUid = 0;
let routeResolveSeq = 0;
let routeResolveTimer = 0;
let cleanupLocationWatcher = null;
const PROJECT_STORAGE_PREFIX = 'magnus:source-project:';

const {
  collapsed,
  resizing,
  effectivePanelWidth,
  panelStyle,
  applyPageInset,
  startPanelResize,
  syncPanelWidth,
  cleanupPanelLayout
} = usePanelLayout({ active });

const {
  toastText,
  setToast,
  cleanupToast
} = useToast();

const {
  recentRequests,
  rememberRequest,
  denoiseTextByApi
} = usePageRequests();

const overlay = reactive({
  visible: false,
  selected: false,
  left: '0px',
  top: '0px',
  width: '0px',
  height: '0px',
  badgeLeft: '0px',
  badgeTop: '0px',
  badgeText: ''
});

const pageHost = computed(() => {
  try {
    return new URL(currentPageHref.value).host || currentPageHref.value;
  } catch (error) {
    return '-';
  }
});

const pageUrlPath = computed(() => {
  try {
    const url = new URL(currentPageHref.value);
    return hashRoutePath(url.hash) || url.pathname || '/';
  } catch (error) {
    return '/';
  }
});

const projectStorageKey = computed(() => `${PROJECT_STORAGE_PREFIX}${pageHost.value}`);

const {
  fileInputRef,
  project,
  sourceServiceStatus,
  sourceServiceError,
  sourceServiceMessage,
  chooseProject,
  onFileInputChange,
  restoreSavedProject
} = useSourceProject({
  projectStorageKey,
  resetProjectContext,
  setToast
});

const latestSelection = computed(() => selectedItems.value[selectedItems.value.length - 1] || null);
const searchApiRequests = computed(() => includeApiEvidence.value ? recentRequests.value.slice(0, 5) : []);
const selectedCandidateHits = computed(() => {
  const selected = new Set(selectedCandidatePaths.value);
  return candidateHits.value.filter(hit => selected.has(hit.file));
});
const canConfirmSelection = computed(() => selectedItems.value.length > 0 && selectedItems.value.some(item => hasChangeNote(item)));
const routeResolverMatched = computed(() => !!routeResolverTrace.value?.matched);
const hasReliableCandidateEvidence = computed(() => {
  return routeResolverMatched.value || candidateHits.value.some(hit => {
    return hit.stage === 'model-agent' || (hit.uniqueSnippet && hit.uniqueMatchCount === 1);
  });
});
const needsMoreEvidence = computed(() => candidateHits.value.length > 1 && !filesConfirmed.value && !hasReliableCandidateEvidence.value);
const showCandidatePicker = computed(() => candidateHits.value.length > 1 && !filesConfirmed.value && !needsMoreEvidence.value);
const composerEditable = computed(() => needsMoreEvidence.value);
const composerPlaceholder = computed(() => composerEditable.value ? '补充页面证据，例如：这是上传素材模块的视频剪辑区域，需要修改...' : '');
const composerText = computed(() => {
  if (!project.value) return '请选择项目源码';
  if (candidateLoading.value) return '正在检索候选文件';
  if (promptText.value) return '最终提示词已生成';
  if (needsMoreEvidence.value) return customEvidence.value;
  if (showCandidatePicker.value) return '确认文件';
  return '选区已确认';
});
const composerInputValue = computed(() => composerEditable.value ? customEvidence.value : composerText.value);
const composerCanSend = computed(() => {
  if (candidateLoading.value) return false;
  if (!project.value) return false;
  if (promptText.value) return false;
  if (needsMoreEvidence.value) return customEvidence.value.trim().length > 0;
  if (showCandidatePicker.value) return selectedCandidateHits.value.length > 0;
  return canConfirmSelection.value;
});

function hasUsableModelResult(result) {
  return (result?.modelItems || result?.targetFiles || []).some(item => {
    return item && item.exists !== false && (item.path || item.file);
  });
}

const {
  selectionChatSummary,
  selectionNodeLine,
  ancestorPromptLine,
  combinedSelectionText,
  searchPayload,
  searchLogLines,
  generatePrompt
} = useSearchPrompt({
  selectedItems,
  selectedCandidatePaths,
  selectedCandidateHits,
  candidateHits,
  routeResolverTrace,
  evidenceMessages,
  customEvidence,
  searchKeywords,
  includeApiEvidence,
  searchApiRequests,
  pageUrlPath,
  project,
  promptText,
  denoiseTextByApi,
  selectionPayloads,
  setToast
});

const {
  modelConfigs,
  selectedModelId,
  selectedModel,
  useModelAssist,
  canUseModelAssist,
  modelEditorOpen,
  modelForm,
  modelAssistLoading,
  modelAssistError,
  modelAssistLogs,
  modelAssistResult,
  openModelEditor,
  openProviderModelEditor,
  closeModelEditor,
  saveModelForm,
  removeSelectedModel,
  setSelectedModel,
  selectModelAndEnable,
  disableModelAssist,
  setUseModelAssist,
  resetModelAssist,
  runModelAssist
} = useModelAdapters({
  project,
  candidateHits,
  selectedCandidatePaths,
  searchPayload,
  routeResolverTrace,
  setToast
});

const { chatMessages } = useChatMessages({
  project,
  selectedItems,
  selectionConfirmed,
  evidenceMessages,
  candidateLoading,
  includeApiEvidence,
  candidateHits,
  needsMoreEvidence,
  filesConfirmed,
  promptText,
  sourceServiceStatus,
  sourceServiceMessage,
  modelAssistLoading,
  modelAssistError,
  modelAssistLogs,
  modelAssistResult,
  selectionChatSummary,
  searchLogLines
});

const ctx = useCtx({
  selectedItems,
  editingUid,
  layoutTick,
  chatMessages,
  sourceServiceStatus,
  sourceServiceError,
  candidateError,
  showCandidatePicker,
  needsMoreEvidence,
  candidateHits,
  routeResolverTrace,
  selectedCandidatePaths,
  expandedCandidatePath,
  includeApiEvidence,
  candidateLoading,
  promptText,
  project,
  modelConfigs,
  selectedModelId,
  selectedModel,
  useModelAssist,
  canUseModelAssist,
  modelEditorOpen,
  modelForm,
  modelAssistLoading,
  modelAssistError,
  modelAssistLogs,
  modelAssistResult,
  composerInputValue,
  composerEditable,
  composerPlaceholder,
  composerCanSend,
  toastText
}, {
  loading: candidateLoading,
  back: async () => {},
  validate: async () => ({ valid: true }),
  buildParams: () => searchPayload(),
  empty: () => clearSelections(),
  previewSelection,
  restoreSelectionPreview,
  openSelectionEditor,
  removeSelection,
  updateSelectionNote: onSelectionNoteInput,
  chooseProject,
  copyPrompt: () => copyTextWithToast(promptText.value),
  copyTextWithToast,
  openSourceFile,
  setIncludeApiEvidence: value => {
    includeApiEvidence.value = !!value;
  },
  onSearchOptionChange,
  openModelEditor,
  openProviderModelEditor,
  closeModelEditor,
  saveModelForm,
  removeSelectedModel,
  setSelectedModel,
  selectModelAndEnable,
  disableModelAssist,
  setUseModelAssist,
  resetModelAssist,
  clearSelections,
  onComposerInput,
  sendComposer,
  toggleCandidateFile,
  toggleCandidateDetail
});
ctx.setup();

const overlayStyle = computed(() => ({
  display: overlay.visible ? 'block' : 'none',
  left: overlay.left,
  top: overlay.top,
  width: overlay.width,
  height: overlay.height
}));

const badgeStyle = computed(() => ({
  display: overlay.visible ? 'block' : 'none',
  left: overlay.badgeLeft,
  top: overlay.badgeTop
}));

function selectionPayloads() {
  return selectedItems.value.map((item, index) => ({
    index: index + 1,
    changeNote: item.changeNote.trim(),
    element: item.info
  }));
}

function dispatchSelected() {
  try {
    window.dispatchEvent(new CustomEvent('magnus:element-selected', { detail: selectionPayloads() }));
  } catch (error) {
  }
}

function updateInfo(element) {
  const info = getElementInfo(element);
  if (!info) return;
  displayInfo.value = info;
}

function classBadgeText(element) {
  const classes = [];
  if (element.classList && element.classList.length) {
    for (let i = 0; i < element.classList.length && i < 2; i++) {
      classes.push(`.${element.classList[i]}`);
    }
  }
  return classes.join('');
}

function makeBadgeText(element) {
  if (!element) return '';
  const rect = element.getBoundingClientRect();
  const classText = classBadgeText(element);
  return `${element.tagName.toLowerCase()}${classText}  ${round(rect.width)}x${round(rect.height)}`;
}

function hideOverlay() {
  overlay.visible = false;
  overlay.badgeText = '';
}

function updateOverlay(element, isSelected) {
  if (!element || !document.documentElement.contains(element)) {
    hideOverlay();
    return;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) {
    hideOverlay();
    return;
  }

  const badgeTop = rect.top > 28 ? rect.top - 26 : rect.bottom + 4;
  const badgeLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 260));

  overlay.visible = true;
  overlay.selected = !!isSelected;
  overlay.left = `${round(rect.left)}px`;
  overlay.top = `${round(rect.top)}px`;
  overlay.width = `${Math.max(1, round(rect.width))}px`;
  overlay.height = `${Math.max(1, round(rect.height))}px`;
  overlay.badgeLeft = `${round(badgeLeft)}px`;
  overlay.badgeTop = `${round(Math.max(8, badgeTop))}px`;
  overlay.badgeText = makeBadgeText(element);
}

function getEventPath(event) {
  if (event.composedPath) return event.composedPath();
  const path = [];
  let node = event.target;
  while (node) {
    path.push(node);
    node = node.parentNode;
  }
  path.push(window);
  return path;
}

function isFromAssistantUi(event) {
  const path = getEventPath(event);
  return path.includes(props.api.host) || path.includes(props.api.shadowRoot) || path.includes(panelRef.value);
}

function stopAssistantEvent(event) {
  if (isFromAssistantUi(event)) event.stopPropagation();
}

function hasPathClass(event, className) {
  return getEventPath(event).some(node => {
    return node && node.classList && node.classList.contains(className);
  });
}

function closeSelectionEditor() {
  editingUid.value = '';
}

function openSelectionEditor(item) {
  if (!item) return;
  editingUid.value = item.uid;
  selectedElement.value = item.element;
  displayInfo.value = item.info;
  hideOverlay();
  nextTick(() => {
    const editor = props.api.shadowRoot.querySelector(`[data-selection-uid="${item.uid}"]`);
    if (editor && typeof editor.focus === 'function') editor.focus();
  });
}

function hasChangeNote(item) {
  return !!(item && item.changeNote && item.changeNote.trim());
}

function invalidatePrompt() {
  promptText.value = '';
}

function invalidateSelectionConfirm() {
  selectionConfirmed.value = false;
  filesConfirmed.value = false;
  candidateHits.value = [];
  candidateError.value = '';
  selectedCandidatePaths.value = [];
  expandedCandidatePath.value = '';
  invalidatePrompt();
}

function invalidateCandidateConfirm() {
  filesConfirmed.value = false;
  invalidatePrompt();
}

function clearCandidateState() {
  candidateHits.value = [];
  candidateError.value = '';
  selectedCandidatePaths.value = [];
  expandedCandidatePath.value = '';
  filesConfirmed.value = false;
  resetModelAssist();
  invalidatePrompt();
}

function resetProjectContext() {
  selectionConfirmed.value = false;
  customEvidence.value = '';
  evidenceMessages.value = [];
  clearCandidateState();
}

function readCurrentHref() {
  try {
    return window.location.href || '';
  } catch (error) {
    return '';
  }
}

function hashRoutePath(hash) {
  const value = String(hash || '').replace(/^#/, '');
  if (!value) return '';
  const route = value.startsWith('!/') ? value.slice(1) : value;
  if (!route.startsWith('/')) return '';
  return route.split('?')[0] || '/';
}

function syncCurrentUrl() {
  const nextHref = readCurrentHref();
  if (nextHref && nextHref !== currentPageHref.value) {
    currentPageHref.value = nextHref;
  }
}

function scheduleRouteResolve() {
  if (routeResolveTimer) window.clearTimeout(routeResolveTimer);
  routeResolveTimer = window.setTimeout(() => {
    routeResolveTimer = 0;
    resolveCurrentPageRoute();
  }, 80);
}

async function resolveCurrentPageRoute() {
  if (!project.value || project.value.source !== 'source-server') {
    routeResolverTrace.value = null;
    return;
  }

  const seq = ++routeResolveSeq;
  try {
    const data = await sourceServerJson('/api/route/resolve', {
      method: 'POST',
      body: {
        url: currentPageHref.value,
        pagePath: pageUrlPath.value
      },
      timeoutMs: 5000,
      timeoutMessage: '页面路由解析超过 5 秒'
    });
    if (seq !== routeResolveSeq) return;
    routeResolverTrace.value = data.routeResolver || null;
  } catch (error) {
    if (seq !== routeResolveSeq) return;
    routeResolverTrace.value = {
      projectKind: project.value?.kind || 'unknown',
      pagePath: pageUrlPath.value,
      adapters: [],
      matched: false,
      hits: [],
      errors: [error.message || String(error)]
    };
  }
}

function installLocationWatcher() {
  const rawPushState = window.history.pushState;
  const rawReplaceState = window.history.replaceState;
  const onChanged = () => window.setTimeout(syncCurrentUrl, 0);

  window.history.pushState = function pushState(...args) {
    const result = rawPushState.apply(this, args);
    onChanged();
    return result;
  };

  window.history.replaceState = function replaceState(...args) {
    const result = rawReplaceState.apply(this, args);
    onChanged();
    return result;
  };

  window.addEventListener('popstate', onChanged, true);
  window.addEventListener('hashchange', onChanged, true);

  return () => {
    window.history.pushState = rawPushState;
    window.history.replaceState = rawReplaceState;
    window.removeEventListener('popstate', onChanged, true);
    window.removeEventListener('hashchange', onChanged, true);
  };
}

function onSelectionNoteInput(uid, value) {
  const item = selectedItems.value.find(selection => selection.uid === uid);
  if (item) item.changeNote = value;
  invalidateSelectionConfirm();
}

function onSearchOptionChange() {
  clearCandidateState();
}

function onComposerInput(event) {
  if (!composerEditable.value) return;
  customEvidence.value = event.target.value;
}

async function openSourceFile(file) {
  if (!file) return;
  try {
    await sourceServerJson('/api/source/open', {
      method: 'POST',
      body: { file },
      timeoutMs: 5000,
      timeoutMessage: '打开源码文件超时，请确认本地源码服务可用'
    });
    setToast(`已打开 ${file}`);
  } catch (error) {
    setToast(error.message || '打开源码文件失败');
  }
}

async function runEvidenceSearch() {
  filesConfirmed.value = false;
  invalidatePrompt();
  const hits = await searchCandidateFiles();
  if (hits.length === 1) {
    selectedCandidatePaths.value = [hits[0].file];
    filesConfirmed.value = true;
    generatePrompt();
    return;
  }
  if (needsMoreEvidence.value) {
    nextTick(() => {
      composerPanelRef.value?.focusEvidenceInput?.();
    });
  }
}

async function addEvidenceText(text) {
  const value = compactText(text, 220);
  if (!value) return;
  evidenceMessages.value.push(`补充证据：${value}`);
  customEvidence.value = '';
  setToast('已追加页面证据');
  await runEvidenceSearch();
}

function evidenceFromElement(element) {
  const info = getElementInfo(element);
  if (!info) return '';
  const text = denoiseTextByApi(info.text, 160);
  const ancestors = ancestorPromptLine(info);
  return [
    '页面节点证据',
    selectionNodeLine(info),
    text ? `文案=${text}` : '',
    ancestors ? `父级=${ancestors}` : ''
  ].filter(Boolean).join('；');
}

function confirmSelectionContext() {
  if (!canConfirmSelection.value) return;
  selectionConfirmed.value = true;
  filesConfirmed.value = false;
  invalidatePrompt();
  setToast('选区已确认');
}

function toggleCandidateFile(hit) {
  if (!hit) return;
  const selected = new Set(selectedCandidatePaths.value);
  if (selected.has(hit.file)) selected.delete(hit.file);
  else selected.add(hit.file);
  selectedCandidatePaths.value = Array.from(selected);
  invalidateCandidateConfirm();
}

function toggleCandidateDetail(hit) {
  if (!hit) return;
  expandedCandidatePath.value = expandedCandidatePath.value === hit.file ? '' : hit.file;
}

function confirmCandidateFiles() {
  if (!selectedCandidateHits.value.length) return;
  filesConfirmed.value = true;
  setToast('候选文件已确认');
  generatePrompt();
}

function onPointerDown(event) {
  if (!editingUid.value) return;
  if (isFromAssistantUi(event)) return;
  if (hasPathClass(event, 'mda-floating-note')) return;
  closeSelectionEditor();
}

function onPageMessage(event) {
  const message = event.data || {};
  if (message.type !== 'WEB_REQUEST_RESPONSE') return;
  rememberRequest(normalizeRequestInfo(message.data || {}, window.location.href));
}

function elementFromPoint(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element || element === props.api.host || element.id === 'magnus-dev-assistant-root') return null;
  if (element.nodeType !== 1) return null;
  return element;
}

function setActive(value) {
  active.value = !!value;
  document.documentElement.style.cursor = active.value ? 'crosshair' : '';
  if (!active.value) {
    hoveredElement.value = null;
    hideOverlay();
  }
}

function toggleActive() {
  setActive(!active.value);
}

function isEditableTarget(target) {
  if (!target || target === window || target === document) return false;
  const element = target.nodeType === 1 ? target : target.parentElement;
  if (!element) return false;
  const tag = element.tagName ? element.tagName.toLowerCase() : '';
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
}

function onMouseMove(event) {
  if (!active.value || isFromAssistantUi(event)) return;
  const element = elementFromPoint(event);
  if (!element || element === hoveredElement.value) return;
  hoveredElement.value = element;
  updateOverlay(element, false);
  updateInfo(element);
}

function addSelection(element) {
  const info = getElementInfo(element);
  if (!info) return;

  const item = {
    uid: `selection-${Date.now()}-${selectionUid++}`,
    element: markRaw(element),
    info,
    changeNote: ''
  };

  selectedItems.value.push(item);
  selectedElement.value = element;
  displayInfo.value = info;
  window.__MAGNUS_LAST_ELEMENT__ = element;
  window.__MAGNUS_LAST_ELEMENT_INFO__ = info;
  window.__MAGNUS_SELECTIONS__ = selectionPayloads();
  dispatchSelected();
  hoveredElement.value = null;
  hideOverlay();
  editingUid.value = item.uid;
  invalidateSelectionConfirm();
  setToast(`已添加选区 ${selectedItems.value.length}`);
  nextTick(() => {
    const editor = props.api.shadowRoot.querySelector(`[data-selection-uid="${item.uid}"]`);
    if (editor && typeof editor.focus === 'function') editor.focus();
  });
}

async function onKeyDown(event) {
  const isConfirmKey = (event.code === 'Space' || event.key === ' ') && !event.metaKey && !event.ctrlKey && !event.altKey;
  if (isConfirmKey && active.value && hoveredElement.value && !isFromAssistantUi(event) && !isEditableTarget(event.target)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (needsMoreEvidence.value) {
      await addEvidenceText(evidenceFromElement(hoveredElement.value));
      return;
    }
    addSelection(hoveredElement.value);
  }
}

function previewSelection(item) {
  if (!item || !item.element) return;
  selectedElement.value = item.element;
  displayInfo.value = item.info;
  updateOverlay(item.element, true);
}

function restoreSelectionPreview() {
  hideOverlay();
}

function onScrollOrResize() {
  layoutTick.value++;
  syncPanelWidth();
  applyPageInset();
  if (active.value && hoveredElement.value) {
    updateOverlay(hoveredElement.value, false);
    return;
  }
  selectedElement.value = null;
  if (!active.value) displayInfo.value = null;
  hideOverlay();
}

function removeSelection(uid) {
  const index = selectedItems.value.findIndex(item => item.uid === uid);
  if (index === -1) return;
  selectedItems.value.splice(index, 1);
  if (editingUid.value === uid) closeSelectionEditor();
  invalidateSelectionConfirm();
  window.__MAGNUS_SELECTIONS__ = selectionPayloads();
  dispatchSelected();
  setToast('已移除选区');
  onScrollOrResize();
}

function clearSelections() {
  selectedItems.value = [];
  selectedElement.value = null;
  hoveredElement.value = null;
  displayInfo.value = null;
  editingUid.value = '';
  selectionConfirmed.value = false;
  customEvidence.value = '';
  evidenceMessages.value = [];
  clearCandidateState();
  window.__MAGNUS_LAST_ELEMENT__ = null;
  window.__MAGNUS_LAST_ELEMENT_INFO__ = null;
  window.__MAGNUS_SELECTIONS__ = [];
  hideOverlay();
  setActive(true);
  setToast('');
}

async function searchCandidateFiles() {
  candidateLoading.value = true;
  candidateError.value = '';
  resetModelAssist();
  filesConfirmed.value = false;
  try {
    const data = await sourceServerJson('/api/search', {
      method: 'POST',
      body: searchPayload(),
      timeoutMs: includeApiEvidence.value ? 30000 : 12000,
      timeoutMessage: includeApiEvidence.value
        ? '接口调用链追踪超过 30 秒，请减少捕获接口或补充关键词后重试'
        : '源码检索超过 12 秒，请补充关键词后重试'
    });
    candidateHits.value = Array.isArray(data.hits) ? data.hits : [];
    routeResolverTrace.value = data.routeResolver || null;
    if (!candidateHits.value.length) {
      selectedCandidatePaths.value = [];
      candidateError.value = '未找到候选文件。可以先触发页面接口，或补充选区改动点后重试。';
    } else {
      selectedCandidatePaths.value = [candidateHits.value[0].file];
      expandedCandidatePath.value = '';
      setToast(`找到 ${candidateHits.value.length} 个候选文件`);
    }
    if (candidateHits.value.length && useModelAssist.value && canUseModelAssist.value) {
      const modelResult = await runModelAssist();
      if (hasUsableModelResult(modelResult)) {
        filesConfirmed.value = true;
        generatePrompt();
      }
    }
    return candidateHits.value;
  } catch (error) {
    selectedCandidatePaths.value = [];
    candidateError.value = `${error.message || error}。`;
    return [];
  } finally {
    candidateLoading.value = false;
  }
}

async function sendComposer() {
  if (!project.value) return;
  if (needsMoreEvidence.value) {
    const evidence = customEvidence.value.trim();
    if (!evidence) return;
    evidenceMessages.value.push(`补充证据：${evidence}`);
    customEvidence.value = '';
    await runEvidenceSearch();
    return;
  }
  if (showCandidatePicker.value) {
    confirmCandidateFiles();
    return;
  }
  if (!canConfirmSelection.value) return;
  confirmSelectionContext();
  const hits = await searchCandidateFiles();
  if (hits.length === 1) {
    selectedCandidatePaths.value = [hits[0].file];
    filesConfirmed.value = true;
    generatePrompt();
  }
}

function copyText(text) {
  if (!text) return Promise.resolve(false);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }

  return new Promise(resolve => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (error) {
      ok = false;
    }
    textarea.parentNode.removeChild(textarea);
    resolve(ok);
  });
}

function copyTextWithToast(text) {
  copyText(text).then(ok => {
    setToast(ok ? '已复制' : '复制失败');
  });
}

function destroy() {
  props.api.destroy();
}

function registerApi() {
  props.api.start = () => setActive(true);
  props.api.stop = () => setActive(false);
  props.api.toggle = toggleActive;
  props.api.clear = clearSelections;
  props.api.getSelected = () => ({
    element: selectedElement.value,
    selections: selectionPayloads()
  });
}

function cleanup() {
  setActive(false);
  if (routeResolveTimer) {
    window.clearTimeout(routeResolveTimer);
    routeResolveTimer = 0;
  }
  if (cleanupLocationWatcher) {
    cleanupLocationWatcher();
    cleanupLocationWatcher = null;
  }
  cleanupToast();
  props.api.shadowRoot.removeEventListener('focusin', stopAssistantEvent);
  props.api.shadowRoot.removeEventListener('keydown', stopAssistantEvent);
  props.api.shadowRoot.removeEventListener('mousedown', stopAssistantEvent);
  props.api.shadowRoot.removeEventListener('pointerdown', stopAssistantEvent);
  props.api.shadowRoot.removeEventListener('click', stopAssistantEvent);
  window.removeEventListener('pointerdown', onPointerDown, true);
  window.removeEventListener('message', onPageMessage, true);
  window.removeEventListener('mousemove', onMouseMove, true);
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize, true);
  cleanupPanelLayout();
}

watch(effectivePanelWidth, () => {
  applyPageInset();
  onScrollOrResize();
});

watch([project, currentPageHref], () => {
  routeResolverTrace.value = null;
  scheduleRouteResolve();
});

onMounted(() => {
  registerApi();
  setActive(true);
  syncPanelWidth();
  applyPageInset();
  cleanupLocationWatcher = installLocationWatcher();
  restoreSavedProject();
  scheduleRouteResolve();
  props.api.shadowRoot.addEventListener('focusin', stopAssistantEvent);
  props.api.shadowRoot.addEventListener('keydown', stopAssistantEvent);
  props.api.shadowRoot.addEventListener('mousedown', stopAssistantEvent);
  props.api.shadowRoot.addEventListener('pointerdown', stopAssistantEvent);
  props.api.shadowRoot.addEventListener('click', stopAssistantEvent);
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('message', onPageMessage, true);
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize, true);
});

onBeforeUnmount(cleanup);
</script>
