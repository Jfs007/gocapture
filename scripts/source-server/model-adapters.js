const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');
const tls = require('tls');
const { isTextFile, readProjectText } = require('./fs-utils');

const MAX_MODEL_FILES = 8;
const MAX_FILE_CHARS = 18000;
const MAX_TOTAL_FILE_CHARS = 64000;
const DEFAULT_TIMEOUT_MS = 120000;

function splitCommandLine(value) {
  const input = String(value || '').trim();
  const result = [];
  let token = '';
  let quote = '';
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = '';
      else token += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (token) {
        result.push(token);
        token = '';
      }
      continue;
    }
    token += char;
  }
  if (token) result.push(token);
  return result;
}

function normalizeAdapter(raw) {
  const adapter = raw && typeof raw === 'object' ? raw : {};
  const type = adapter.type === 'api' ? 'api' : 'exec';
  return {
    id: String(adapter.id || ''),
    name: String(adapter.name || (type === 'api' ? 'API 模型' : 'Exec 模型')),
    type,
    command: String(adapter.command || ''),
    endpoint: String(adapter.endpoint || ''),
    apiKey: String(adapter.apiKey || ''),
    model: String(adapter.model || ''),
    proxyUrl: String(adapter.proxyUrl || ''),
    timeoutMs: Math.max(5000, Math.min(Number(adapter.timeoutMs || DEFAULT_TIMEOUT_MS), 300000)),
  };
}

function compact(value, limit = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function safeJson(value) {
  return JSON.stringify(value || null, null, 2);
}

function appendLog(logs, text) {
  if (Array.isArray(logs) && text) logs.push(text);
}

function safeUrlLabel(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch (error) {
    return String(value || '-');
  }
}

function normalizeProxyUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  const url = new URL(withProtocol);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('代理地址只支持 http:// 或 https://');
  }
  return url;
}

function proxyAuthHeader(proxyUrl) {
  if (!proxyUrl || (!proxyUrl.username && !proxyUrl.password)) return '';
  const username = decodeURIComponent(proxyUrl.username || '');
  const password = decodeURIComponent(proxyUrl.password || '');
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function projectFile(project, filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return (project.files || []).find(file => file.path === normalized);
}

function fileContentBlock(project, filePath, textCache, remainingChars) {
  const file = projectFile(project, filePath);
  if (!file || !isTextFile(file.path) || remainingChars <= 0) return null;
  let text = readProjectText(project, file, textCache || new Map());
  if (text.length > Math.min(MAX_FILE_CHARS, remainingChars)) {
    text = `${text.slice(0, Math.min(MAX_FILE_CHARS, remainingChars))}\n...<truncated>`;
  }
  return {
    file: file.path,
    text,
  };
}

function collectModelFiles(project, body, textCache, logs) {
  const files = [];
  const seen = new Set();
  const add = filePath => {
    const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || seen.has(normalized)) return;
    if (!projectFile(project, normalized)) return;
    seen.add(normalized);
    files.push(normalized);
  };

  for (const item of body.candidateHits || []) add(item.file);
  for (const item of body.selectedCandidateHits || []) add(item.file);
  for (const item of body.routeResolver?.hits || []) add(item.file);
  for (const item of body.extraFiles || []) add(item);

  let remaining = MAX_TOTAL_FILE_CHARS;
  const blocks = [];
  for (const file of files.slice(0, MAX_MODEL_FILES)) {
    const block = fileContentBlock(project, file, textCache, remaining);
    if (!block) continue;
    blocks.push(block);
    appendLog(logs, `读取候选文件：${block.file}（${block.text.length} 字符）`);
    remaining -= block.text.length;
    if (remaining <= 0) break;
  }
  appendLog(logs, `候选文件内容：纳入 ${blocks.length}/${files.length} 个文件，字符上限 ${MAX_TOTAL_FILE_CHARS}`);
  return blocks;
}

function selectionSummary(searchPayload) {
  return (searchPayload.selections || []).map(item => {
    const info = item.element || {};
    return {
      index: item.index,
      changeNote: item.changeNote,
      tag: info.tag,
      className: info.className,
      text: compact(info.text, 400),
      ancestors: (info.ancestors || []).slice(0, 4).map(ancestor => ({
        tag: ancestor.tag,
        className: ancestor.className,
        text: compact(ancestor.text, 220),
      })),
    };
  });
}

