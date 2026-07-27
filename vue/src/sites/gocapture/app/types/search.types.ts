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
  regionOwner?: CompositeRenderFile | null;
  assembly?: { file: string; via?: string; chain?: string[] } | null;
  children?: CompositeChildFile[];
  coRenders?: CompositeRenderFile[];
  bridgeFiles?: { file: string; role?: string }[];
  relations?: {
    kind: string;
    from: string;
    to: string;
    chain?: string[];
    bridgeFiles?: string[];
    confidence?: number;
  }[];
  combinedCoverage?: Record<string, unknown>;
}

export interface ChangePlanTarget {
  file: string;
  anchor?: string;
  line?: number;
  whatToChange?: string;
  why?: string;
}

export interface ChangePlan {
  summary: string;
  targets: ChangePlanTarget[];
  affected?: { file: string; reason: string }[];
  reusePatterns?: string[];
  risks?: string[];
  verification?: string[];
  openQuestions?: Array<string | {
    id?: string;
    question?: string;
    reason?: string;
    options?: string[];
  }>;
}

export interface SearchResult {
  hits?: CandidateFile[];
  composite?: CompositeResult | null;
  routeResolver?: unknown;
  apiTrace?: unknown;
  i18nTrace?: unknown;
  definitionTrace?: unknown;
}
