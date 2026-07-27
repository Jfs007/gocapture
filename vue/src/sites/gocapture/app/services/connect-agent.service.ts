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
  projectThreadId?: string;
  projectThreadName?: string;
  projectThreadSource?: 'project' | 'recent' | string;
  authModes?: string[];
  authMode?: string;
  authConfigured?: boolean;
  supportsProxy?: boolean;
  proxy?: string;
  supportsThreadBinding?: boolean;
  requiresThreadBinding?: boolean;
}

export interface ConnectAgentThread {
  id: string;
  name: string;
  preview: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  status: string;
}

export interface ConnectAgentThreadGroups {
  project: ConnectAgentThread[];
  recent: ConnectAgentThread[];
  projectlessStateAvailable: boolean;
}

export interface ConnectAgentAuth {
  mode: 'subscription' | 'apikey';
  apiKey?: string;
  oauthToken?: string;
  proxy?: string;
}

export interface ConnectAgentTask {
  taskId: string;
  threadId: string;
  turnId: string;
  status: string;
  startedAt: number;
  finishedAt: number;
  finalResponse: string;
  selectionLocations?: Array<{
    selectionId: string;
    locations: Array<{
      file: string;
      startLine: number;
      endLine: number;
      anchor: string;
    }>;
  }>;
  changedFiles: string[];
  error: string;
}

export interface ConnectAgentTimelineMessage {
  id: string;
  providerId: string;
  taskId: string;
  threadId: string;
  turnId: string;
  role: 'user' | 'agent' | 'system';
  kind: 'request' | 'event' | 'result' | 'error' | string;
  text: string;
  status: string;
  createdAt: string;
  metadata: Record<string, any>;
}

export async function listConnectAgentMessages(
  projectRoot: string,
  providerId = 'codex',
  limit = 500
): Promise<ConnectAgentTimelineMessage[]> {
  if (!projectRoot) return [];
  const query = new URLSearchParams({
    projectRoot,
    providerId,
    limit: String(limit)
  });
  const data = await sourceServerJson(`/api/connect-agents/messages?${query}`, {
    timeoutMs: 5000,
    timeoutMessage: '加载 Agent 对话历史超时'
  });
  return Array.isArray(data?.messages) ? data.messages : [];
}

export async function listConnectAgents(
  refresh = false,
  projectRoot = ''
): Promise<ConnectAgentProvider[]> {
  const query = new URLSearchParams();
  if (refresh) query.set('refresh', '1');
  if (projectRoot) query.set('projectRoot', projectRoot);
  const suffix = query.toString() ? `?${query}` : '';
  const data = await sourceServerJson(`/api/connect-agents${suffix}`, {
    timeoutMs: refresh ? 12000 : 5000,
    timeoutMessage: '检查 Agent 连接状态超时'
  });
  return Array.isArray(data?.providers) ? data.providers : [];
}

export async function connectAgent(
  providerId: string,
  auth?: ConnectAgentAuth
): Promise<ConnectAgentProvider> {
  const data = await sourceServerJson(`/api/connect-agents/${encodeURIComponent(providerId)}/connect`, {
    method: 'POST',
    body: auth ? { auth } : {},
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

export async function listConnectAgentThreads(
  providerId: string,
  projectRoot: string
): Promise<ConnectAgentThreadGroups> {
  const query = new URLSearchParams({ projectRoot });
  const data = await sourceServerJson(
    `/api/connect-agents/${encodeURIComponent(providerId)}/threads?${query}`,
    {
      timeoutMs: 15000,
      timeoutMessage: '加载 Agent 任务超时'
    }
  );
  return {
    project: Array.isArray(data?.threads?.project) ? data.threads.project : [],
    recent: Array.isArray(data?.threads?.recent) ? data.threads.recent : [],
    projectlessStateAvailable: !!data?.threads?.projectlessStateAvailable
  };
}

export async function bindConnectAgentThread(
  providerId: string,
  projectRoot: string,
  threadId: string
): Promise<{ threadId: string; threadName: string; source: string; updatedAt: string }> {
  const data = await sourceServerJson(
    `/api/connect-agents/${encodeURIComponent(providerId)}/bind-thread`,
    {
      method: 'POST',
      body: { projectRoot, threadId },
      timeoutMs: 15000,
      timeoutMessage: '绑定 Agent 任务超时'
    }
  );
  return data.session;
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
