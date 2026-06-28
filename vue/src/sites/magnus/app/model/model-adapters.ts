// @ts-nocheck
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { sourceServerNdjson } from '../services/source-service';
import { useModelStore } from '../../stores/model.store';
import { useAppUiStore } from '../../stores/app-ui.store';
import { useProjectStore } from '../../stores/project.store';
import { useRouteStore } from '../../stores/route.store';
import { useSearchStore } from '../../stores/search.store';
import { useSearchPrompt } from '../prompt/search-prompt';

const MODEL_STORAGE_KEY = 'magnus:model-adapters';
const MODEL_SELECTED_KEY = 'magnus:model-adapters:selected';

function loadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
  }
}

function loadText(key, fallback = '') {
  try {
    const raw = window.localStorage.getItem(key);
    return typeof raw === 'string' ? raw : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveText(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch (error) {
  }
}

function extensionStorage() {
  try {
    const requireFn = typeof window._require === 'function'
      ? window._require
      : (typeof _require === 'function' ? _require : null);
    if (!requireFn) return null;
    const storage = requireFn('md.storage');
    return storage && storage.local ? storage.local : null;
  } catch (error) {
    return null;
  }
}

async function loadPersistedModelState() {
  const localModels = loadJson(MODEL_STORAGE_KEY, []);
  const localSelectedId = loadText(MODEL_SELECTED_KEY, '');
  const storage = extensionStorage();
  if (!storage) {
    return {
      models: localModels,
      selectedId: localSelectedId,
      migrated: false
    };
  }

  try {
    const data = await storage.get([MODEL_STORAGE_KEY, MODEL_SELECTED_KEY]);
    const hasModels = Array.isArray(data?.[MODEL_STORAGE_KEY]);
    const hasSelectedId = typeof data?.[MODEL_SELECTED_KEY] === 'string';
    if (hasModels || hasSelectedId) {
      return {
        models: hasModels ? data[MODEL_STORAGE_KEY] : [],
        selectedId: hasSelectedId ? data[MODEL_SELECTED_KEY] : '',
        migrated: false
      };
    }
  } catch (error) {
  }

  return {
    models: localModels,
    selectedId: localSelectedId,
    migrated: !!(localModels.length || localSelectedId)
  };
}

async function persistModelState(models, selectedId) {
  saveJson(MODEL_STORAGE_KEY, models);
  saveText(MODEL_SELECTED_KEY, selectedId);
  const storage = extensionStorage();
  if (!storage) return;
  try {
    await storage.set({
      [MODEL_STORAGE_KEY]: models,
      [MODEL_SELECTED_KEY]: selectedId || ''
    });
  } catch (error) {
  }
}

function defaultModelForm() {
  return {
    id: '',
    name: '',
    provider: 'custom',
    type: 'exec',
    command: 'codex exec',
    endpoint: '',
    apiKey: '',
    model: '',
    proxyUrl: '',
    timeoutMs: 120000
  };
}

function providerModelForm(provider) {
  if (provider === 'deepseek') {
    return {
      ...defaultModelForm(),
      name: 'DeepSeek',
      provider: 'deepseek',
      type: 'api',
      command: '',
      endpoint: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-v4-pro'
    };
  }
  return defaultModelForm();
}

function normalizeModel(raw) {
  const item = raw || {};
  const type = item.type === 'api' ? 'api' : 'exec';
  const provider = item.provider === 'deepseek' ? 'deepseek' : 'custom';
  const defaultName = provider === 'deepseek'
    ? 'DeepSeek'
    : (type === 'api' ? 'API 模型' : 'Cli 模型');
  const normalizedName = item.name === 'Exec 模型' ? 'Cli 模型' : item.name;
  return {
    id: item.id || `model-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: normalizedName || defaultName,
    provider,
    type,
    command: item.command || '',
    endpoint: item.endpoint || (provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : ''),
    apiKey: item.apiKey || '',
    model: item.model || (provider === 'deepseek' ? 'deepseek-v4-pro' : ''),
    proxyUrl: item.proxyUrl || '',
    timeoutMs: Number(item.timeoutMs || 120000)
  };
}

export function useModelAdapters() {
  const modelStore = useModelStore();
  const appUiStore = useAppUiStore();
  const projectStore = useProjectStore();
  const routeStore = useRouteStore();
  const searchStore = useSearchStore();
  const prompt = useSearchPrompt();
  const { current: project } = storeToRefs(projectStore);
  const { resolverTrace: routeResolverTrace } = storeToRefs(routeStore);
  const {
    candidates: candidateHits,
    selectedCandidatePaths,
    apiTrace,
    i18nTrace,
    definitionTrace
  } = storeToRefs(searchStore);
  const { searchPayload } = prompt;
  if (!modelStore.configs.length) modelStore.configs = loadJson(MODEL_STORAGE_KEY, []).map(normalizeModel);
  if (!modelStore.selectedModelId) modelStore.selectedModelId = loadText(MODEL_SELECTED_KEY, '');
  modelStore.useModelAssist = !!modelStore.selectedModelId;
  const {
    configs: modelConfigs,
    selectedModelId,
    useModelAssist,
    editorOpen: modelEditorOpen,
    form: modelForm,
    error: modelAssistError,
    logs: modelAssistLogs,
    result: modelAssistResult,
    startedAt: modelAssistStartedAt,
    finishedAt: modelAssistFinishedAt
  } = storeToRefs(modelStore);
  let modelAssistController = null;

  const selectedModel = computed(() => {
    return modelConfigs.value.find(item => item.id === selectedModelId.value) || null;
  });

  const canUseModelAssist = computed(() => {
    return !!selectedModel.value && !!project.value && project.value.source === 'source-server';
  });
  const modelAssistLoading = computed({
    get: () => modelStore.status === 'running',
    set: value => {
      if (value) {
        modelStore.status = 'running';
        return;
      }
      if (modelStore.status !== 'running') return;
      if (modelAssistError.value) modelStore.status = 'error';
      else if (modelAssistResult.value?.stopped) modelStore.status = 'stopped';
      else if (modelAssistResult.value) modelStore.status = 'success';
      else modelStore.status = 'idle';
    }
  });

  watch(canUseModelAssist, value => {
    modelStore.canUseModelAssist = !!value;
  }, { immediate: true });

  function persistModels() {
    void persistModelState(modelConfigs.value, selectedModelId.value);
  }

  async function hydratePersistedModels() {
    const state = await loadPersistedModelState();
    const nextModels = (Array.isArray(state.models) ? state.models : []).map(normalizeModel);
    const validSelectedId = nextModels.some(item => item.id === state.selectedId) ? state.selectedId : '';
    modelConfigs.value = nextModels;
    selectedModelId.value = validSelectedId;
    useModelAssist.value = !!validSelectedId;
    if (state.migrated || (state.selectedId && state.selectedId !== validSelectedId)) {
      void persistModelState(nextModels, validSelectedId);
    }
  }

  function openModelEditor(model) {
    modelForm.value = model ? { ...model } : defaultModelForm();
    modelEditorOpen.value = true;
  }

  function openProviderModelEditor(provider) {
    modelForm.value = providerModelForm(provider);
    modelEditorOpen.value = true;
  }

  function closeModelEditor() {
    modelEditorOpen.value = false;
  }

  function saveModelForm() {
    const normalized = normalizeModel(modelForm.value);
    const index = modelConfigs.value.findIndex(item => item.id === normalized.id);
    if (index === -1) modelConfigs.value.push(normalized);
    else modelConfigs.value.splice(index, 1, normalized);
    selectedModelId.value = normalized.id;
    useModelAssist.value = true;
    persistModels();
    modelEditorOpen.value = false;
    appUiStore.setToast('模型已保存');
  }

  function removeSelectedModel() {
    if (!selectedModelId.value) return;
    modelConfigs.value = modelConfigs.value.filter(item => item.id !== selectedModelId.value);
    selectedModelId.value = modelConfigs.value[0]?.id || '';
    persistModels();
    if (!selectedModelId.value) useModelAssist.value = false;
    appUiStore.setToast('模型已移除');
  }

  function setSelectedModel(id) {
    selectedModelId.value = id || '';
    useModelAssist.value = !!selectedModelId.value;
    persistModels();
  }

  function selectModelAndEnable(id) {
    selectedModelId.value = id || '';
    useModelAssist.value = !!selectedModelId.value;
    persistModels();
    if (selectedModelId.value) appUiStore.setToast('模型已启用');
  }

  function disableModelAssist() {
    selectedModelId.value = '';
    useModelAssist.value = false;
    persistModels();
    appUiStore.setToast('模型已停用');
  }

  function setUseModelAssist(value) {
    useModelAssist.value = !!value;
    if (useModelAssist.value && !selectedModel.value) {
      openModelEditor();
    }
  }

  function resetModelAssist() {
    modelAssistError.value = '';
    modelAssistLogs.value = [];
    modelAssistResult.value = null;
    modelAssistStartedAt.value = 0;
    modelAssistFinishedAt.value = 0;
    modelStore.status = 'idle';
  }

  function mergeModelTargets(result) {
    const targets = (result?.modelItems || result?.targetFiles || []).filter(item => item.exists);
    if (!targets.length) return;

    const oldHits = candidateHits.value.slice();
    const byFile = new Map(oldHits.map(hit => [hit.file, hit]));
    const promoted = targets.map((target, index) => {
      const old = byFile.get(target.file);
      const score = Math.max(old?.score || 0, 980 - index * 40 + Math.round((target.confidence || 0) * 0.2));
      return {
        ...(old || {
          file: target.file,
          from: '',
          snippet: '',
          uniqueSnippet: '',
          uniqueMatchLabel: '',
          uniqueMatchText: '',
          uniqueMatchCount: 0
        }),
        score,
        stage: 'model-agent',
        preModelStage: old?.stage || '',
        preModelStageLabel: old?.stage ? old.stage : '',
        preModelReasons: old?.reasons || [],
        reasons: [
          `模型定位：${target.enhancedPrompt || target.prompt || target.reason || result.parsed?.summary || result.rawText || '-'}`,
          target.directionGuess ? `推测方向：${target.directionGuess}` : '',
          target.codeSnippet ? `模型代码片段：${target.codeSnippet}` : '',
          ...(old?.reasons || [])
        ].filter(Boolean).slice(0, 10),
        modelPrompt: target.enhancedPrompt || target.prompt || target.reason || '',
        modelEnhancedPrompt: target.enhancedPrompt || '',
        modelExperienceMode: target.experienceMode || '',
        modelUsedSkillIds: target.usedSkillIds || [],
        modelCodeSnippet: target.codeSnippet || '',
        modelLocateLevel: target.fileOnly ? 'file' : (target.locateLevel || 'exact'),
        modelFileOnly: !!target.fileOnly,
        modelSelectionFallback: !!target.selectionFallback,
        modelSnippetSource: target.snippetSource || '',
        modelDirectionGuess: target.directionGuess || '',
        modelSnippetVerified: target.fileOnly ? true : target.snippetVerified !== false,
        modelDowngradedToDirection: !!target.downgradedToDirection,
        modelConfidence: target.confidence,
        modelAdapter: result.adapter?.name || ''
      };
    });

    const promotedFiles = new Set(promoted.map(hit => hit.file));
    candidateHits.value = [
      ...promoted,
      ...oldHits.filter(hit => !promotedFiles.has(hit.file))
    ].sort((a, b) => b.score - a.score);
    selectedCandidatePaths.value = promoted.map(hit => hit.file);
  }

  async function runModelAssist() {
    if (!useModelAssist.value || !canUseModelAssist.value) return null;
    if (modelAssistLoading.value) return null;
    const controller = new AbortController();
    modelAssistController = controller;
    modelAssistStartedAt.value = Date.now();
    modelAssistFinishedAt.value = 0;
    modelAssistLoading.value = true;
    modelAssistError.value = '';
    modelAssistLogs.value = ['模型定位请求已发起'];
    modelAssistResult.value = null;
    try {
      const result = await sourceServerNdjson('/api/model/locate/stream', {
        method: 'POST',
        controller,
        body: {
          adapter: selectedModel.value,
          searchPayload: searchPayload(),
          pagePath: routeResolverTrace.value?.pagePath || '',
          routeResolver: routeResolverTrace.value,
          apiTrace: apiTrace?.value || null,
          i18nTrace: i18nTrace?.value || null,
          definitionTrace: definitionTrace?.value || null,
          candidateHits: candidateHits.value.slice(0, 4),
          selectedCandidateHits: candidateHits.value.filter(hit => selectedCandidatePaths.value.includes(hit.file)).slice(0, 4),
        },
        timeoutMs: Number(selectedModel.value.timeoutMs || 120000) * 3 + 5000,
        timeoutMessage: '模型定位超时',
        abortMessage: '模型定位已停止',
        onEvent(event) {
          if (event.type === 'log' && event.log) {
            modelAssistLogs.value = [...modelAssistLogs.value, event.log];
          }
          if (event.type === 'result') {
            modelAssistResult.value = event.result || null;
          }
          if (event.type === 'error' && Array.isArray(event.logs)) {
            modelAssistLogs.value = event.logs;
          }
        }
      });
      modelAssistResult.value = result || modelAssistResult.value || null;
      modelAssistLogs.value = modelAssistResult.value?.logs || [];
      mergeModelTargets(modelAssistResult.value);
      appUiStore.setToast('模型定位已完成');
      return modelAssistResult.value;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const stoppedLogs = [...modelAssistLogs.value, '已手动停止'];
        modelAssistLogs.value = stoppedLogs;
        modelAssistResult.value = {
          adapter: {
            id: selectedModel.value?.id || '',
            name: selectedModel.value?.name || '模型',
            type: selectedModel.value?.type || ''
          },
          stopped: true,
          modelItems: [],
          targetFiles: [],
          logs: stoppedLogs
        };
        modelAssistError.value = '';
        appUiStore.setToast('已手动停止');
        return modelAssistResult.value;
      }
      modelAssistError.value = error.message || String(error);
      modelAssistLogs.value = error.payload?.logs || modelAssistLogs.value;
      appUiStore.setToast('模型定位失败');
      return null;
    } finally {
      modelAssistFinishedAt.value = Date.now();
      modelAssistLoading.value = false;
      if (modelAssistController === controller) modelAssistController = null;
    }
  }

  function stopModelAssist() {
    if (!modelAssistLoading.value || !modelAssistController) return;
    modelAssistLogs.value = [...modelAssistLogs.value, '正在停止模型定位...'];
    modelAssistController.abort();
  }

  void hydratePersistedModels();

  return {
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
  };
}
