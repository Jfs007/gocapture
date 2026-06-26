export type ModelRunStatus = 'idle' | 'running' | 'stopped' | 'success' | 'error';

export interface ModelConfig {
  id?: string;
  name?: string;
  type?: 'exec' | 'api';
  provider?: string;
  [key: string]: unknown;
}

export interface ModelLocateResult {
  modelItems?: Array<Record<string, unknown>>;
  targetFiles?: Array<Record<string, unknown>>;
  stopped?: boolean;
  [key: string]: unknown;
}
