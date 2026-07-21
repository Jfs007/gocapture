'use strict';

const http = require('http');
const https = require('https');
const tls = require('tls');
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS = 120000;

function appendLog(logs, text) {
  if (!Array.isArray(logs)) return;
  logs.push(String(text || ''));
  if (typeof logs.onAppend === 'function') logs.onAppend(String(text || ''));
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new Error('模型请求已停止');
}

function normalizeAdapter(raw) {
  const adapter = raw && typeof raw === 'object' ? raw : {};
  if (adapter.type && adapter.type !== 'api') {
    throw new Error('非 API 模型已下线，请配置 API 模型。');
  }
  return {
    id: String(adapter.id || ''),
    name: String(adapter.name || 'API 模型'),
    type: 'api',
    endpoint: String(adapter.endpoint || ''),
    apiKey: String(adapter.apiKey || ''),
    model: String(adapter.model || ''),
    proxyUrl: String(adapter.proxyUrl || ''),
    timeoutMs: Math.max(5000, Math.min(Number(adapter.timeoutMs || DEFAULT_TIMEOUT_MS), 300000)),
  };
}

function responseTextFromChatCompletion(payload) {
  if (typeof payload === 'string') return payload;
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  if (!choice) return '';
  if (typeof choice.text === 'string') return choice.text;
  const content = choice.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(item => item?.text || item?.content || '').filter(Boolean).join('\n');
  }
  return '';
}

function toolCallsFromChatCompletion(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const calls = choice?.message?.tool_calls || choice?.message?.toolCalls || [];
  if (!Array.isArray(calls)) return [];
  return calls.map((call, index) => {
    const fn = call.function || {};
    let args = {};
    try {
      args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments || '{}') : (fn.arguments || call.args || {});
    } catch (error) {
      args = {};
    }
    return {
      id: String(call.id || `call_${index + 1}`),
      name: String(fn.name || call.name || ''),
      args: args && typeof args === 'object' ? args : {},
    };
  }).filter(call => call.name);
}

function decodeHttpBody(head, body) {
  if (/transfer-encoding:\s*chunked/i.test(head)) {
    let rest = body;
    let decoded = '';
    while (rest) {
      const lineEnd = rest.indexOf('\r\n');
      if (lineEnd < 0) break;
      const size = parseInt(rest.slice(0, lineEnd), 16);
      if (!Number.isFinite(size) || size < 0) break;
      if (size === 0) return decoded;
      const start = lineEnd + 2;
      decoded += rest.slice(start, start + size);
      rest = rest.slice(start + size + 2);
    }
    return decoded || body;
  }
  return body;
}

