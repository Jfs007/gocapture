import type { ComputedRef, Ref } from 'vue';

export interface GoCaptureRuntimeContext {
  api: Record<string, any>;
  currentPageHref: Ref<string>;
  sidePanelConfig: ComputedRef<Record<string, any>>;
  routePagePath: ComputedRef<string>;
  pageHost: ComputedRef<string>;
}

export interface GoCaptureRuntimeState {
  api: Record<string, any>;
  currentPageHref: Ref<string>;
  requests: any;
  source: any;
  route: any;
  search: any;
  selection: any;
  composer: any;
  bridge: any;
  prompt: any;
  message: any;
}

export type GoCaptureActions = Record<string, any>;
