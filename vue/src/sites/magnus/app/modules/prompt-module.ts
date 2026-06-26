import { useSearchPrompt } from '../prompt/search-prompt';
import type { MagnusModules, MagnusRuntimeContext } from '../runtime/context';

export function usePromptModule(modules: Pick<MagnusModules, 'source' | 'route' | 'search' | 'selection' | 'composer' | 'requests' | 'toast'>, runtime: MagnusRuntimeContext) {
  const { source, route, search, selection, composer, requests, toast } = modules;
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
    currentPageHref: runtime.currentPageHref,
    pageUrlPath: runtime.routePagePath,
    project: source.project,
    promptText: composer.promptText,
    denoiseTextByApi: requests.denoiseTextByApi,
    selectionPayloads: selection.selectionPayloads,
    setToast: toast.setToast
  });
}
