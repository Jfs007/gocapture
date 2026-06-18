const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');
const tls = require('tls');
const { isTextFile, readProjectText } = require('../core/fs-utils');
const { tokenize, uniq } = require('../utils');

const MAX_MODEL_FILES = 12;
const MAX_FILE_CHARS = 18000;
const MAX_TOTAL_FILE_CHARS = 64000;
const MAX_FOCUSED_FILE_CHARS = 5200;
const MAX_MODEL_BATCH_FILE_CHARS = 30000;
const MAX_MODEL_FILE_CHUNK_CHARS = 30000;
const MODEL_RESULT_SNIPPET_CHARS = 1400;
const MIN_FOCUSED_WINDOW_SCORE = 90;
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

function numericStyleValue(value) {
  const matched = String(value || '').trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return matched ? matched[1] : '';
}

function addNeedle(map, needle, weight, label) {
  const value = String(needle || '').trim();
  if (!value || value.length < 2) return;
  const key = value.toLowerCase();
  const old = map.get(key);
  if (!old || old.weight < weight) {
    map.set(key, { needle: value, weight, label });
  }
}

function findSnippetIndex(text, snippet) {
  const content = String(text || '');
  const raw = String(snippet || '').trim();
  if (!content || !raw) return -1;
  const exactIndex = content.indexOf(raw);
  if (exactIndex !== -1) return exactIndex;

  const lines = raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length >= 6)
    .sort((a, b) => b.length - a.length);
  for (const line of lines) {
    const index = content.indexOf(line);
    if (index !== -1) return index;
  }

  const lowerText = content.toLowerCase();
  const tokens = tokenize(raw)
    .filter(token => token.length >= 4)
    .sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    const index = lowerText.indexOf(token.toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
}

function rangeExcerpt(text, start, end, maxChars) {
  const content = String(text || '');
  if (!content) return '';
  const safeStart = Math.max(0, Math.min(start, content.length));
  const safeEnd = Math.max(safeStart, Math.min(end, content.length));
  if (safeEnd - safeStart >= maxChars) {
    const clipped = content.slice(safeStart, safeStart + maxChars);
    return `${safeStart > 0 ? '...<omitted before excerpt>\n' : ''}${clipped}${safeStart + maxChars < content.length ? '\n...<omitted after excerpt>' : ''}`;
  }
  const remaining = maxChars - (safeEnd - safeStart);
  const before = Math.floor(remaining * 0.35);
  const after = remaining - before;
  const finalStart = Math.max(0, safeStart - before);
  const finalEnd = Math.min(content.length, safeEnd + after);
  return `${finalStart > 0 ? '...<omitted before excerpt>\n' : ''}${content.slice(finalStart, finalEnd)}${finalEnd < content.length ? '\n...<omitted after excerpt>' : ''}`;
}

function aroundIndexExcerpt(text, index, tokenLength, maxChars) {
  return rangeExcerpt(text, index, index + Math.max(1, tokenLength), maxChars);
}

function candidateHitForFile(body, filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const pools = [
    body.selectedCandidateHits || [],
    body.candidateHits || [],
    body.routeResolver?.hits || [],
  ];
  for (const pool of pools) {
    const hit = pool.find(item => String(item?.file || '').replace(/\\/g, '/').replace(/^\/+/, '') === normalized);
    if (hit) return hit;
  }
  return null;
}

