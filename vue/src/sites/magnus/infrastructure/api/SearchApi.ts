import { sourceServerJson } from '../../services/source-service';
import type { SearchResult } from '../../domain/search/search.types';

export interface SearchApi {
  search(payload: unknown, options?: { timeoutMs?: number; timeoutMessage?: string }): Promise<SearchResult>;
}

export function createSearchApi(): SearchApi {
  return {
    search(payload, options = {}) {
      return sourceServerJson('/api/search', {
        method: 'POST',
        body: payload,
        timeoutMs: options.timeoutMs || 12000,
        timeoutMessage: options.timeoutMessage || '源码检索超时'
      });
    }
  };
}
