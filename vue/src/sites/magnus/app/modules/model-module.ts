import { useModelAdapters } from '../model/model-adapters';
import type { MagnusModules } from '../runtime/context';

export function useModelModule(modules: Pick<MagnusModules, 'source' | 'route' | 'search' | 'prompt' | 'toast'>) {
  const { source, route, search, prompt, toast } = modules;
  return useModelAdapters({
    project: source.project,
    candidateHits: search.candidateHits,
    selectedCandidatePaths: search.selectedCandidatePaths,
    searchPayload: prompt.searchPayload,
    routeResolverTrace: route.routeResolverTrace,
    apiTrace: search.apiTrace,
    i18nTrace: search.i18nTrace,
    definitionTrace: search.definitionTrace,
    setToast: toast.setToast
  });
}
