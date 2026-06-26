import type { ComputedRef, Ref } from 'vue';

export interface MagnusRuntimeContext {
  api: Record<string, any>;
  currentPageHref: Ref<string>;
  sidePanelConfig: ComputedRef<Record<string, any>>;
  routePagePath: ComputedRef<string>;
  pageHost: ComputedRef<string>;
}

export interface MagnusRuntimeState {
  requests: any;
  source: any;
  route: any;
  search: any;
  selection: any;
  composer: any;
  bridge: any;
  prompt: any;
  model: any;
  message: any;
}

export type MagnusActions = Record<string, any>;
