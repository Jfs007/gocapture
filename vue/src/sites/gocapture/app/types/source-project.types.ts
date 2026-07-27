export interface SourceProject {
  path?: string;
  root?: string;
  name?: string;
  kind?: string;
  source?: string;
  [key: string]: unknown;
}

export type SourceServiceStatus = 'unknown' | 'idle' | 'ready' | 'loading' | 'connected' | 'fallback' | 'error';
