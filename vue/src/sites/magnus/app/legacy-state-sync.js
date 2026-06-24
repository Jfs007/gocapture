import { watch } from 'vue';
import { useChatStore } from '../stores/chat.store';
import { useComposerStore } from '../stores/composer.store';
import { useModelStore } from '../stores/model.store';
import { useProjectStore } from '../stores/project.store';
import { useSearchStore } from '../stores/search.store';

export function syncLegacyStateToStores({ source, search, composer, model, message }) {
  const projectStore = useProjectStore();
  const searchStore = useSearchStore();
  const chatStore = useChatStore();
  const composerStore = useComposerStore();
  const modelStore = useModelStore();

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

  watch(composer.promptText, value => {
    composerStore.setFinalPrompt(value || '');
  }, { immediate: true });

  watch(composer.promptIntent, value => {
    const nextValue = value || '';
    if (composerStore.content !== nextValue) composerStore.content = nextValue;
  }, { immediate: true });

  watch([
    model.selectedModelId,
    model.modelConfigs,
    model.modelAssistLoading,
    model.modelAssistError,
    model.modelAssistLogs,
    model.modelAssistResult
  ], ([
    selectedModelId,
    modelConfigs,
    modelAssistLoading,
    modelAssistError,
    modelAssistLogs,
    modelAssistResult
  ]) => {
    modelStore.selectedModelId = selectedModelId || null;
    modelStore.configs = Array.isArray(modelConfigs) ? modelConfigs : [];
    modelStore.logs = Array.isArray(modelAssistLogs) ? modelAssistLogs : [];
    modelStore.result = modelAssistResult || null;
    modelStore.error = modelAssistError || '';
    if (modelAssistLoading) modelStore.status = 'running';
    else if (modelAssistError) modelStore.status = 'error';
    else if (modelAssistResult?.stopped) modelStore.status = 'stopped';
    else if (modelAssistResult) modelStore.status = 'success';
    else modelStore.status = 'idle';
  }, { immediate: true });
}
