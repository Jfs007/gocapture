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
  const normalizedName = adapter.name === 'Exec 模型' ? 'Cli 模型' : adapter.name;
  return {
    id: String(adapter.id || ''),
    name: String(normalizedName || (type === 'api' ? 'API 模型' : 'Cli 模型')),
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
  const instructions = new Map(
    (searchPayload.selectionInstructions || [])
      .map(item => [Number(item?.index || 0), String(item?.instruction || '')])
      .filter(item => item[0] > 0 && item[1])
  );
  return (searchPayload.selections || []).map(item => {
    const info = item.element || {};
    const asset = item.asset || {};
    return {
      index: item.index,
      token: item.token || `@选区${item.index}`,
      instruction: instructions.get(Number(item.index || 0)) || '',
      thumbnailCaptured: !!item.thumbnailCaptured,
      tag: info.tag,
      selector: info.selector,
      className: info.className,
      text: compact(info.text, 400),
      inlineStyle: compact(info.inlineStyle, 260),
      computedStyle: info.computedStyle || {},
      box: info.box || null,
      innerHtml: compact(info.innerHtml, 560),
      assetTag: asset.tag,
      assetSelector: asset.selector,
      assetClassName: asset.className,
      assetText: compact(asset.text, 260),
      assetInlineStyle: compact(asset.inlineStyle, 260),
      assetComputedStyle: asset.computedStyle || {},
      assetBox: asset.box || null,
      assetInnerHtml: compact(asset.innerHtml, 560),
      ancestors: (info.ancestors || []).slice(0, 4).map(ancestor => ({
        tag: ancestor.tag,
        className: ancestor.className,
        text: compact(ancestor.text, 220),
      })),
    };
  });
}

function apiReferenceSummary(candidateHits) {
  return (candidateHits || [])
    .filter(hit => hit && hit.file && hit.apiEvidence)
    .slice(0, 8)
    .map(hit => ({
      file: hit.file,
      stages: hit.stages || [hit.stage].filter(Boolean),
      from: hit.apiEvidenceFrom || [],
      reasons: (hit.apiEvidenceReasons || []).slice(0, 6),
    }));
}

