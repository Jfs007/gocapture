import { computed, ref } from 'vue';
import { sourceServerJson } from '../source-service';

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
  return {
    id: item.id || `model-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: item.name || (provider === 'deepseek' ? 'DeepSeek' : (type === 'api' ? 'API 模型' : 'Exec 模型')),
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

export function useModelAdapters({ project, candidateHits, selectedCandidatePaths, searchPayload, routeResolverTrace, setToast }) {
  const modelConfigs = ref(loadJson(MODEL_STORAGE_KEY, []).map(normalizeModel));
  const selectedModelId = ref(window.localStorage.getItem(MODEL_SELECTED_KEY) || '');
  const useModelAssist = ref(!!selectedModelId.value);
  const modelEditorOpen = ref(false);
  const modelForm = ref(defaultModelForm());
  const modelAssistLoading = ref(false);
  const modelAssistError = ref('');
  const modelAssistLogs = ref([]);
  const modelAssistResult = ref(null);

  const selectedModel = computed(() => {
    return modelConfigs.value.find(item => item.id === selectedModelId.value) || null;
  });

  const canUseModelAssist = computed(() => {
    return !!selectedModel.value && !!project.value && project.value.source === 'source-server';
  });

  function persistModels() {
    saveJson(MODEL_STORAGE_KEY, modelConfigs.value);
    try {
      if (selectedModelId.value) window.localStorage.setItem(MODEL_SELECTED_KEY, selectedModelId.value);
      else window.localStorage.removeItem(MODEL_SELECTED_KEY);
    } catch (error) {
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
    setToast('模型已保存');
  }

  function removeSelectedModel() {
    if (!selectedModelId.value) return;
    modelConfigs.value = modelConfigs.value.filter(item => item.id !== selectedModelId.value);
    selectedModelId.value = modelConfigs.value[0]?.id || '';
    persistModels();
    if (!selectedModelId.value) useModelAssist.value = false;
    setToast('模型已移除');
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
    if (selectedModelId.value) setToast('模型已启用');
  }

  function disableModelAssist() {
    selectedModelId.value = '';
    useModelAssist.value = false;
    persistModels();
    setToast('模型已停用');
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
        reasons: [
          `模型定位：${target.prompt || target.reason || result.parsed?.summary || result.rawText || '-'}`,
          target.codeSnippet ? `模型代码片段：${target.codeSnippet}` : '',
          ...(old?.reasons || [])
        ].filter(Boolean).slice(0, 10),
        modelPrompt: target.prompt || target.reason || '',
        modelCodeSnippet: target.codeSnippet || '',
        modelConfidence: target.confidence,
        modelAdapter: result.adapter?.name || ''
      };
    });

    const promotedFiles = new Set(promoted.map(hit => hit.file));
    candidateHits.value = [
      ...promoted,
      ...oldHits.filter(hit => !promotedFiles.has(hit.file))
    ].sort((a, b) => b.score - a.score);
    selectedCandidatePaths.value = [promoted[0].file];
  }

  async function runModelAssist() {
    if (!useModelAssist.value || !canUseModelAssist.value) return null;
    modelAssistLoading.value = true;
    modelAssistError.value = '';
    modelAssistLogs.value = ['模型定位请求已发起'];
    modelAssistResult.value = null;
    try {
      const data = await sourceServerJson('/api/model/locate', {
        method: 'POST',
        body: {
          adapter: selectedModel.value,
          searchPayload: searchPayload(),
          pagePath: routeResolverTrace.value?.pagePath || '',
          routeResolver: routeResolverTrace.value,
          candidateHits: candidateHits.value.slice(0, 12),
          selectedCandidateHits: candidateHits.value.filter(hit => selectedCandidatePaths.value.includes(hit.file)).slice(0, 8),
        },
        timeoutMs: Number(selectedModel.value.timeoutMs || 120000) + 5000,
        timeoutMessage: '模型定位超时'
      });
      modelAssistResult.value = data.result || null;
      modelAssistLogs.value = modelAssistResult.value?.logs || [];
      mergeModelTargets(modelAssistResult.value);
      setToast('模型定位已完成');
      return modelAssistResult.value;
    } catch (error) {
      modelAssistError.value = error.message || String(error);
      modelAssistLogs.value = error.payload?.logs || modelAssistLogs.value;
      setToast('模型定位失败');
      return null;
    } finally {
      modelAssistLoading.value = false;
    }
  }

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
  };
}
