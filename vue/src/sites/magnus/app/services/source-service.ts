export const SOURCE_SERVER_URL = 'http://127.0.0.1:17321';
export const MAGNUS_INTERNAL_REQUEST_HEADER = 'X-Magnus-Internal';
export const MAGNUS_INTERNAL_REQUEST_VALUE = 'source-server';

interface SourceServerOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  timeoutMessage?: string;
  abortMessage?: string;
  controller?: AbortController;
  onEvent?: (event: any) => void;
}

interface SourceServerError extends Error {
  payload?: unknown;
}

function createSourceServerHeaders(extraHeaders?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    [MAGNUS_INTERNAL_REQUEST_HEADER]: MAGNUS_INTERNAL_REQUEST_VALUE,
    ...(extraHeaders || {})
  };
}

export async function sourceServerJson(pathname: string, options: SourceServerOptions = {}) {
  const timeoutMs = Number(options.timeoutMs || 10000);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${SOURCE_SERVER_URL}${pathname}`, {
      method: options.method || 'GET',
      headers: createSourceServerHeaders(options.headers),
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      const error = new Error(data.error || `本地源码服务请求失败：${response.status}`) as SourceServerError;
      error.payload = data;
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error && error.name === 'AbortError') {
      throw new Error(options.timeoutMessage || `本地源码服务 ${timeoutMs / 1000} 秒未响应`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function sourceServerNdjson(pathname: string, options: SourceServerOptions = {}) {
  const timeoutMs = Number(options.timeoutMs || 10000);
  const controller = options.controller || new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${SOURCE_SERVER_URL}${pathname}`, {
      method: options.method || 'GET',
      headers: createSourceServerHeaders(options.headers),
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `本地源码服务请求失败：${response.status}`);
    }
    if (!response.body) return null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const event = JSON.parse(trimmed);
        if (typeof options.onEvent === 'function') options.onEvent(event);
        if (event.type === 'result') result = event.result || null;
        if (event.type === 'error') {
          const error = new Error(event.error || '本地源码服务请求失败') as SourceServerError;
          error.payload = event;
          throw error;
        }
      }
    }

    const finalLine = buffer.trim();
    if (finalLine) {
      const event = JSON.parse(finalLine);
      if (typeof options.onEvent === 'function') options.onEvent(event);
      if (event.type === 'result') result = event.result || null;
      if (event.type === 'error') {
        const error = new Error(event.error || '本地源码服务请求失败') as SourceServerError;
        error.payload = event;
        throw error;
      }
    }

    return result;
  } catch (error: any) {
    if (error && error.name === 'AbortError') {
      const abortError = new Error(timedOut
        ? (options.timeoutMessage || `本地源码服务 ${timeoutMs / 1000} 秒未响应`)
        : (options.abortMessage || '请求已停止'));
      abortError.name = timedOut ? 'TimeoutError' : 'AbortError';
      throw abortError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function normalizeSourceServerProject(raw: any) {
  const files = Array.isArray(raw.files) ? raw.files : [];
  return {
    name: raw.name || '本地项目',
    path: raw.path || '',
    kind: raw.kind || 'unknown',
    source: 'source-server',
    fileCount: raw.fileCount || files.length,
    files,
    snippets: raw.snippets || {},
    context: raw.context || null,
    stack: raw.stack || [],
    stackText: raw.stackText || '',
    limited: !!raw.limited
  };
}
