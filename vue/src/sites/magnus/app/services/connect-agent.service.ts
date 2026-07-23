import { sourceServerJson, sourceServerNdjson } from './source-service';

export type ConnectAgentState =
  | 'disconnected'
  | 'checking'
  | 'connecting'
  | 'connected'
  | 'login-required'
  | 'unavailable'
  | 'error';

export interface ConnectAgentProvider {
  id: string;
  name: string;
  category: 'connection';
  state: ConnectAgentState;
  connected: boolean;
  installed: boolean;
  authenticated: boolean;
  version: string;
  executable: string;
  message: string;
  error: string;
  activeTaskCount?: number;
}

export interface ConnectAgentTask {
  taskId: string;
  threadId: string;
  turnId: string;
  status: string;
  startedAt: number;
  finishedAt: number;
  finalResponse: string;
  changedFiles: string[];
  error: string;
}

export async function listConnectAgents(refresh = false): Promise<ConnectAgentProvider[]> {
  const data = await sourceServerJson(`/api/connect-agents${refresh ? '?refresh=1' : ''}`, {
    timeoutMs: refresh ? 12000 : 5000,
    timeoutMessage: '检查 Agent 连接状态超时'
  });
  return Array.isArray(data?.providers) ? data.providers : [];
}

export async function connectAgent(providerId: string): Promise<ConnectAgentProvider> {
  const data = await sourceServerJson(`/api/connect-agents/${encodeURIComponent(providerId)}/connect`, {
    method: 'POST',
    body: {},
    timeoutMs: 15000,
    timeoutMessage: '连接 Agent 超时'
  });
  return data.provider;
}

export async function disconnectAgent(providerId: string): Promise<ConnectAgentProvider> {
  const data = await sourceServerJson(`/api/connect-agents/${encodeURIComponent(providerId)}/disconnect`, {
    method: 'POST',
    body: {},
    timeoutMs: 5000,
    timeoutMessage: '断开 Agent 连接超时'
  });
  return data.provider;
}

export async function runConnectAgentTask(
  providerId: string,
  input: Record<string, unknown>,
  options: {
    controller: AbortController;
    onEvent: (event: any) => void;
  }
): Promise<ConnectAgentTask> {
  return await sourceServerNdjson(
    `/api/connect-agents/${encodeURIComponent(providerId)}/tasks/stream`,
    {
      method: 'POST',
      body: input,
      controller: options.controller,
      onEvent: options.onEvent,
      timeoutMs: 30 * 60 * 1000,
      timeoutMessage: 'Codex 开发任务执行超时',
      abortMessage: 'Codex 开发任务已取消'
    }
  );
}
