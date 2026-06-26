import { useChatMessages } from '../presenters/chat-messages';
import type { MagnusModules } from '../runtime/context';

export function useMessageModule(modules: Pick<MagnusModules, 'source' | 'search' | 'selection' | 'composer' | 'model' | 'prompt'>) {
  const { source, search, selection, composer, model, prompt } = modules;
  return useChatMessages({
    project: source.project,
    selectedItems: selection.selectedItems,
    selectionConfirmed: selection.selectionConfirmed,
    evidenceMessages: selection.evidenceMessages,
    candidateLoading: search.candidateLoading,
    searchRunning: search.searchRunning,
    includeApiEvidence: search.includeApiEvidence,
    candidateHits: search.candidateHits,
    needsMoreEvidence: search.needsMoreEvidence,
    filesConfirmed: selection.filesConfirmed,
    promptText: composer.promptText,
    sourceServiceStatus: source.sourceServiceStatus,
    sourceServiceMessage: source.sourceServiceMessage,
    modelAssistLoading: model.modelAssistLoading,
    modelAssistError: model.modelAssistError,
    modelAssistLogs: model.modelAssistLogs,
    modelAssistResult: model.modelAssistResult,
    searchStartedAt: search.searchStartedAt,
    searchFinishedAt: search.searchFinishedAt,
    modelAssistStartedAt: model.modelAssistStartedAt,
    modelAssistFinishedAt: model.modelAssistFinishedAt,
    selectionChatSummary: prompt.selectionChatSummary,
    searchLogLines: prompt.searchLogLines
  });
}