function buildModelPrompt(project, body, textCache, logs) {
  const payload = body.searchPayload || {};
  const files = collectModelFiles(project, body, textCache, logs);
  const candidateFacts = (body.candidateHits || []).slice(0, 12).map(hit => ({
    file: hit.file,
    score: hit.score,
    stage: hit.stage,
    from: hit.from,
    routePath: hit.routePath,
    uniqueMatchLabel: hit.uniqueMatchLabel,
    uniqueMatchText: hit.uniqueMatchText,
    uniqueMatchCount: hit.uniqueMatchCount,
    reasons: (hit.reasons || []).slice(0, 8),
    importChain: hit.importChain,
  }));

  return [
    '你是本地源码定位 agent。你的任务是在本地预检索结果基础上，进一步判断最应该修改的源码文件。',
    '',
    '重要规则：',
    '- 不要只看最高分；优先相信文件内唯一精确命中的页面文案、用户补充证据、改动点。',
    '- 必须结合每个选区的 changeNote 判断修改位置；如果候选文件和改动点无关，不要推荐。',
    '- 页面路由命中文件是入口线索；如果入口只是容器/布局，再结合 import 链和选区证据判断具体组件。',
    '- 接口端点只作为辅助，不能覆盖页面文案和路由上下文。',
    '- 返回必须是 JSON 数组，不要输出 Markdown；找不到就返回 []。',
    '',
    '返回格式必须严格为：',
    '[',
    '  {',
    '    "path": "相对项目根路径",',
    '    "code片段": "用于定位的源码片段，尽量短，必须来自该文件内容",',
    '    "提示词": "结合选取的改动点，说明在哪个文件、哪个位置需要做什么调整"',
    '  }',
    ']',
    '',
    `项目根: ${project.path}`,
    `项目类型: ${project.kind || 'unknown'}；技术栈: ${project.stackText || '-'}`,
    `当前 URL: ${payload.url || body.url || '-'}`,
    `页面路径: ${body.pagePath || body.routeResolver?.pagePath || '-'}`,
    '',
    `选区与改动:\n${safeJson(selectionSummary(payload))}`,
    '',
    `本地路由解析结果:\n${safeJson(body.routeResolver || null)}`,
    '',
    `本地候选文件:\n${safeJson(candidateFacts)}`,
    '',
    `接口线索:\n${safeJson(payload.apiRequests || [])}`,
    '',
    '候选文件内容：',
    files.map(file => [
      `--- FILE: ${file.file} ---`,
      file.text,
      `--- END FILE: ${file.file} ---`,
    ].join('\n')).join('\n\n') || '-',
  ].join('\n');
}

function parseModelJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (error) {
    }
  }
  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
    } catch (error) {
    }
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (error) {
    }
  }
  return null;
}

function modelOutputItems(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed?.edits)) return parsed.edits;
  if (Array.isArray(parsed?.results)) return parsed.results;
  if (Array.isArray(parsed?.targetFiles)) {
    return parsed.targetFiles.map(item => ({
      path: item.path || item.file,
      'code片段': item['code片段'] || item.codeSnippet || item.snippet || '',
      '提示词': item['提示词'] || item.prompt || item.reason || parsed.summary || '',
      confidence: item.confidence,
    }));
  }
  return [];
}

