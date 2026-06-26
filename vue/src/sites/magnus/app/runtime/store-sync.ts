import { watch } from 'vue';
import { useChatStore } from '../../stores/chat.store';
import { useComposerStore } from '../../stores/composer.store';
import { useModelStore } from '../../stores/model.store';
import { useProjectStore } from '../../stores/project.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';
import { useAppUiStore } from '../../stores/app-ui.store';
import type { MagnusModules } from './context';

export function syncRuntimeStateToStores(modules: Pick<MagnusModules, 'source' | 'search' | 'selection' | 'composer' | 'model' | 'message' | 'toast'>) {
  const { source, search, selection, composer, model, message, toast } = modules;
  const projectStore = useProjectStore();
  const searchStore = useSearchStore();
  const chatStore = useChatStore();
  const composerStore = useComposerStore();
  const modelStore = useModelStore();
  const selectionStore = useSelectionStore();
  const appUiStore = useAppUiStore();

  watch(source.project, value => {
    projectStore.setProject(value || null);
  }, { immediate: true });

  watch([
    source.sourceServiceStatus,
    source.sourceServiceMessage,
    source.sourceServiceError
  ], ([status, serviceMessage, serviceError]) => {
    projectStore.setServiceStatus(status || 'idle', serviceMessage || '', serviceError || '');
  }, { immediate: true });

  watch(message.chatMessages, value => {
    chatStore.setMessages(value || []);
  }, { immediate: true });

  watch(toast.toastText, value => {
    appUiStore.setToast(value || '');
  }, { immediate: true });

  watch(selection.selectedItems, value => {
    selectionStore.setItems(Array.isArray(value) ? value : []);
  }, { immediate: true, deep: true });

  watch([
    selection.selectionConfirmed,
    selection.filesConfirmed,
    selection.customEvidence,
    selection.evidenceMessages
  ], ([confirmed, filesConfirmed, customEvidence, evidenceMessages]) => {
    selectionStore.confirmed = !!confirmed;
    selectionStore.filesConfirmed = !!filesConfirmed;
    selectionStore.customEvidence = customEvidence || '';
    selectionStore.evidenceMessages = Array.isArray(evidenceMessages) ? evidenceMessages : [];
  }, { immediate: true });

  watch(search.candidateHits, value => {
    searchStore.candidates = Array.isArray(value) ? value : [];
  }, { immediate: true });

  watch(search.selectedCandidatePaths, value => {
    searchStore.selectedCandidatePaths = Array.isArray(value) ? value : [];
  }, { immediate: true });

  watch(search.expandedCandidatePath, value => {
    searchStore.expandedCandidatePath = value || '';
  }, { immediate: true });

  watch([
    search.candidateLoading,
    search.searchRunning,
    search.candidateError
  ], ([candidateLoading, searchRunning, candidateError]) => {
    searchStore.error = candidateError || '';
    if (candidateError) searchStore.status = 'error';
    else if (candidateLoading || searchRunning) searchStore.status = 'loading';
    else if (searchStore.candidates.length) searchStore.status = 'success';
    else searchStore.status = 'idle';
  }, { immediate: true });

  watch([
    search.apiTrace,
    search.i18nTrace,
    search.definitionTrace,
    search.searchStartedAt,
    search.searchFinishedAt,
    search.includeApiEvidence,
    search.modelAssistAttempted
  ], ([
    apiTrace,
    i18nTrace,
    definitionTrace,
    startedAt,
    finishedAt,
    includeApiEvidence,
    modelAssistAttempted
  ]) => {
    searchStore.apiTrace = apiTrace || null;
    searchStore.i18nTrace = i18nTrace || null;
    searchStore.definitionTrace = definitionTrace || null;
    searchStore.startedAt = Number(startedAt || 0);
    searchStore.finishedAt = Number(finishedAt || 0);
    searchStore.includeApiEvidence = !!includeApiEvidence;
    searchStore.modelAssistAttempted = !!modelAssistAttempted;
  }, { immediate: true });

  watch([
    search.showCandidatePicker,
    search.needsMoreEvidence
  ], ([showCandidatePicker, needsMoreEvidence]) => {
    searchStore.showCandidatePicker = !!showCandidatePicker;
    searchStore.needsMoreEvidence = !!needsMoreEvidence;
  }, { immediate: true });

  watch(composer.promptText, value => {
    composerStore.setFinalPrompt(value || '');
  }, { immediate: true });

  watch(composer.promptIntent, value => {
    const nextValue = value || '';
    if (composerStore.content !== nextValue) composerStore.content = nextValue;
  }, { immediate: true });

  watch([
    model.selectedModelId,
    model.selectedModel,
    model.useModelAssist,
    model.canUseModelAssist,
    model.modelConfigs,
    model.modelEditorOpen,
    model.modelForm,
    model.modelAssistLoading,
    model.modelAssistError,
    model.modelAssistLogs,
    model.modelAssistResult,
    model.modelAssistStartedAt,
    model.modelAssistFinishedAt
  ], ([
    selectedModelId,
    selectedModel,
    useModelAssist,
    canUseModelAssist,
    modelConfigs,
    modelEditorOpen,
    modelForm,
    modelAssistLoading,
    modelAssistError,
    modelAssistLogs,
    modelAssistResult,
    modelAssistStartedAt,
    modelAssistFinishedAt
  ]) => {
    modelStore.selectedModelId = selectedModelId || null;
    modelStore.configs = Array.isArray(modelConfigs) ? modelConfigs : [];
    modelStore.useModelAssist = !!useModelAssist;
    modelStore.canUseModelAssist = !!canUseModelAssist;
    modelStore.editorOpen = !!modelEditorOpen;
    modelStore.form = modelForm || {};
    modelStore.logs = Array.isArray(modelAssistLogs) ? modelAssistLogs : [];
    modelStore.result = modelAssistResult || null;
    modelStore.error = modelAssistError || '';
    modelStore.startedAt = Number(modelAssistStartedAt || 0);
    modelStore.finishedAt = Number(modelAssistFinishedAt || 0);
    if (modelAssistLoading) modelStore.status = 'running';
    else if (modelAssistError) modelStore.status = 'error';
    else if (modelAssistResult?.stopped) modelStore.status = 'stopped';
    else if (modelAssistResult) modelStore.status = 'success';
    else modelStore.status = 'idle';
  }, { immediate: true });
}
