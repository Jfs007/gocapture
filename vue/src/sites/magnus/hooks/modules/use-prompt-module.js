import { useSearchPrompt } from '../use-search-prompt';

export function usePromptModule({
  source,
  route,
  search,
  selection,
  composer,
  requests,
  currentPageHref,
  pageUrlPath,
  setToast
}) {
  return useSearchPrompt({
    selectedItems: selection.selectedItems,
    selectedCandidatePaths: search.selectedCandidatePaths,
    selectedCandidateHits: search.selectedCandidateHits,
    candidateHits: search.candidateHits,
    routeResolverTrace: route.routeResolverTrace,
    apiTrace: search.apiTrace,
    i18nTrace: search.i18nTrace,
    definitionTrace: search.definitionTrace,
    evidenceMessages: selection.evidenceMessages,
    customEvidence: selection.customEvidence,
    promptIntent: composer.promptIntent,
    searchKeywords: search.searchKeywords,
    includeApiEvidence: search.includeApiEvidence,
    searchApiRequests: search.searchApiRequests,
    currentPageHref,
    pageUrlPath,
    project: source.project,
    promptText: composer.promptText,
    denoiseTextByApi: requests.denoiseTextByApi,
    selectionPayloads: selection.selectionPayloads,
    setToast
  });
}