function buildExcerptNeedles(payload, hit) {
  const map = new Map();

  addNeedle(map, hit?.preciseSnippet, 240, '精准片段');
  addNeedle(map, hit?.uniqueSnippet, 220, '唯一片段');
  addNeedle(map, hit?.snippet, 180, '候选片段');
  addNeedle(map, hit?.exactMatchText, 180, '精确文案');
  addNeedle(map, hit?.uniqueMatchText, 170, '唯一文案');

  for (const selection of payload?.selections || []) {
    const info = selection?.element || {};
    const tag = String(info.tag || '').toLowerCase();
    const attrs = info.attrs || {};
    const style = info.computedStyle || {};

    addNeedle(map, info.text, 140, '选区文案');
    addNeedle(map, info.className, 100, '选区 className');
    for (const token of tokenize(info.className).slice(0, 8)) {
      addNeedle(map, token, 72, '选区 class token');
    }

    for (const ancestor of (info.ancestors || []).slice(0, 4)) {
      addNeedle(map, ancestor?.text, 84, '父级文案');
      addNeedle(map, ancestor?.className, 60, '父级 className');
      for (const token of tokenize(ancestor?.className).slice(0, 6)) {
        addNeedle(map, token, 48, '父级 class token');
      }
    }

    const widthValues = uniq([
      attrs.width,
      numericStyleValue(style.width),
    ]).filter(Boolean);
    const heightValues = uniq([
      attrs.height,
      numericStyleValue(style.height),
    ]).filter(Boolean);

    for (const value of widthValues) {
      addNeedle(map, `width: ${value}`, 92, '宽度');
      addNeedle(map, `width="${value}"`, 88, '宽度属性');
      addNeedle(map, `width: '${value}px'`, 96, '宽度样式');
      addNeedle(map, `width: "${value}px"`, 96, '宽度样式');
    }
    for (const value of heightValues) {
      addNeedle(map, `height: ${value}`, 92, '高度');
      addNeedle(map, `height="${value}"`, 88, '高度属性');
      addNeedle(map, `height: '${value}px'`, 96, '高度样式');
      addNeedle(map, `height: "${value}px"`, 96, '高度样式');
    }

    if (style.objectFit) {
      addNeedle(map, `objectFit: '${style.objectFit}'`, 82, 'objectFit');
      addNeedle(map, `objectFit: "${style.objectFit}"`, 82, 'objectFit');
      addNeedle(map, `object-fit: ${style.objectFit}`, 72, 'object-fit');
    }
    if (style.borderRadius) {
      addNeedle(map, `borderRadius: '${style.borderRadius}'`, 66, 'borderRadius');
      addNeedle(map, `borderRadius: "${style.borderRadius}"`, 66, 'borderRadius');
      addNeedle(map, `border-radius: ${style.borderRadius}`, 58, 'border-radius');
    }

    if (tag === 'img') {
      addNeedle(map, `h('img'`, 118, 'img render');
      addNeedle(map, '<img', 108, 'img tag');
      addNeedle(map, 'n-image', 44, 'img wrapper');
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 28);
}

function scoreNeedleMatches(text, needles) {
  const lowerText = String(text || '').toLowerCase();
  if (!lowerText || !needles.length) return 0;
  let score = 0;
  let matchedCount = 0;
  for (const item of needles) {
    if (!lowerText.includes(item.needle.toLowerCase())) continue;
    score += item.weight;
    matchedCount++;
  }
  if (matchedCount >= 3) score += Math.min(60, matchedCount * 10);
  return score;
}

function bestWindowExcerpt(text, needles, maxChars) {
  const content = String(text || '');
  if (!content || !needles.length) return null;
  const lines = content.split('\n');
  if (!lines.length) return null;
  const offsets = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }

  const windowSize = 28;
  let best = null;
  for (let start = 0; start < lines.length; start++) {
    const end = Math.min(lines.length, start + windowSize);
    const windowText = lines.slice(start, end).join('\n');
    const lowerWindow = windowText.toLowerCase();
    const matched = [];
    const score = scoreNeedleMatches(windowText, needles);
    for (const item of needles) {
      if (!lowerWindow.includes(item.needle.toLowerCase())) continue;
      matched.push(`${item.label}:${item.needle}`);
    }
    if (matched.length < 2 && score < 180) continue;
    if (!best || score > best.score) {
      best = {
        score,
        start: offsets[start],
        end: offsets[end - 1] + lines[end - 1].length,
        matched: matched.slice(0, 6),
      };
    }
  }

  if (!best || best.score < MIN_FOCUSED_WINDOW_SCORE) return null;
  return {
    text: rangeExcerpt(content, best.start, best.end, maxChars),
    mode: 'focused-window',
    note: `命中锚点 ${best.matched.join('；')}`,
    score: best.score,
  };
}