function selectionTextReferences(searchPayload) {
  const instructions = new Map(
    (searchPayload.selectionInstructions || [])
      .map(item => [Number(item?.index || 0), String(item?.instruction || '')])
      .filter(item => item[0] > 0 && item[1])
  );
  return (searchPayload?.selectionTexts || searchPayload?.selections || [])
    .map(item => {
      const info = item.element || item;
      return {
        index: item.index,
        token: item.token || `@选区${item.index}`,
        text: compact(info.text, 240),
        selector: info.selector || '',
        className: info.className || '',
        instruction: instructions.get(Number(item.index || 0)) || '',
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
    stages: hit.stages,
    from: hit.from,
    routePath: hit.routePath,
    apiEvidence: hit.apiEvidence,
    apiEvidenceFrom: hit.apiEvidenceFrom,
    apiEvidenceReasons: hit.apiEvidenceReasons,
    exactMatchLabel: hit.exactMatchLabel,
    exactMatchText: hit.exactMatchText,
    exactMatchCount: hit.exactMatchCount,
    contextScore: hit.contextScore,
    contextReasons: hit.contextReasons,
    preciseEvidence: hit.preciseEvidence,
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
    '- 不要只看最高分；优先相信文件内唯一精确命中的页面文案、用户补充证据、修改要求。',
    '- 但“某个文件里只出现 1 次文案”不等于精准命中；如果它缺少当前选区的 className、父级文案、修改要求等同文件上下文，不要因为 unique 就优先它。',
    '- 必须结合每个选区对应的“修改要求”判断修改位置；如果候选文件和修改要求无关，不要推荐。',
    '- 页面路由命中文件是入口线索；如果入口只是容器/布局，再结合 import 链和选区证据判断具体组件。',
    '- 如果 A 页面文件和它 import 的 B 组件都出现相同文案，而 B 只是“唯一出现一次”但没有当前选区上下文，优先保守地选择 A，除非 B 有更强的同文件证据。',
    '- 接口端点只作为辅助，不能覆盖页面文案和路由上下文。',
    '- 但如果两个文件都命中了相同页面文案，而只有 A 具备当前页面相关的接口线索（接口定义、接口调用、接口上游引用）而 B 没有，要把接口链路作为 A 的额外佐证。',
    '- 尤其当页面最近捕获到接口请求，且 A 与这些接口存在引用关系、B 完全没有接口关联时，应优先怀疑 A 才是当前页面字段所在文件。',
    '- @选区N 后面的自然语言就是该选区的修改要求；如果没有编号，则视为对所有选区生效。',
    '- 选区文本是重要参考，但只能作为辅助证据；必须结合 className、父级文案、路由、接口线索和候选文件内容一起判断。',
    '- 你的“提示词”必须只描述已被证据确认的修改目标，不要猜测需要新引入的 http 工具、请求封装、路径别名、公共方法、变量名或导入路径；若只是需要复用现有方式，只写“沿用项目现有实现方式”。',
    '- "code片段" 必须直接摘自候选文件内容，尽量短，足够定位即可。',
    '- 返回必须是 JSON 数组，不要输出 Markdown；找不到就返回 []。',
    '',
    '返回格式必须严格为：',
    '[',
    '  {',
    '    "path": "相对项目根路径",',
    '    "code片段": "用于定位的源码片段，尽量短，必须来自该文件内容",',
    '    "提示词": "结合选区对应的修改要求，只描述已确认事实：在哪个文件、哪个位置需要做什么调整；不要猜测 import、http 工具或封装"',
    '  }',
    ']',
    '',
    `项目根: ${project.path}`,
    `项目类型: ${project.kind || 'unknown'}；技术栈: ${project.stackText || '-'}`,
    `当前 URL: ${payload.url || body.url || '-'}`,
    `页面路径: ${body.pagePath || body.routeResolver?.pagePath || '-'}`,
    `用户修改要求: ${payload.userPrompt || '-'}`,
    '',
    `选区与改动:\n${safeJson(selectionSummary(payload))}`,
    '',
    `按选区拆分后的修改要求:\n${safeJson(payload.selectionInstructions || [])}`,
    '',
    `选区文本参考(仅作参考):\n${safeJson(selectionTextReferences(payload))}`,
    '',
    `本地路由解析结果:\n${safeJson(body.routeResolver || null)}`,
    '',
    `本地候选文件:\n${safeJson(candidateFacts)}`,
    '',
    `接口线索:\n${safeJson(payload.apiRequests || [])}`,
    '',
    `候选文件接口关联:\n${safeJson(apiReferenceSummary(body.candidateHits || []))}`,
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
      'code片段': item['code片段'] || item['位置'] || item.codeSnippet || item.location || item.snippet || '',
      '提示词': item['提示词'] || item.prompt || item.reason || parsed.summary || '',
      confidence: item.confidence,
    }));
  }
  return [];
}

function validateModelItems(project, parsed) {
  return modelOutputItems(parsed).map(item => {
    const file = String(item.path || item.file || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const codeSnippet = String(item['code片段'] || item['位置'] || item.codeSnippet || item.location || item.snippet || item.code || '').trim();
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
  if (!parts.length) throw new Error('Cli 模型缺少 command，例如：codex exec');
  const [command, ...args] = parts;
  const env = { ...process.env };
  if (adapter.proxyUrl) {
    env.HTTP_PROXY = adapter.proxyUrl;
    env.HTTPS_PROXY = adapter.proxyUrl;
    env.ALL_PROXY = adapter.proxyUrl;
  }
  appendLog(logs, `Cli 模型启动：${command}${args.length ? ` ${args.join(' ')}` : ''}`);
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
      appendLog(logs, `Cli 模型结束：退出码 ${code}，耗时 ${Date.now() - startedAt}ms，stdout ${stdout.length} 字符，stderr ${stderr.length} 字符`);
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
    appendLog(logs, '缩略图说明：当前模型定位不会发送图片字节，只会发送截图区域节点的结构化信息，例如 selector、盒模型、HTML 和样式摘要。');
    appendLog(logs, `提示词长度：${prompt.length} 字符`);
    appendLog(logs, `模型定位提示词:\n${prompt}`);
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
