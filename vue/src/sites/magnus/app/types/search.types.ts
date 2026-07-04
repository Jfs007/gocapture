export interface CandidateFile {
  file: string;
  score?: number;
  stage?: string;
  preciseEvidence?: boolean;
  [key: string]: unknown;
}

export interface CompositeRenderFile {
  file: string;
  role?: string;
  score?: number;
  anchors?: string[];
  line?: number;
  column?: number;
  anchor?: string;
}

export interface CompositeChildFile {
  file: string;
  anchor?: string;
}

export interface CompositeResult {
  render: CompositeRenderFile;
  assembly?: { file: string; via?: string; chain?: string[] } | null;
  children?: CompositeChildFile[];
  coRenders?: CompositeRenderFile[];
}

export interface SearchResult {
  hits?: CandidateFile[];
  composite?: CompositeResult | null;
  routeResolver?: unknown;
  apiTrace?: unknown;
  i18nTrace?: unknown;
  definitionTrace?: unknown;
}