function pickRelevantExcerpt(text, payload, hit, maxChars) {
  const content = String(text || '');
  if (!content) {
    return { text: '', mode: 'empty', note: '' };
  }
  if (content.length <= maxChars) {
    return {
      text: content,
      mode: 'full',
      note: '文件较小，直接使用完整内容',
      score: scoreNeedleMatches(content, buildExcerptNeedles(payload, hit)),
    };
  }

  const snippetSeeds = [
    hit?.preciseSnippet,
    hit?.uniqueSnippet,
    hit?.snippet,
    hit?.exactMatchText,
    hit?.uniqueMatchText,
  ].filter(Boolean);
  const needles = buildExcerptNeedles(payload, hit);

  for (const seed of snippetSeeds) {
    const index = findSnippetIndex(content, seed);
    if (index === -1) continue;
    const excerptText = aroundIndexExcerpt(content, index, String(seed).trim().length, maxChars);
    return {
      text: excerptText,
      mode: 'focused-snippet',
      note: '围绕候选命中片段截取',
      score: scoreNeedleMatches(excerptText, needles),
    };
  }

  const window = bestWindowExcerpt(content, needles, maxChars);
  if (window) return window;

  const headText = rangeExcerpt(content, 0, Math.min(content.length, maxChars), maxChars);
  return {
    text: headText,
    mode: 'head',
    note: '未找到稳定锚点，回退为文件头片段',
    score: scoreNeedleMatches(headText, needles),
  };
}

function fileContentChunks(project, filePath, textCache) {
  const file = projectFile(project, filePath);
  if (!file || !isTextFile(file.path)) return [];
  const rawText = readProjectText(project, file, textCache || new Map());
  if (!rawText) {
    return [{
      file: file.path,
      text: '',
      mode: 'full',
      note: '空文件',
      rawLength: 0,
      chunkIndex: 1,
      chunkTotal: 1,
      start: 0,
      end: 0,
    }];
  }
  const chunkTotal = Math.max(1, Math.ceil(rawText.length / MAX_MODEL_FILE_CHUNK_CHARS));
  const chunks = [];
  for (let index = 0; index < chunkTotal; index++) {
    const start = index * MAX_MODEL_FILE_CHUNK_CHARS;
    const end = Math.min(rawText.length, start + MAX_MODEL_FILE_CHUNK_CHARS);
    chunks.push({
      file: file.path,
      text: rawText.slice(start, end),
      mode: chunkTotal === 1 ? 'full' : 'chunk',
      note: chunkTotal === 1 ? '文件完整纳入当前批次' : `文件连续分片 ${index + 1}/${chunkTotal}`,
      rawLength: rawText.length,
      chunkIndex: index + 1,
      chunkTotal,
      start,
      end,
    });
  }
  return chunks;
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

  for (const item of body.selectedCandidateHits || []) add(item.file);
  for (const item of body.candidateHits || []) add(item.file);
  for (const item of body.routeResolver?.hits || []) add(item.file);
  for (const item of body.extraFiles || []) add(item);

  const blocks = [];
  for (const file of files.slice(0, MAX_MODEL_FILES)) {
    const chunks = fileContentChunks(project, file, textCache);
    if (!chunks.length) continue;
    blocks.push(...chunks);
    appendLog(logs, `读取候选文件：${file}（原始 ${chunks[0].rawLength} 字符；分片 ${chunks.length} 个；单片上限 ${MAX_MODEL_FILE_CHUNK_CHARS} 字符）`);
  }
  appendLog(logs, `候选文件内容：纳入 ${blocks.length} 个源码分片 / ${files.length} 个候选文件；不会在文件内部使用省略截断`);
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
    const broadAssetTag = new Set(['body', 'html', 'table', 'tbody', 'thead', 'tr']);
    const styleSignals = info.computedStyle || {};
    const assetStyleSignals = asset.computedStyle || {};
    return {
      index: item.index,
      token: item.token || `@选区${item.index}`,
      instruction: instructions.get(Number(item.index || 0)) || '',
      tag: info.tag,
      selector: info.selector,
      className: info.className,
      attrs: info.attrs || {},
      text: compact(info.text, 400),
      inlineStyle: compact(info.inlineStyle, 220),
      style: {
        width: styleSignals.width || '',
        height: styleSignals.height || '',
        objectFit: styleSignals.objectFit || '',
        borderRadius: styleSignals.borderRadius || ''
      },
      box: info.box || null,
      assetContext: {
        tag: asset.tag || '',
        selector: asset.selector || '',
        className: asset.className || '',
        text: !broadAssetTag.has(String(asset.tag || '').toLowerCase()) ? compact(asset.text, 120) : '',
        width: assetStyleSignals.width || '',
        height: assetStyleSignals.height || '',
        box: asset.box || null
      },
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
        attrs: info.attrs || {},
        instruction: instructions.get(Number(item.index || 0)) || '',
      };
    });
}

