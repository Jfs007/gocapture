declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

interface Window {
  __MAGNUS_SIDE_PANEL__?: import('./domain/bridge/bridge-event.types').SidePanelBridgeConfig;
  __MAGNUS_DEV_ASSISTANT__?: {
    destroy?: () => void;
    [key: string]: unknown;
  } | null;
}
