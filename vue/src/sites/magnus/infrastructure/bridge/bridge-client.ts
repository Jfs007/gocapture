import type { RuntimeEvent } from '../../domain/bridge/bridge-event.types';

export type RuntimeEventListener = (event: RuntimeEvent) => void | Promise<void>;

export interface BridgeClient {
  connect(): void;
  disconnect(): void;
  sendCommand(type: string, payload?: Record<string, unknown>): void;
  onEvent(listener: RuntimeEventListener): () => void;
}
