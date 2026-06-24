import type { ModelLocateResult } from '../../domain/model/model.types';

export interface ModelApi {
  locate(run: () => Promise<ModelLocateResult | null>): Promise<ModelLocateResult | null>;
}

export function createModelApi(): ModelApi {
  return {
    locate(run) {
      return run();
    }
  };
}
