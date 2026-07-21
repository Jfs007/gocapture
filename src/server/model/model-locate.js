'use strict';

const { runAgentLlmTask } = require('../agent-host/llm-adapter');
const { normalizeAdapter } = require('./api-client');

const MAX_MODEL_FILES = 6;

function appendLog(logs, text) {
  logs.push(String(text || ''));
  if (typeof logs.onAppend === 'function') logs.onAppend(String(text || ''));
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return '{}';
  }
}

function clip(value, limit = 600) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function compactSelection(selection) {
  const element = selection?.element || selection || {};
  return {
    index: selection?.index,
    tag: element.tag || '',
    className: clip(element.className || '', 160),
    text: clip(element.text || '', 260),
    attrs: Object.fromEntries(
      Object.entries(element.attrs || {})
        .filter(([key]) => !/^data-v-/.test(key) && !/^aria-/.test(key))
        .slice(0, 10)
        .map(([key, value]) => [key, clip(value, 120)])
    ),
  };
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
  const objectStart = raw.indexOf('{');
  const objectEnd = raw.lastIndexOf('}');
  if (arrayStart >= 0 && arrayEnd > arrayStart && (objectStart < 0 || arrayStart < objectStart)) {
    try {
      return JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
    } catch (error) {
    }
  }
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(raw.slice(objectStart, objectEnd + 1));
    } catch (error) {
    }
  }
  return null;
}

function candidateFiles(body) {
  const selected = Array.isArray(body?.selectedCandidateHits) ? body.selectedCandidateHits : [];
  const all = Array.isArray(body?.candidateHits) ? body.candidateHits : [];
  const seen = new Set();
  return [...selected, ...all]
    .filter(hit => hit?.file && !seen.has(hit.file) && seen.add(hit.file))
    .slice(0, MAX_MODEL_FILES);
}

function buildModelPrompt(project, body, textCache, logs, options = {}) {
  const files = Array.isArray(options.files) ? options.files : candidateFiles(body);
  const payload = body?.searchPayload || {};
  const selections = (payload.selections || []).map(compactSelection).slice(0, 6);
  return [
    '你是 Magnus 的源码定位复核 Agent。',
    '你只基于输入里的候选文件、选区摘要和用户需求判断哪些候选可保留。',
    '不要编造新文件，不要输出不在候选列表里的文件。',
    '返回严格 JSON：{"items":[{"file":"候选文件路径","confidence":0,"reason":"","codeSnippet":"","locateLevel":"exact|direction"}]}',
    '',
    `项目: ${project?.name || ''}`,
    `技术栈: ${(project?.stack || []).join(' / ') || project?.stackText || ''}`,
    `页面: ${payload.url || body?.url || ''}`,
    `需求: ${payload.userPrompt || body?.userPrompt || ''}`,
    '',
    '选区摘要:',
    safeJson(selections),
    '',
    '候选文件:',
    safeJson(files.map(hit => ({
      file: hit.file,
      score: hit.score,
      reasons: (hit.reasons || []).slice(0, 6),
      matchedGroups: (hit.matchedGroups || []).slice(0, 4),
    }))),
  ].join('\n');
}

function modelOutputItems(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed?.files)) return parsed.files.map(file => (typeof file === 'string' ? { file } : file));
  if (Array.isArray(parsed?.targetFiles)) return parsed.targetFiles;
  return [];
}

function validateModelItems(project, parsed, body) {
  const files = new Set((project?.files || []).map(file => file.path));
  const allowed = new Set(candidateFiles(body).map(hit => hit.file));
  return modelOutputItems(parsed)
    .map(item => ({
      file: String(item?.file || item?.path || '').trim(),
      confidence: Math.max(0, Math.min(100, Number(item?.confidence || 0))),
      reason: String(item?.reason || item?.prompt || ''),
      codeSnippet: String(item?.codeSnippet || item?.snippet || ''),
      snippetSource: 'model-locate',
      snippetVerified: false,
      locateLevel: item?.locateLevel === 'exact' ? 'exact' : 'direction',
      exists: false,
    }))
    .filter(item => item.file && allowed.has(item.file))
    .map(item => ({ ...item, exists: files.has(item.file) }));
}

async function runModelLocate(project, body, textCache = new Map(), options = {}) {
  if (!project) throw new Error('No project selected.');
  const logs = [];
  if (typeof options.onLog === 'function') logs.onAppend = options.onLog;
  try {
    const adapter = normalizeAdapter(body.adapter);
    appendLog(logs, `模型定位开始：${adapter.name}（api）`);
    appendLog(logs, `候选输入：${candidateFiles(body).length} 个；该入口只做模型复核，不再做本地检索/AST 裁剪。`);
    const prompt = buildModelPrompt(project, body, textCache, logs);
    appendLog(logs, `模型定位提示词：${prompt.length} 字符`);
    appendLog(logs, `模型定位提示词内容:\n${prompt}`);
    const llmResult = await runAgentLlmTask(adapter, prompt, project, {
      signal: options.signal,
      stage: 'model-locate',
      systemPrompt: '你是 Magnus 源码定位复核 Agent。只能返回严格 JSON。',
      onLog: message => appendLog(logs, message),
    });
    const rawText = llmResult.rawText;
    appendLog(logs, `模型定位原始输出内容:\n${rawText || '-'}`);
    const parsed = parseModelJson(rawText);
    const modelItems = validateModelItems(project, parsed, body).filter(item => item.exists);
    appendLog(logs, `模型定位接收文件：${modelItems.length} 个`);
    return {
      adapter: { id: adapter.id, name: adapter.name, type: adapter.type },
      rawText,
      parsed,
      parsedBatches: parsed ? [parsed] : [],
      modelItems,
      targetFiles: modelItems,
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
  parseModelJson,
  runModelLocate,
};
