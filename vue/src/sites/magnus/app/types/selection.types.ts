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
  inlineStyle?: string;
  computedStyle?: unknown;
  box?: ElementBox | null;
  [key: string]: unknown;
}

export interface SelectionAsset {
  uid: SelectionId;
  element: ElementInfo;
  asset?: ElementInfo | null;
  thumbnailUrl?: string;
  thumbnailCaptured?: boolean;
}

export interface RuntimeSelectionPayload {
  uid?: string;
  element?: ElementInfo;
  info?: ElementInfo;
  asset?: ElementInfo;
  thumbnailUrl?: string;
  thumbnail?: string;
  [key: string]: unknown;
}
