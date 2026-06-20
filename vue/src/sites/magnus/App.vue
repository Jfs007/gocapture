<template>
  <div class="mda-root">
    <div
      class="mda-overlay"
      :class="{ 'is-selected': overlay.selected }"
      :style="overlayStyle"
    />
    <div class="mda-badge" :style="badgeStyle">{{ overlay.badgeText }}</div>
    <div class="mda-hotkey-tip">空格键确认选区</div>

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
          <div class="mda-title">
            <img class="mda-title-logo" :src="magnusLogo" alt="Magnus">
          </div>
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
import { computed, markRaw, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { sourceServerJson } from './services/source-service';
import { useCtx } from './core/ctx';
import {
  compactText,
  getClassName,
  getContextEvidence,
  getElementInfo,
  normalizeRequestInfo,
  round,
  shouldPromoteContext
} from './core/element-context';
import { useChatMessages } from './hooks/use-chat-messages';
import { useModelAdapters } from './hooks/use-model-adapters';
import { usePageRequests } from './hooks/use-page-requests';
import { usePanelLayout } from './hooks/use-panel-layout';
import { useSearchPrompt } from './hooks/use-search-prompt';
import { useSourceProject } from './hooks/use-source-project';
import { useToast } from './hooks/use-toast';
import ChatThread from './components/chat/ChatThread.vue';
import ComposerPanel from './components/composer/ComposerPanel.vue';
import magnusLogo from './resources/logo.jpg';

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
const candidateHits = ref([]);
const routeResolverTrace = ref(null);
const apiTrace = ref(null);
const candidateLoading = ref(false);
const searchRunning = ref(false);
const candidateError = ref('');
const searchStartedAt = ref(0);
const searchFinishedAt = ref(0);
const searchKeywords = ref('');
const customEvidence = ref('');
const evidenceMessages = ref([]);
const includeApiEvidence = ref(true);
const selectedCandidatePaths = ref([]);
const expandedCandidatePath = ref('');
const selectionConfirmed = ref(false);
const filesConfirmed = ref(false);
const promptText = ref('');
const promptIntent = ref('');
const layoutTick = ref(0);
const currentPageHref = ref(readCurrentHref());
let selectionUid = 0;
let routeResolveSeq = 0;
let routeResolveTimer = 0;
let webRequestApiRetryTimer = 0;
let webRequestApiRetryCount = 0;
let webRequestApiInstalled = false;
let cleanupLocationWatcher = null;
const PROJECT_STORAGE_PREFIX = 'magnus:source-project:';
const WEB_REQUEST_HANDLER_KEY = '__MAGNUS_WEB_REQUEST_HANDLER__';
const WEB_REQUEST_LISTENER_KEY = '__MAGNUS_WEB_REQUEST_LISTENER_INSTALLED__';

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
const canConfirmSelection = computed(() => selectedItems.value.length > 0);
const routeResolverMatched = computed(() => !!routeResolverTrace.value?.matched);
const hasReliableCandidateEvidence = computed(() => {
  return routeResolverMatched.value || candidateHits.value.some(hit => {
    return hit.stage === 'model-agent' || hit.preciseEvidence;
  });
});
const needsMoreEvidence = computed(() => candidateHits.value.length > 1 && !filesConfirmed.value && !hasReliableCandidateEvidence.value);
const showCandidatePicker = computed(() => candidateHits.value.length > 1 && !filesConfirmed.value && !needsMoreEvidence.value);
const composerEditable = computed(() => selectedItems.value.length > 0);
const composerPlaceholder = computed(() => selectedItems.value.length
  ? '输入修改要求，可用 @选区 或 @选区1 引用已选区'
  : ''
);
const composerText = computed(() => {
  if (!project.value) return '请选择项目源码';
  if (!selectedItems.value.length) return '选择页面选区后，可用 @选区1 描述修改';
  return promptIntent.value;
});
const composerInputValue = computed(() => composerEditable.value ? promptIntent.value : composerText.value);
const composerCanSend = computed(() => {
  if (modelAssistLoading.value) return true;
  if (candidateLoading.value) return false;
  if (!project.value) return false;
  if (!selectedItems.value.length) return false;
  if (showCandidatePicker.value) return selectedCandidateHits.value.length > 0;
  return promptIntent.value.trim().length > 0;
});

function hasUsableModelResult(result) {
  return (result?.modelItems || result?.targetFiles || []).some(item => {
    return item && item.exists !== false && (item.path || item.file);
  });
}

function singleHitHasStrongLocalEvidence(hit) {
  if (!hit) return false;
  if (hit.stage === 'model-agent') return true;
  if (!hit.preciseEvidence) return false;
  if (hit.uniqueSnippet || hit.uniqueMatchText) return true;
  if (Number(hit.exactMatchCount || 0) === 1) return true;
  if (Number(hit.contextStrongMatchCount || 0) >= 2) return true;
  if (Number(hit.contextScore || 0) >= 36) return true;
  if ((hit.contextReasons || []).some(reason => /className|资源线索|样式|属性|结构/.test(String(reason || '')))) return true;
  return false;
}

function shouldAutoRunModelAssist(hits) {
  const list = Array.isArray(hits) ? hits : [];
  if (!list.length) return false;
  if (list.length > 1) return true;
  return !singleHitHasStrongLocalEvidence(list[0]);
}

function hasStrongSearchEvidence(hits) {
  const list = Array.isArray(hits) ? hits : [];
  return list.some(hit => {
    if (!hit) return false;
    if (hit.preciseEvidence || hit.uniqueMatchText || hit.uniqueSnippet) return true;
    if (Number(hit.exactMatchCount || 0) === 1 && Number(hit.contextScore || 0) >= 18) return true;
    if (Number(hit.contextStrongMatchCount || 0) >= 2) return true;
    if (Number(hit.contextScore || 0) >= 32 && (hit.contextReasons || []).length >= 2) return true;
    return false;
  });
}

function shouldRetryExpandedSearch(hits) {
  const list = Array.isArray(hits) ? hits : [];
  if (list.length < 2) return false;
  if (hasStrongSearchEvidence(list)) return false;
  if (list.length >= 6) return true;
  const exactLikeHits = list.filter(hit => hit?.exactMatchText || hit?.uniqueMatchText).length;
  return exactLikeHits <= 1;
}

function isBetterSearchResult(nextHits, currentHits) {
  const next = Array.isArray(nextHits) ? nextHits : [];
  const current = Array.isArray(currentHits) ? currentHits : [];
  if (!next.length) return false;
  const nextStrong = hasStrongSearchEvidence(next);
  const currentStrong = hasStrongSearchEvidence(current);
  if (nextStrong !== currentStrong) return nextStrong;
  if (next.length !== current.length) return next.length < current.length;
  return Number(next[0]?.score || 0) > Number(current[0]?.score || 0);
}

async function runSearchRequest(body, timeoutMs) {
  return await sourceServerJson('/api/search', {
    method: 'POST',
    body,
    timeoutMs,
    timeoutMessage: includeApiEvidence.value
      ? '接口调用链追踪超过 30 秒，请减少捕获接口或补充关键词后重试'
      : '源码检索超过 12 秒，请补充关键词后重试'
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
  apiTrace,
  evidenceMessages,
  customEvidence,
  promptIntent,
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

const promptAssets = computed(() => {
  return selectedItems.value.map((item, index) => ({
    uid: item.uid,
    token: `@选区${index + 1}`,
    index: index + 1,
    label: `选区 ${index + 1}`,
    summary: compactText(item.info?.text || item.info?.className || item.info?.tag || item.assetInfo?.text || `选区${index + 1}`, 24),
    thumbnailUrl: item.thumbnailUrl || '',
    className: item.info?.className || '',
    text: item.info?.text || '',
    selector: item.info?.selector || '',
    innerHtml: item.info?.innerHtml || '',
    outerHtml: item.info?.outerHtml || '',
    inlineStyle: item.info?.inlineStyle || '',
    computedStyle: item.info?.computedStyle || null,
    box: item.info?.box || null,
    assetSelector: item.assetInfo?.selector || '',
    assetText: item.assetInfo?.text || '',
    assetInnerHtml: item.assetInfo?.innerHtml || '',
    assetOuterHtml: item.assetInfo?.outerHtml || '',
    assetInlineStyle: item.assetInfo?.inlineStyle || '',
    assetComputedStyle: item.assetInfo?.computedStyle || null,
    assetBox: item.assetInfo?.box || null,
    thumbnailCaptured: !!item.thumbnailUrl
  }));
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
  modelAssistStartedAt,
  modelAssistFinishedAt,
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
  runModelAssist,
  stopModelAssist
} = useModelAdapters({
  project,
  candidateHits,
  selectedCandidatePaths,
  searchPayload,
  routeResolverTrace,
  apiTrace,
  setToast
});

const { chatMessages } = useChatMessages({
  project,
  selectedItems,
  selectionConfirmed,
  evidenceMessages,
  candidateLoading,
  searchRunning,
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
  searchStartedAt,
  searchFinishedAt,
  modelAssistStartedAt,
  modelAssistFinishedAt,
  selectionChatSummary,
  searchLogLines
});

const ctx = useCtx({
  selectedItems,
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
  promptAssets,
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
  removeSelection,
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
  stopModelAssist,
  clearSelections,
  onComposerInput,
  insertPromptAsset,
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
    token: `@选区${index + 1}`,
    element: item.info,
    asset: item.assetInfo || null,
    thumbnailCaptured: !!item.thumbnailUrl
  }));
}

function dispatchSelected() {
  try {
    window.dispatchEvent(new CustomEvent('magnus:element-selected', { detail: selectionPayloads() }));
  } catch (error) {
  }
}

function updateInfo(element) {
  const info = getElementInfo(element, { normalizeText: denoiseTextByApi });
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

function invalidatePrompt() {
  promptText.value = '';
}

function resetPromptComposer() {
  promptText.value = '';
  promptIntent.value = '';
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
  searchRunning.value = false;
  searchStartedAt.value = 0;
  searchFinishedAt.value = 0;
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
  resetPromptComposer();
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

function onSearchOptionChange() {
  clearCandidateState();
}

function onComposerInput(event) {
  setComposerValue(event?.target?.value || '');
}

function setComposerValue(value) {
  if (!composerEditable.value) return String(promptIntent.value || '');
  if (promptText.value) invalidatePrompt();
  promptIntent.value = String(value || '');
  return promptIntent.value;
}

function insertPromptAsset(token, options = {}) {
  if (!selectedItems.value.length || !token) {
    return {
      value: String(promptIntent.value || ''),
      cursor: String(promptIntent.value || '').length
    };
  }
  const nextToken = String(token).trim();
  const currentValue = String(promptIntent.value || '');
  if (!nextToken) {
    return {
      value: currentValue,
      cursor: currentValue.length
    };
  }
  const replaceMention = !!options.replaceMention;
  const start = Number.isFinite(options.replaceStart)
    ? Math.max(0, Math.min(Number(options.replaceStart), currentValue.length))
    : currentValue.length;
  const end = Number.isFinite(options.replaceEnd)
    ? Math.max(start, Math.min(Number(options.replaceEnd), currentValue.length))
    : start;
  const before = currentValue.slice(0, start);
  const after = currentValue.slice(end);
  const prefix = replaceMention || !before || /\s$/.test(before) ? '' : ' ';
  const suffix = after && /^\s/.test(after) ? '' : ' ';
  const nextValue = `${before}${prefix}${nextToken}${suffix}${after}`;
  const cursor = (before + prefix + nextToken + suffix).length;
  setComposerValue(nextValue);
  return {
    value: nextValue,
    cursor
  };
}

function getMdWeb() {
  try {
    const requireFn = typeof window._require === 'function'
      ? window._require
      : (typeof _require === 'function' ? _require : null);
    if (!requireFn) return null;
    const mdChrome = requireFn('mdChrome');
    return mdChrome?.web || null;
  } catch (error) {
    return null;
  }
}

function resolveSelectionAssetElement(element) {
  let resolved = element;
  let node = element?.parentElement || null;
  let currentEvidence = getContextEvidence(element, {
    normalizeText: denoiseTextByApi,
    subtreeOptions: {
      nodeLimit: 32,
      classLimit: 20,
      textLimit: 20,
      attrLimit: 20,
      styleLimit: 12
    }
  });
  let usefulDepth = 0;
  let inspected = 0;
  while (node && node.nodeType === 1 && usefulDepth < 4 && inspected < 16) {
    inspected++;
    const nextEvidence = getContextEvidence(node, {
      normalizeText: denoiseTextByApi,
      subtreeOptions: {
        nodeLimit: 32,
        classLimit: 20,
        textLimit: 20,
        attrLimit: 20,
        styleLimit: 12
      }
    });
    if (shouldPromoteContext(currentEvidence, nextEvidence)) {
      resolved = node;
      currentEvidence = nextEvidence;
      usefulDepth++;
      break;
    }
    if (node === document.body || node === document.documentElement) break;
    node = node.parentElement;
  }
  return resolved;
}

function clipRectToViewport(rect) {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(window.innerWidth, rect.left + rect.width);
  const bottom = Math.min(window.innerHeight, rect.top + rect.height);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function captureVisibleTabDataUrl() {
  const mdWeb = getMdWeb();
  if (!mdWeb?.cmd) return '';
  try {
    const result = await mdWeb.cmd({
      cmd: 'Base.tabs.captureVisibleTab',
      params: [{ format: 'png' }]
    });
    return result?.success ? (result.result || '') : '';
  } catch (error) {
    return '';
  }
}

async function cropSelectionThumbnail(sourceUrl, rect) {
  if (!sourceUrl || !rect || rect.width <= 0 || rect.height <= 0) return '';
  const image = await loadImage(sourceUrl);
  const scaleX = image.width / Math.max(window.innerWidth, 1);
  const scaleY = image.height / Math.max(window.innerHeight, 1);
  const sw = Math.max(1, Math.round(rect.width * scaleX));
  const sh = Math.max(1, Math.round(rect.height * scaleY));
  const sx = Math.max(0, Math.round(rect.left * scaleX));
  const sy = Math.max(0, Math.round(rect.top * scaleY));
  const maxOutputWidth = 1200;
  const maxOutputHeight = 1200;
  const preferredScale = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const ratio = Math.min(maxOutputWidth / sw, maxOutputHeight / sh, preferredScale);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * ratio));
  canvas.height = Math.max(1, Math.round(sh * ratio));
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return '';
  ctx2d.imageSmoothingEnabled = true;
  ctx2d.imageSmoothingQuality = 'high';
  ctx2d.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

async function updateSelectionAssetPreview(item) {
  if (!item?.uid || !item.element) return;
  try {
    const assetElement = resolveSelectionAssetElement(item.element);
    const assetInfo = getElementInfo(assetElement, { normalizeText: denoiseTextByApi }) || item.info;
    const viewportBox = clipRectToViewport(item.element.getBoundingClientRect());
    const fullCapture = await captureVisibleTabDataUrl();
    const thumbnailUrl = await cropSelectionThumbnail(fullCapture, viewportBox);
    const current = selectedItems.value.find(selection => selection.uid === item.uid);
    if (!current) return;
    current.assetElement = markRaw(assetElement);
    current.assetInfo = assetInfo;
    current.thumbnailUrl = thumbnailUrl || '';
    window.__MAGNUS_SELECTIONS__ = selectionPayloads();
    dispatchSelected();
  } catch (error) {
  }
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
  generatePrompt({ userInstruction: promptIntent.value.trim() });
}

function rememberWebRequestPayload(payload) {
  rememberRequest(normalizeRequestInfo(payload || {}, window.location.href));
}

function normalizeWebRequestCacheItem(item) {
  if (!item) return null;
  if (item.type === 'WEB_REQUEST_RESPONSE' && item.data) return item.data;
  return item;
}

function replayWebRequestCaches(api) {
  if (!api || !Array.isArray(api.caches) || !api.caches.length) return;
  const caches = api.caches.splice(0);
  caches.forEach(item => {
    const payload = normalizeWebRequestCacheItem(item);
    if (payload) rememberWebRequestPayload(payload);
  });
}

function installWebRequestApiListener() {
  const api = window.__WEB_REQUEST_API__;
  if (!api || typeof api.onResponse !== 'function') return false;

  webRequestApiInstalled = true;
  window[WEB_REQUEST_HANDLER_KEY] = rememberWebRequestPayload;

  if (!api[WEB_REQUEST_LISTENER_KEY]) {
    api.onResponse(payload => {
      const handler = window[WEB_REQUEST_HANDLER_KEY];
      if (typeof handler === 'function') handler(payload);
    });
    api[WEB_REQUEST_LISTENER_KEY] = true;
  }

  replayWebRequestCaches(api);
  if (typeof api.ready === 'function') api.ready();
  return true;
}

function installWebRequestApiListenerWithRetry() {
  if (installWebRequestApiListener()) return;
  if (webRequestApiRetryCount >= 20) return;
  webRequestApiRetryCount += 1;
  webRequestApiRetryTimer = window.setTimeout(installWebRequestApiListenerWithRetry, 250);
}

function onPageMessage(event) {
  if (webRequestApiInstalled) return;
  const message = event.data || {};
  if (message.type !== 'WEB_REQUEST_RESPONSE') return;
  rememberWebRequestPayload(message.data || {});
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
  const info = getElementInfo(element, { normalizeText: denoiseTextByApi });
  if (!info) return;

  const item = {
    uid: `selection-${Date.now()}-${selectionUid++}`,
    element: markRaw(element),
    info,
    assetElement: null,
    assetInfo: null,
    thumbnailUrl: ''
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
  invalidateSelectionConfirm();
  setToast(`已添加选区 ${selectedItems.value.length}`);
  void updateSelectionAssetPreview(item);
}

async function onKeyDown(event) {
  const isConfirmKey = (event.code === 'Space' || event.key === ' ') && !event.metaKey && !event.ctrlKey && !event.altKey;
  if (isConfirmKey && active.value && hoveredElement.value && !isFromAssistantUi(event) && !isEditableTarget(event.target)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
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
  invalidateSelectionConfirm();
  window.__MAGNUS_SELECTIONS__ = selectionPayloads();
  dispatchSelected();
  setToast(promptIntent.value.includes('@选区') ? '已移除选区，请检查输入框中的 @选区 引用' : '已移除选区');
  onScrollOrResize();
}

function clearSelections() {
  selectedItems.value = [];
  selectedElement.value = null;
  hoveredElement.value = null;
  displayInfo.value = null;
  selectionConfirmed.value = false;
  customEvidence.value = '';
  evidenceMessages.value = [];
  clearCandidateState();
  resetPromptComposer();
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
    searchRunning.value = true;
    searchStartedAt.value = Date.now();
    searchFinishedAt.value = 0;
    const timeoutMs = includeApiEvidence.value ? 30000 : 12000;
    const data = await (async () => {
      try {
        const firstPass = await runSearchRequest(searchPayload(), timeoutMs);
        const firstHits = Array.isArray(firstPass?.hits) ? firstPass.hits : [];
        if (!shouldRetryExpandedSearch(firstHits)) return firstPass;
        const secondPass = await runSearchRequest(searchPayload({ expandedRetry: true }), timeoutMs);
        const secondHits = Array.isArray(secondPass?.hits) ? secondPass.hits : [];
        return isBetterSearchResult(secondHits, firstHits) ? secondPass : firstPass;
      } finally {
        searchFinishedAt.value = Date.now();
        searchRunning.value = false;
      }
    })();
    candidateHits.value = Array.isArray(data.hits) ? data.hits : [];
    routeResolverTrace.value = data.routeResolver || null;
    apiTrace.value = data.apiTrace || null;
    if (!candidateHits.value.length) {
      selectedCandidatePaths.value = [];
      candidateError.value = '未找到候选文件。可以继续补充选区，或在输入框里补充更具体的修改要求后重试。';
    } else {
      selectedCandidatePaths.value = [candidateHits.value[0].file];
      expandedCandidatePath.value = '';
      setToast(`找到 ${candidateHits.value.length} 个候选文件`);
    }
    if (shouldAutoRunModelAssist(candidateHits.value) && useModelAssist.value && canUseModelAssist.value) {
      const modelResult = await runModelAssist();
      if (modelResult?.stopped) return [];
      if (hasUsableModelResult(modelResult)) {
        filesConfirmed.value = true;
        generatePrompt({ userInstruction: promptIntent.value.trim() });
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
  if (modelAssistLoading.value) {
    stopModelAssist();
    return;
  }
  if (!project.value) return;
  const instruction = promptIntent.value.trim();
  if (!instruction) return;
  if (showCandidatePicker.value) {
    confirmCandidateFiles();
    return;
  }
  if (!canConfirmSelection.value) return;
  confirmSelectionContext();
  const hits = await searchCandidateFiles();
  if (filesConfirmed.value) return;
  if (hits.length === 1) {
    selectedCandidatePaths.value = [hits[0].file];
    filesConfirmed.value = true;
    generatePrompt({ userInstruction: instruction });
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
  if (webRequestApiRetryTimer) {
    window.clearTimeout(webRequestApiRetryTimer);
    webRequestApiRetryTimer = 0;
  }
  if (window[WEB_REQUEST_HANDLER_KEY] === rememberWebRequestPayload) {
    window[WEB_REQUEST_HANDLER_KEY] = null;
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
  window.addEventListener('message', onPageMessage, true);
  installWebRequestApiListenerWithRetry();
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize, true);
});

onBeforeUnmount(cleanup);
</script>
