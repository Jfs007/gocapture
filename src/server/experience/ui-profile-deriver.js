'use strict';

const fs = require('fs');
const path = require('path');

const { appendKnowledgeLog } = require('./knowledge-log');

// 扫描/解释阶段：借 context7 MCP 拉取项目实际 UI 库（对版本）的文档，
// 用一次 LLM 抽取成结构化 frameworkProfiles（class 前缀 + DOM 签名→源码写法映射）。
// 结果被 project-knowledge 烘焙进 .magnus/project-knowledge.json，定位循环只读缓存、不 live 调 MCP。
// 任意失败（无 context7 / 网络 / 解析失败）都返回 []，由上层安全退化。

const MAX_UI_CANDIDATES = 3;
const DERIVE_MAX_TURNS = 8; // 上限：recursionLimit≈18，失败也快，不再长挂 2 分钟

const UI_HINT = /(ui|design|element|iview|view-ui|antd|ant-design|vant|naive|vuetify|arco|semi|mui|chakra|bootstrap|quasar|tdesign)/i;
// 明显不是 UI 组件库、但名字可能命中 hint 的包，排除掉。
const UI_DENY = /(eslint|webpack|vite|jest|babel|types?\/|typescript|autoprefixer|postcss)/i;

function readDeps(project) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(project.path, 'package.json'), 'utf8'));
    return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch (error) {
    return {};
  }
}

function uiCandidates(project) {
  const deps = readDeps(project);
  return Object.entries(deps)
    .filter(([name]) => UI_HINT.test(name) && !UI_DENY.test(name))
    .map(([name, version]) => ({ name, version: String(version || '') }));
}

function buildDerivePrompt(candidates) {
  return [
    '你要为“DOM→源码定位”准备 UI 组件库的渲染签名知识。',
    '下列是本项目 package.json 里的 UI 组件库候选（含安装版本范围）：',
    JSON.stringify(candidates, null, 2),
    '',
    '步骤：',
    '1. 对每个候选库，用 context7 工具（先 resolve-library-id，再 get-library-docs）拉取“对应版本”的文档，重点看表单项/组件的 class 命名与渲染结构。',
    '2. 依据文档总结：该库 DOM class 前缀，以及“DOM 特征 → 源码写法”的映射（例如某 label class 对应源码里的哪种标签/属性写法）。',
    '3. 只写文档支持的结论；拿不到文档的库直接略过，不要编造。',
    '',
    '只输出一个严格 JSON 数组，不要任何解释文字，格式：',
    '[{"name":"库名","version":"版本","classPrefixes":[{"prefix":"xxx-","action":"skip","reason":"..."}],',
    '  "signatureHints":[{"domPattern":"DOM 特征","sourceConstruct":"源码写法","searchAs":"建议 grep 的 token"}]}]',
  ].join('\n');
}

function extractJsonArray(text) {
  if (!text) return null;
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const classPrefixes = (Array.isArray(raw.classPrefixes) ? raw.classPrefixes : [])
    .map(entry => ({
      prefix: String(entry?.prefix || '').trim(),
      action: entry?.action === 'downweight' ? 'downweight' : 'skip',
      reason: String(entry?.reason || `${name} class 前缀`),
    }))
    .filter(entry => /^[a-z][\w-]*-$/i.test(entry.prefix));
  const signatureHints = (Array.isArray(raw.signatureHints) ? raw.signatureHints : [])
    .map(entry => ({
      domPattern: String(entry?.domPattern || ''),
      sourceConstruct: String(entry?.sourceConstruct || ''),
      searchAs: String(entry?.searchAs || ''),
    }))
    .filter(entry => entry.searchAs || entry.sourceConstruct);
  if (!classPrefixes.length && !signatureHints.length) return null;
  return { name, version: String(raw.version || ''), classPrefixes, signatureHints };
}

// options.runAgent 可注入以便测试（默认走真实 MCP+LLM 的 runAgentLlmTask）。
async function deriveUiProfiles(project, options = {}) {
  const log = message => {
    if (typeof options.onLog === 'function') options.onLog(message);
    appendKnowledgeLog(project, message);
  };
  const allCandidates = uiCandidates(project);
  if (!allCandidates.length) {
    log('ui-profile-deriver: package.json 无 UI 组件库候选，跳过 context7 派生');
    return [];
  }
  // 限候选数量：避免 agent 为过多库反复调 context7 撑爆预算/长挂（曾撞 recursion limit 2 分钟）。
  const candidates = allCandidates.slice(0, MAX_UI_CANDIDATES);
  log(`ui-profile-deriver: UI 候选=${candidates.map(c => `${c.name}@${c.version}`).join(', ')}${allCandidates.length > candidates.length ? `（共 ${allCandidates.length}，取前 ${candidates.length}）` : ''}`);
  const runAgent = options.runAgent || require('../agent-host/llm-adapter').runAgentLlmTask;
  const adapter = options.adapter;
  if (!adapter && !options.runAgent) {
    log('ui-profile-deriver: 无 adapter，跳过 context7 派生');
    return [];
  }
  try {
    log('ui-profile-deriver: 调用 context7 + LLM 派生 UI 签名…');
    const result = await runAgent(adapter, buildDerivePrompt(candidates), project, {
      langchainModel: options.langchainModel,
      signal: options.signal,
      onLog: options.onLog,
      stage: 'ui-profile-deriver',
      configAction: ['builtin', 'mcp'],
      maxTurns: DERIVE_MAX_TURNS,
      systemPrompt: '你是 UI 库渲染签名抽取器，只用 context7 文档为依据，只输出严格 JSON 数组。',
    });
    const rawText = String((result && result.rawText) || '');
    log(`ui-profile-deriver: 模型返回 ${rawText.length} 字符；预览=${rawText.slice(0, 500).replace(/\s+/g, ' ')}`);
    const parsed = extractJsonArray(rawText);
    if (!Array.isArray(parsed)) {
      log('ui-profile-deriver: 未从返回中解析出 JSON 数组，退化为空');
      return [];
    }
    const profiles = parsed.map(normalizeProfile).filter(Boolean);
    log(`ui-profile-deriver: 派生成功 profiles=${profiles.length}（${profiles.map(p => p.name).join('、') || '无有效项'}）`);
    return profiles;
  } catch (error) {
    log(`ui-profile-deriver: 失败，退化为空 —— ${error.message}`);
    return [];
  }
}

module.exports = {
  deriveUiProfiles,
  uiCandidates,
  extractJsonArray,
  normalizeProfile,
};
