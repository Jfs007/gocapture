export interface CandidateFile {
  file: string;
  score?: number;
  stage?: string;
  preciseEvidence?: boolean;
  [key: string]: unknown;
}

export interface SearchResult {
  hits?: CandidateFile[];
  routeResolver?: unknown;
  apiTrace?: unknown;
  i18nTrace?: unknown;
  definitionTrace?: unknown;
}