function validateModelItems(project, parsed) {
  return modelOutputItems(parsed).map(item => {
    const file = String(item.path || item.file || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const codeSnippet = String(item['code片段'] || item.codeSnippet || item.snippet || item.code || '').trim();
    const prompt = String(item['提示词'] || item.prompt || item.instruction || item.reason || '').trim();
    return {
      path: file,
      file,
      confidence: Math.max(0, Math.min(Number(item.confidence || 0), 100)),
      codeSnippet,
      prompt,
      reason: prompt || codeSnippet,
      exists: !!projectFile(project, file),
    };
  }).filter(item => item.file);
}

function runExecAdapter(adapter, prompt, cwd, logs) {
  const parts = splitCommandLine(adapter.command);
  if (!parts.length) throw new Error('Exec 模型缺少 command，例如：codex exec');
  const [command, ...args] = parts;
  const env = { ...process.env };
  if (adapter.proxyUrl) {
    env.HTTP_PROXY = adapter.proxyUrl;
    env.HTTPS_PROXY = adapter.proxyUrl;
    env.ALL_PROXY = adapter.proxyUrl;
  }
  appendLog(logs, `Exec 模型启动：${command}${args.length ? ` ${args.join(' ')}` : ''}`);
  appendLog(logs, `执行目录：${cwd}`);
  appendLog(logs, adapter.proxyUrl ? `代理：已写入环境变量 ${safeUrlLabel(adapter.proxyUrl)}` : '代理：未启用');
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`模型执行超过 ${Math.round(adapter.timeoutMs / 1000)} 秒`));
    }, adapter.timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      appendLog(logs, `Exec 模型结束：退出码 ${code}，耗时 ${Date.now() - startedAt}ms，stdout ${stdout.length} 字符，stderr ${stderr.length} 字符`);
      if (code !== 0) {
        reject(new Error(stderr || `模型命令退出码 ${code}`));
        return;
      }
      resolve(stdout || stderr);
    });
    child.stdin.end(prompt);
  });
}

function requestTextDirect(targetUrl, options) {
  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;
  return requestTextWithClient(client, {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    method: options.method,
    path: `${url.pathname}${url.search}`,
    headers: options.headers,
    timeoutMs: options.timeoutMs,
    body: options.body,
  });
}

function requestTextHttpProxy(targetUrl, proxyUrl, options) {
  const url = new URL(targetUrl);
  const proxyClient = proxyUrl.protocol === 'https:' ? https : http;
  const headers = {
    ...options.headers,
    Host: url.host,
  };
  const auth = proxyAuthHeader(proxyUrl);
  if (auth) headers['Proxy-Authorization'] = auth;
  return requestTextWithClient(proxyClient, {
    protocol: proxyUrl.protocol,
    hostname: proxyUrl.hostname,
    port: proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80),
    method: options.method,
    path: url.href,
    headers,
    timeoutMs: options.timeoutMs,
    body: options.body,
  });
}

function createHttpsProxyAgent(proxyUrl, targetUrl, timeoutMs) {
  const proxyClient = proxyUrl.protocol === 'https:' ? https : http;
  const targetPort = targetUrl.port || 443;
  return new https.Agent({
    keepAlive: false,
    createConnection(options, callback) {
      let settled = false;
      const done = (error, socket) => {
        if (settled) return;
        settled = true;
        callback(error, socket);
      };
      const headers = {
        Host: `${targetUrl.hostname}:${targetPort}`,
      };
      const auth = proxyAuthHeader(proxyUrl);
      if (auth) headers['Proxy-Authorization'] = auth;
      const connectReq = proxyClient.request({
        hostname: proxyUrl.hostname,
        port: proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80),
        method: 'CONNECT',
        path: `${targetUrl.hostname}:${targetPort}`,
        headers,
      });
      connectReq.setTimeout(timeoutMs, () => {
        connectReq.destroy(new Error('代理连接超时'));
      });
      connectReq.on('connect', (res, socket) => {
        if (res.statusCode !== 200) {
          socket.destroy();
          done(new Error(`代理 CONNECT 失败：HTTP ${res.statusCode}`));
          return;
        }
        const secureSocket = tls.connect({
          socket,
          servername: targetUrl.hostname,
        }, () => done(null, secureSocket));
        secureSocket.once('error', error => done(error));
      });
      connectReq.once('error', error => done(error));
      connectReq.end();
    },
  });
}

function requestTextHttpsProxy(targetUrl, proxyUrl, options) {
  const url = new URL(targetUrl);
  const agent = createHttpsProxyAgent(proxyUrl, url, options.timeoutMs);
  return requestTextWithClient(https, {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || 443,
    method: options.method,
    path: `${url.pathname}${url.search}`,
    headers: options.headers,
    timeoutMs: options.timeoutMs,
    body: options.body,
    agent,
  });
}