function routeResolverSummary(trace) {
  if (!trace) return null;
  return {
    pagePath: trace.pagePath || '',
    matched: !!trace.matched,
    adapters: Array.isArray(trace.adapters) ? trace.adapters : [],
    hits: (trace.hits || []).slice(0, 4).map(hit => ({
      file: hit.file,
      routePath: hit.routePath || '',
      score: hit.score,
      from: hit.from || '',
      reasons: (hit.reasons || []).slice(0, 3),
    }))
  };
}

function candidateFactsSummary(candidateHits) {
  return (candidateHits || []).slice(0, 12).map(hit => ({
    file: hit.file,
    score: hit.score,
    stage: hit.stage,
    from: hit.from || '',
    preciseEvidence: !!hit.preciseEvidence,
    exactMatchText: hit.exactMatchText || '',
    uniqueMatchText: hit.uniqueMatchText || '',
    classEvidence: (hit.contextReasons || []).slice(0, 2),
    contextScope: hit.contextScope || '',
    contextLayerDepth: hit.contextLayerDepth || 0,
    reasons: (hit.reasons || []).slice(0, 4),
    importChain: (hit.importChain || []).slice(0, 4),
  }));
}

function mergedCandidateFacts(body) {
  const merged = [];
  const seen = new Set();
  for (const hit of [...(body.selectedCandidateHits || []), ...(body.candidateHits || [])]) {
    const file = String(hit?.file || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!file || seen.has(file)) continue;
    seen.add(file);
    merged.push(hit);
  }
  return merged;
}

function mergeList(...lists) {
  return uniq(lists.flatMap(list => Array.isArray(list) ? list : [list]).filter(Boolean));
}

