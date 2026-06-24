import { useModelAdapters } from '../use-model-adapters';

export function useModelModule({
  source,
  route,
  search,
  prompt,
  setToast
}) {
  return useModelAdapters({
    project: source.project,
    candidateHits: search.candidateHits,
    selectedCandidatePaths: search.selectedCandidatePaths,
    searchPayload: prompt.searchPayload,
    routeResolverTrace: route.routeResolverTrace,
    apiTrace: search.apiTrace,
    i18nTrace: search.i18nTrace,
    definitionTrace: search.definitionTrace,
    setToast
  });
}
