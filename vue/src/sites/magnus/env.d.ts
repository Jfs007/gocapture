declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare const __PRODUCT_DISPLAY_NAME__: string;
declare const __PRODUCT_CLI_COMMAND__: string;

interface Window {
  __MAGNUS_SIDE_PANEL__?: import('./app/types/bridge-event.types').SidePanelBridgeConfig;
  __MAGNUS_DEV_ASSISTANT__?: {
    destroy?: () => void;
    [key: string]: unknown;
  } | null;
  showDirectoryPicker?: (options?: Record<string, unknown>) => Promise<any>;
}