function requestJsonHttpsViaHttpProxy(endpoint, payload, adapter, signal, proxyUrl) {
  return new Promise((resolve, reject) => {
    const target = new URL(endpoint);
    const proxy = new URL(proxyUrl);
    const body = JSON.stringify(payload);
    const headerText = [
      `POST ${target.pathname}${target.search} HTTP/1.1`,
      `Host: ${target.host}`,
      'Content-Type: application/json',
      `Content-Length: ${Buffer.byteLength(body)}`,
      adapter.apiKey ? `Authorization: Bearer ${adapter.apiKey}` : '',
      'Connection: close',
    ].filter(Boolean).join('\r\n');
    const connectReq = http.request({
      method: 'CONNECT',
      hostname: proxy.hostname,
      port: proxy.port || 80,
      path: `${target.hostname}:${target.port || 443}`,
      timeout: adapter.timeoutMs,
    });
    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`代理 CONNECT 失败：HTTP ${res.statusCode}`));
        return;
      }
      const secureSocket = tls.connect({ socket, servername: target.hostname });
      const chunks = [];
      secureSocket.setTimeout(adapter.timeoutMs);
      secureSocket.on('secureConnect', () => secureSocket.write(`${headerText}\r\n\r\n${body}`));
      secureSocket.on('data', chunk => chunks.push(chunk));
      secureSocket.on('timeout', () => secureSocket.destroy(new Error(`API 请求超时 ${adapter.timeoutMs}ms`)));
      secureSocket.on('error', reject);
      secureSocket.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const splitAt = raw.indexOf('\r\n\r\n');
        const head = splitAt >= 0 ? raw.slice(0, splitAt) : '';
        const text = decodeHttpBody(head, splitAt >= 0 ? raw.slice(splitAt + 4) : raw);
        const status = Number((head.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/) || [])[1] || 0);
        if (status < 200 || status >= 300) {
          reject(new Error(`API HTTP ${status || '-'}: ${text.slice(0, 800)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`API 返回不是 JSON: ${text.slice(0, 800)}`));
        }
      });
    });
    connectReq.on('timeout', () => connectReq.destroy(new Error(`代理 CONNECT 超时 ${adapter.timeoutMs}ms`)));
    connectReq.on('error', reject);
    if (signal) {
      signal.addEventListener('abort', () => connectReq.destroy(new Error('模型请求已停止')), { once: true });
    }
    connectReq.end();
  });
}

function requestJson(endpoint, payload, adapter, signal, proxyUrl) {
  return new Promise((resolve, reject) => {
    const target = new URL(endpoint);
    const body = JSON.stringify(payload);
    const headers = {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    };
    if (adapter.apiKey) headers.authorization = `Bearer ${adapter.apiKey}`;

    const useProxy = proxyUrl && target.protocol === 'http:';
    const requestUrl = useProxy ? new URL(proxyUrl) : target;
    const transport = requestUrl.protocol === 'https:' ? https : http;
    const requestOptions = useProxy
      ? {
          method: 'POST',
          hostname: requestUrl.hostname,
          port: requestUrl.port || (requestUrl.protocol === 'https:' ? 443 : 80),
          path: endpoint,
          headers,
          timeout: adapter.timeoutMs,
        }
      : {
          method: 'POST',
          hostname: target.hostname,
          port: target.port || (target.protocol === 'https:' ? 443 : 80),
          path: `${target.pathname}${target.search}`,
          headers,
          timeout: adapter.timeoutMs,
        };

    const req = transport.request(requestOptions, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`API HTTP ${res.statusCode}: ${text.slice(0, 800)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`API 返回不是 JSON: ${text.slice(0, 800)}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`API 请求超时 ${adapter.timeoutMs}ms`)));
    req.on('error', reject);
    if (signal) {
      signal.addEventListener('abort', () => req.destroy(new Error('模型请求已停止')), { once: true });
    }
    req.write(body);
    req.end();
  });
}

async function requestChatCompletion(adapter, payload, logs, signal) {
  throwIfAborted(signal);
  if (!adapter.endpoint) throw new Error('API 模型缺少 endpoint。');
  if (!adapter.model) throw new Error('API 模型缺少 model。');
  appendLog(logs, `API 模型请求：${adapter.endpoint}；模型 ${adapter.model}；请求体 ${JSON.stringify(payload).length} 字符（超时上限 ${Math.round(adapter.timeoutMs / 1000)}s）`);
  appendLog(logs, `代理：${adapter.proxyUrl ? `已配置 ${adapter.proxyUrl}` : '未启用'}`);
  const startedAt = Date.now();
  const endpoint = String(adapter.endpoint);
  const proxyUrl = String(adapter.proxyUrl || '');
  const data = proxyUrl.startsWith('http://') && endpoint.startsWith('https://')
    ? await requestJsonHttpsViaHttpProxy(endpoint, payload, adapter, signal, proxyUrl)
    : proxyUrl.startsWith('http://') && endpoint.startsWith('http://')
      ? await requestJson(endpoint, payload, adapter, signal, proxyUrl)
      : await requestJson(endpoint, payload, adapter, signal, null);
  const rawText = responseTextFromChatCompletion(data).trim();
  const toolCalls = toolCallsFromChatCompletion(data);
  appendLog(logs, `API 模型响应：HTTP 200，耗时 ${Date.now() - startedAt}ms，响应 ${rawText.length} 字符；tool_calls ${toolCalls.length} 个`);
  return { raw: data, rawText, toolCalls };
}

async function runChatCompletion(rawAdapter, input, options = {}) {
  const logs = [];
  if (typeof options.onLog === 'function') logs.onAppend = options.onLog;
  const adapter = normalizeAdapter(rawAdapter);
  const messages = Array.isArray(input?.messages) && input.messages.length
    ? input.messages
    : [{ role: 'user', content: String(input?.prompt || '') }];
  const payload = {
    model: adapter.model,
    messages,
    temperature: Number.isFinite(options.temperature) ? options.temperature : 0,
  };
  if (Array.isArray(input?.tools) && input.tools.length) {
    payload.tools = input.tools;
    payload.tool_choice = input.toolChoice || 'auto';
  }
  const result = await requestChatCompletion(adapter, payload, logs, options.signal);
  return {
    adapter: { id: adapter.id, name: adapter.name, type: adapter.type },
    ...result,
    logs,
  };
}

module.exports = {
  normalizeAdapter,
  requestChatCompletion,
  runChatCompletion,
  throwIfAborted,
};