function requestTextWithClient(client, options) {
  return new Promise((resolve, reject) => {
    const req = client.request({
      protocol: options.protocol,
      hostname: options.hostname,
      port: options.port,
      method: options.method,
      path: options.path,
      headers: options.headers,
      agent: options.agent,
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        text += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode || 0,
          statusMessage: response.statusMessage || '',
          headers: response.headers,
          text,
        });
      });
    });
    req.setTimeout(options.timeoutMs, () => {
      req.destroy(new Error(`API 模型请求超过 ${Math.round(options.timeoutMs / 1000)} 秒`));
    });
    req.once('error', reject);
    req.end(options.body);
  });
}

function requestApiText(endpoint, options) {
  const proxyUrl = normalizeProxyUrl(options.proxyUrl);
  if (!proxyUrl) return requestTextDirect(endpoint, options);
  const targetUrl = new URL(endpoint);
  if (targetUrl.protocol === 'https:') {
    return requestTextHttpsProxy(endpoint, proxyUrl, options);
  }
  return requestTextHttpProxy(endpoint, proxyUrl, options);
}

async function runApiAdapter(adapter, prompt, logs) {
  if (!adapter.endpoint) throw new Error('API 模型缺少 endpoint');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (adapter.apiKey) headers.Authorization = `Bearer ${adapter.apiKey}`;
  const body = {
    model: adapter.model || undefined,
    temperature: 0,
    messages: [
      { role: 'system', content: '你是严谨的本地源码定位 agent，只返回 JSON。' },
      { role: 'user', content: prompt },
    ],
  };
  appendLog(logs, `API 模型请求：${safeUrlLabel(adapter.endpoint)}；模型 ${adapter.model || '-'}`);
  appendLog(logs, adapter.proxyUrl ? `代理：${safeUrlLabel(adapter.proxyUrl)}` : '代理：未启用');
  const startedAt = Date.now();
  const response = await requestApiText(adapter.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeoutMs: adapter.timeoutMs,
    proxyUrl: adapter.proxyUrl,
  });
  appendLog(logs, `API 模型响应：HTTP ${response.statusCode}，耗时 ${Date.now() - startedAt}ms，响应 ${response.text.length} 字符`);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(response.text || `API 模型请求失败：${response.statusCode}`);
  }
  try {
    const data = JSON.parse(response.text);
    return data.choices?.[0]?.message?.content || data.output_text || data.text || response.text;
  } catch (error) {
    return response.text;
  }
}

async function runModelLocate(project, body, textCache = new Map()) {
  if (!project) throw new Error('No project selected.');
  const logs = [];
  try {
    const adapter = normalizeAdapter(body.adapter);
    appendLog(logs, `模型定位开始：${adapter.name}（${adapter.type}）`);
    appendLog(logs, `本地预检索：候选 ${Array.isArray(body.candidateHits) ? body.candidateHits.length : 0} 个，已选 ${Array.isArray(body.selectedCandidateHits) ? body.selectedCandidateHits.length : 0} 个`);
    const prompt = buildModelPrompt(project, body, textCache, logs);
    appendLog(logs, `提示词长度：${prompt.length} 字符`);
    const rawText = adapter.type === 'api'
      ? await runApiAdapter(adapter, prompt, logs)
      : await runExecAdapter(adapter, prompt, project.path, logs);
    appendLog(logs, `模型原始输出：${rawText.length} 字符`);
    const parsed = parseModelJson(rawText);
    appendLog(logs, parsed ? '模型 JSON 解析成功' : '模型 JSON 解析失败');
    const modelItems = validateModelItems(project, parsed);
    appendLog(logs, `模型推荐文件：${modelItems.length} 个`);
    return {
      adapter: {
        id: adapter.id,
        name: adapter.name,
        type: adapter.type,
      },
      rawText,
      parsed,
      modelItems,
      targetFiles: modelItems.map(item => ({
        file: item.file,
        confidence: item.confidence,
        reason: item.reason,
        exists: item.exists,
      })),
      logs,
    };
  } catch (error) {
    appendLog(logs, `模型定位失败：${error.message || error}`);
    error.modelLogs = logs;
    throw error;
  }
}

module.exports = {
  buildModelPrompt,
  runModelLocate,
  splitCommandLine,
};
