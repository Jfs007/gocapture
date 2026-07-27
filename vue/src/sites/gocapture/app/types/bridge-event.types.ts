import type { RuntimeSelectionPayload } from './selection.types';
import type { PageRequest } from './page-request.types';

export type RuntimeEventType =
  | 'selection.changed'
  | 'page.route_changed'
  | 'page.context'
  | 'network.request'
  | 'runtime.connected';

export interface RuntimeEvent<TPayload = unknown> {
  type: RuntimeEventType;
  payload: TPayload;
}

export interface SelectionChangedPayload {
  selections?: RuntimeSelectionPayload[];
  selection?: RuntimeSelectionPayload;
}

export interface PageRouteChangedPayload {
  url?: string;
}

export interface PageContextPayload {
  url?: string;
  title?: string;
  route?: string;
  project?: {
    projectId?: string;
    tenantId?: string;
    appId?: string;
  };
}

export interface RuntimeConnectedPayload {
  page?: {
    url?: string;
    title?: string;
  };
}

export type NetworkRequestPayload = PageRequest;

export interface SidePanelBridgeConfig {
  panelTicket?: string;
  bridgeUrl?: string;
  sourceServerUrl?: string;
  snapshot?: {
    page?: {
      url?: string;
      title?: string;
    };
    selections?: RuntimeSelectionPayload[];
  };
}