function buildModelPrompt(project, body, textCache, logs, options = {}) {
  const payload = body.searchPayload || {};
  const files = options.files || collectModelFiles(project, body, textCache, logs);
  const apiRequests = Array.isArray(payload.apiRequests) ? payload.apiRequests : [];
  const routeSummary = routeResolverSummary(body.routeResolver);
  const candidateFacts = candidateFactsSummary(mergedCandidateFacts(body));
  const batchIndex = Math.max(1, Number(options.batchIndex || 1));
  const batchTotal = Math.max(batchIndex, Number(options.batchTotal || 1));
  const previousItems = Array.isArray(options.previousItems) ? options.previousItems : [];
  const batchFiles = files.map(file => {
    return file.chunkTotal > 1
      ? `${file.file}#chunk-${file.chunkIndex}/${file.chunkTotal}`
      : file.file;
  });

  return [
    '你是本地源码定位 agent。你的任务是在本地预检索结果基础上，进一步判断最应该修改的源码文件。',
    '',
    '判断规则：',
    '- 必须优先结合当前选区本身的证据：tag、selector、className、节点属性、inline style、宽高、父级线索、修改要求。',
    '- 如果选区是 img、icon、纯视觉节点或文本为空，不要依赖页面文案，优先根据 className、selector、src、宽高、inline style 去判断。',
    '- 页面路由命中文件只是入口线索；如果入口只是容器或页面壳子，需要继续判断更具体的子组件或列渲染位置。',
    '- 不要因为页面入口文件包含 table columns、列表配置或路由组件，就直接认定它是最终修改文件；除非选区证据明确落在该文件。',
    '- 接口线索只作为辅助，不得覆盖当前选区的结构化证据。',
    '- 接口线索只会提供请求地址、method 和请求参数字段，不包含响应结果。',
    `- 你当前只在阅读第 ${batchIndex}/${batchTotal} 批候选源码；只能依据当前批次源码返回结果。当前批次没有命中就返回 []。`,
    '- 如果同一个文件被拆成多个 chunk，必须只根据当前 chunk 可见内容判断；需要后续 chunk 才能判断时返回 []。',
    '- 本轮允许返回多个命中文件；后续批次还会继续读取其他候选文件，最后会再和本地检索结果复核。',
    '- "code片段" 必须直接摘自候选文件内容，尽量短，足够定位即可；找不到就返回 []。',
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
    `当前批次: ${batchIndex}/${batchTotal}`,
    batchFiles.length ? `当前批次文件:\n${safeJson(batchFiles)}` : '',
    '',
    `当前选区:\n${safeJson(selectionSummary(payload))}`,
    '',
    payload.selectionInstructions?.length ? `按选区拆分后的修改要求:\n${safeJson(payload.selectionInstructions)}` : '',
    routeSummary ? `路由入口线索:\n${safeJson(routeSummary)}` : '',
    candidateFacts.length ? `候选文件摘要:\n${safeJson(candidateFacts)}` : '',
    apiRequests.length ? `接口线索:\n${safeJson(apiRequests.slice(0, 4))}` : '',
    previousItems.length ? `前序批次已命中:\n${safeJson(previousItems.slice(0, 6).map(item => ({ file: item.file, prompt: item.prompt || '', confidence: item.confidence || 0 })))}` : '',
    body.candidateHits?.some(hit => hit && hit.apiEvidence) ? `候选文件接口关联:\n${safeJson(apiReferenceSummary(body.candidateHits || []))}` : '',
    '',
    '候选源码内容：',
    files.map(file => [
      file.chunkTotal > 1
        ? `--- FILE: ${file.file} (chunk ${file.chunkIndex}/${file.chunkTotal}, chars ${file.start}-${file.end} of ${file.rawLength}) ---`
        : `--- FILE: ${file.file} (full, chars 0-${file.rawLength} of ${file.rawLength}) ---`,
      file.text,
      file.chunkTotal > 1
        ? `--- END FILE: ${file.file} (chunk ${file.chunkIndex}/${file.chunkTotal}) ---`
        : `--- END FILE: ${file.file} ---`,
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

function chunkFileBlocks(blocks, maxChars = MAX_MODEL_BATCH_FILE_CHARS) {
  const batches = [];
  let current = [];
  let currentSize = 0;
  for (const block of blocks || []) {
    const size = String(block?.text || '').length;
    if (current.length && currentSize + size > maxChars) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(block);
    currentSize += size;
  }
  if (current.length) batches.push(current);
  return batches.length ? batches : [[]];
}

function localCandidateMap(body) {
  const map = new Map();
  for (const hit of [...(body.selectedCandidateHits || []), ...(body.candidateHits || [])]) {
    if (!hit?.file || map.has(hit.file)) continue;
    map.set(hit.file, hit);
  }
  return map;
}

function modelItemRank(item) {
  const localScore = Math.min(120, Math.round((item.localScore || 0) / 6));
  return (item.confidence || 0) + localScore + (item.localPreciseEvidence ? 48 : 0) + (item.snippetVerified ? 18 : 0);
}

function reconcileModelItems(items, body) {
  const localMap = localCandidateMap(body);
  const merged = new Map();

  for (const item of items || []) {
    if (!item?.file) continue;
    const local = localMap.get(item.file);
    const enriched = {
      ...item,
      localScore: local?.score || 0,
      localPreciseEvidence: !!local?.preciseEvidence,
      localStages: mergeList(local?.stages || local?.stage, item.localStages || []),
      localReasons: mergeList((local?.reasons || []).slice(0, 6), item.localReasons || []),
      localContextReasons: mergeList((local?.contextReasons || []).slice(0, 4), item.localContextReasons || []),
    };
    const old = merged.get(item.file);
    if (!old || modelItemRank(enriched) > modelItemRank(old)) {
      merged.set(item.file, enriched);
      continue;
    }
    merged.set(item.file, {
      ...old,
      confidence: Math.max(old.confidence || 0, enriched.confidence || 0),
      prompt: old.prompt || enriched.prompt,
      reason: old.reason || enriched.reason,
      codeSnippet: old.codeSnippet || enriched.codeSnippet,
      snippetVerified: !!(old.snippetVerified || enriched.snippetVerified),
      localScore: Math.max(old.localScore || 0, enriched.localScore || 0),
      localPreciseEvidence: !!(old.localPreciseEvidence || enriched.localPreciseEvidence),
      localStages: mergeList(old.localStages || [], enriched.localStages || []),
      localReasons: mergeList(old.localReasons || [], enriched.localReasons || []),
      localContextReasons: mergeList(old.localContextReasons || [], enriched.localContextReasons || []),
    });
  }

  return Array.from(merged.values())
    .sort((a, b) => modelItemRank(b) - modelItemRank(a));
}

function resolveModelSnippet(project, filePath, codeSnippet, body, textCache) {
  const file = projectFile(project, filePath);
  if (!file) {
    return {
      codeSnippet: '',
      snippetVerified: false,
      snippetSource: 'missing-file',
    };
  }

  const text = readProjectText(project, file, textCache || new Map());
  const hit = candidateHitForFile(body, filePath);
  const needles = buildExcerptNeedles(body.searchPayload || {}, hit);
  const fallback = pickRelevantExcerpt(text, body.searchPayload || {}, hit, MODEL_RESULT_SNIPPET_CHARS);
  const directIndex = findSnippetIndex(text, codeSnippet);
  if (directIndex !== -1) {
    const modelExcerpt = aroundIndexExcerpt(text, directIndex, Math.max(1, String(codeSnippet || '').trim().length), MODEL_RESULT_SNIPPET_CHARS);
    const modelScore = scoreNeedleMatches(modelExcerpt, needles);
    if (fallback && (fallback.mode === 'focused-snippet' || fallback.mode === 'focused-window') && fallback.score > modelScore + 40) {
      return {
        codeSnippet: fallback.text,
        snippetVerified: false,
        snippetSource: fallback.mode,
      };
    }
    return {
      codeSnippet: modelExcerpt,
      snippetVerified: true,
      snippetSource: 'model',
    };
  }

  if (fallback.mode === 'focused-snippet' || fallback.mode === 'focused-window' || fallback.mode === 'full') {
    return {
      codeSnippet: fallback.text,
      snippetVerified: false,
      snippetSource: fallback.mode,
    };
  }

  return {
    codeSnippet: '',
    snippetVerified: false,
    snippetSource: fallback.mode || 'none',
  };
}

function validateModelItems(project, parsed, body, textCache) {
  return modelOutputItems(parsed).map(item => {
    const file = String(item.path || item.file || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const rawCodeSnippet = String(item['code片段'] || item['位置'] || item.codeSnippet || item.location || item.snippet || item.code || '').trim();
    const prompt = String(item['提示词'] || item.prompt || item.instruction || item.reason || '').trim();
    const snippetResult = resolveModelSnippet(project, file, rawCodeSnippet, body, textCache);
    return {
      path: file,
      file,
      confidence: Math.max(0, Math.min(Number(item.confidence || 0), 100)),
      codeSnippet: snippetResult.codeSnippet,
      prompt,
      reason: prompt || snippetResult.codeSnippet || rawCodeSnippet,
      exists: !!projectFile(project, file),
      snippetVerified: snippetResult.snippetVerified,
      snippetSource: snippetResult.snippetSource,
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
    appendLog(logs, '缩略图说明：当前模型定位不会发送图片字节，只会发送截图区域节点的结构化信息，例如 selector、盒模型、HTML 和样式摘要。');
    const fileBlocks = collectModelFiles(project, body, textCache, logs);
    const batches = chunkFileBlocks(fileBlocks, MAX_MODEL_BATCH_FILE_CHARS);
    appendLog(logs, `模型分批读取：${batches.length} 批；单批文件内容上限 ${MAX_MODEL_BATCH_FILE_CHARS} 字符`);
    const rawTexts = [];
    const parsedList = [];
    let aggregatedItems = [];

    for (let index = 0; index < batches.length; index++) {
      const batchFiles = batches[index];
      appendLog(logs, `开始读取第 ${index + 1}/${batches.length} 批：${batchFiles.map(item => item.file).join('；') || '-'}`);
      const prompt = buildModelPrompt(project, body, textCache, logs, {
        files: batchFiles,
        batchIndex: index + 1,
        batchTotal: batches.length,
        previousItems: aggregatedItems,
      });
      appendLog(logs, `第 ${index + 1}/${batches.length} 批提示词长度：${prompt.length} 字符`);
      appendLog(logs, `模型定位提示词(第 ${index + 1}/${batches.length} 批):\n${prompt}`);
      const rawText = adapter.type === 'api'
        ? await runApiAdapter(adapter, prompt, logs)
        : await runExecAdapter(adapter, prompt, project.path, logs);
      rawTexts.push(rawText);
      appendLog(logs, `第 ${index + 1}/${batches.length} 批模型原始输出：${rawText.length} 字符`);
      const parsed = parseModelJson(rawText);
      parsedList.push(parsed);
      appendLog(logs, parsed ? `第 ${index + 1}/${batches.length} 批 JSON 解析成功` : `第 ${index + 1}/${batches.length} 批 JSON 解析失败`);
      const batchItems = validateModelItems(project, parsed, body, textCache);
      appendLog(logs, `第 ${index + 1}/${batches.length} 批命中 ${batchItems.length} 个文件`);
      aggregatedItems = reconcileModelItems([...aggregatedItems, ...batchItems], body);
    }

    const modelItems = reconcileModelItems(aggregatedItems, body);
    appendLog(logs, `模型推荐文件：${modelItems.length} 个`);
    for (const item of modelItems.slice(0, 8)) {
      appendLog(
        logs,
        `模型结果复核：${item.file}；本地分数 ${item.localScore || 0}；本地精确证据 ${item.localPreciseEvidence ? '是' : '否'}；代码片段${item.snippetVerified ? '已在本地源码命中' : item.codeSnippet ? `改用本地${item.snippetSource}片段` : '未找到可验证片段'}`
      );
    }
    const multiFileMatches = modelItems.filter(item => item.localPreciseEvidence || item.localScore >= 120);
    if (multiFileMatches.length > 1) {
      appendLog(logs, `多文件复核：本地与模型同时支持 ${multiFileMatches.length} 个文件，需保留多文件结果`);
    }
    return {
      adapter: {
        id: adapter.id,
        name: adapter.name,
        type: adapter.type,
      },
      rawText: rawTexts.join('\n\n'),
      parsed: parsedList[0] || null,
      parsedBatches: parsedList,
      modelItems,
      targetFiles: modelItems.map(item => ({
        file: item.file,
        confidence: item.confidence,
        reason: item.reason,
        codeSnippet: item.codeSnippet,
        prompt: item.prompt,
        localScore: item.localScore,
        localPreciseEvidence: item.localPreciseEvidence,
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
