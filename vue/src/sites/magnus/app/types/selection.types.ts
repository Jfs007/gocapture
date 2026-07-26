export type SelectionId = string;

export interface ElementBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ElementInfo {
  uid?: string;
  tag?: string;
  text?: string;
  searchText?: string;
  className?: string;
  selector?: string;
  innerHtml?: string;
  outerHtml?: string;
  rawOuterHtml?: string;
  inlineStyle?: string;
  computedStyle?: unknown;
  box?: ElementBox | null;
  [key: string]: unknown;
}

export interface SelectionSourceTarget {
  file: string;
  role?: string;
  line?: number;
  anchor?: string;
  targetSnippet?: string;
  codeSnippet?: string;
  importChain?: string[];
  directionGuess?: string;
  locateLevel?: string;
  scopeAlignment?: string;
  reasons?: string[];
}

export interface SelectionSourceInvestigation {
  status: string;
  reason?: string;
  coveredDom?: string[];
  missingEvidence?: string[];
  relations?: Array<{
    from: string;
    to: string;
    type: string;
    evidence?: string;
  }>;
}

export interface SelectionSourceBinding {
  selectionId?: string;
  projectRoot: string;
  designRequirement: string;
  targets: SelectionSourceTarget[];
  investigation?: SelectionSourceInvestigation | null;
  originSelections?: unknown[];
  agentContext?: {
    providerId: string;
    threadId: string;
    meaning: string;
    updatedAt: number;
  } | null;
  resolvedAt: number;
}

export interface SelectionAsset {
  uid: SelectionId;
  pageBindingId?: string;
  element: ElementInfo;
  asset?: ElementInfo | null;
  sourceLocate?: unknown;
  sourceBinding?: SelectionSourceBinding | null;
  thumbnailUrl?: string;
  thumbnailCaptured?: boolean;
}

export interface RuntimeSelectionPayload {
  uid?: string;
  pageBindingId?: string;
  element?: ElementInfo;
  info?: ElementInfo;
  asset?: ElementInfo;
  sourceLocate?: unknown;
  sourceEvidence?: unknown;
  sourceBinding?: SelectionSourceBinding | null;
  thumbnailUrl?: string;
  thumbnail?: string;
  [key: string]: unknown;
}
