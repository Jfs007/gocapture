declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

interface Window {
  __MAGNUS_SIDE_PANEL__?: import('./app/types/bridge-event.types').SidePanelBridgeConfig;
  __MAGNUS_DEV_ASSISTANT__?: {
    destroy?: () => void;
    [key: string]: unknown;
  } | null;
  __MAGNUS_SELECTIONS__?: unknown[];
  __MAGNUS_LAST_ELEMENT__?: unknown;
  __MAGNUS_LAST_ELEMENT_INFO__?: unknown;
  showDirectoryPicker?: (options?: Record<string, unknown>) => Promise<any>;
}
