'use strict';

// 关系断点解析器（骨架）。
//
// 「断点」= 本地关系图往下走时，遇到一条无法用纯源码事实静态验证的连线：
// 工厂 / 注册表 / DI / 动态组件（<component :is>）/ 动态 key / 自动扫描 / 服务端下发……
// 处理方式不是猜、不是再写一条框架正则，而是：
//   把断点附近一小段源码 + 当前部分图交给 LLM → LLM 只回「下一步验证什么」（一个确定性本地搜索指令）
//   → 本地执行搜索、拿到事实、回灌 → 最多 N 轮 → 能确定就产出一条已验证的边，否则返回 ambiguous（不假装）。
//
// 分工：本地只做确定性搜索/验证（find_symbol / search_text / find_importers / read_file，纯字符串与图操作，
// 不懂任何框架）；LLM 只理解本地跨不过去的那一跳陌生语义，说下一步查什么；调用方负责把结果接回图。
//
// 本模块是可复用引擎：invoke（LLM）注入，本地原语真实执行。断点的「检测」与「接回图」由调用方负责，
// 尚未接入 runAgentSearch。

const { buildFileMap } = require('../../import-trace');
const { runDiscoveryOperation } = require('../../../experience/discovery-executor');

const SEARCH_ROOTS = ['src'];

function parseJson(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const tryParse = candidate => { try { return JSON.parse(candidate); } catch (error) { return undefined; } };
  const direct = tryParse(text);
  if (direct !== undefined) return direct;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed !== undefined) return parsed;
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const parsed = tryParse(text.slice(start, end + 1));
    if (parsed !== undefined) return parsed;
  }
  return null;
}

// —— 本地确定性搜索原语。全部委托给共享检索核 runDiscoveryOperation（host 的 project-tools 也用它），
// 不再自造 find_symbol/search_text/find_importers/read_file 的重复实现。返回统一为 { operation, matches, stats }。——
function localPrimitives(project, textCache) {
  const run = (operation, request) => {
    const output = runDiscoveryOperation(project, { operation, ...request }, textCache);
    return { operation, matches: output.matches || [], stats: output.stats || null };
  };
  return {
    read_file: ({ file, around }) => run('read_file', { scope: { files: [file] }, terms: around ? [String(around)] : [], maxLinesPerResult: 60 }),
    search_text: ({ term, roots }) => run('search_text', { scope: { roots: roots || SEARCH_ROOTS }, terms: [String(term || '')] }),
    find_symbol: ({ name, roots }) => run('find_symbol', { scope: { roots: roots || SEARCH_ROOTS }, terms: [String(name || '')] }),
    find_importers: ({ file }) => run('find_importers', { target: file }),
  };
}

function buildBreakpointPrompt(context, observations) {
  const lines = [
    '你是「关系断点」解析器。本地关系图走到一条无法静态验证的连线：某文件动态渲染/装配了组件，',
    '但本地凭源码语法无法确定它最终渲染的是哪个文件。你只负责「下一步验证什么」——不猜文件、不打分。',
    '',
    `墙文件：${context.wallFile || ''}`,
  ];
  if (context.wallSnippet) lines.push('相关源码切片：', context.wallSnippet, '');
  if ((context.unresolvedImports || []).length) {
    lines.push('该文件未解析的 import（本地已知路径，但用途不明）：', JSON.stringify(context.unresolvedImports, null, 2), '');
  }
  if ((context.targetCandidates || []).length) {
    lines.push('待解释的候选文件（有真实 DOM 证据，可能就是最终渲染的那个）：', JSON.stringify(context.targetCandidates, null, 2), '');
  }
  if ((context.chain || []).length) {
    lines.push('已确认的部分链路：', JSON.stringify(context.chain, null, 2), '');
  }
  if (observations.length) {
    lines.push('已取得的本地验证结果：', JSON.stringify(observations, null, 2), '');
  }
  lines.push(
    '只返回一个 JSON（严格其一，不要多余文字）：',
    '- 继续验证：{"action":"find_symbol"|"search_text"|"find_importers"|"read_file","args":{...},"reason":""}',
    '    · find_symbol {name}       找该符号的定义/注册处',
    '    · search_text {term}       全仓找该字面量出现处',
    '    · find_importers {file}    找谁 import 了该文件',
    '    · read_file {file, around} 读某文件（around 给一个字面量，把切片对准它）',
    '- 已能确定渲染的是哪个文件：{"action":"resolve","args":{"file":"src/..."},"reason":""}',
    '- 静态验证不了（证据不足/运行时才决定）：{"action":"give_up","reason":""}',
  );
  return lines.join('\n');
}

// context: { project, textCache?, wallFile, wallSnippet?, unresolvedImports?, targetCandidates?, chain? }
// options: { invoke(stage, prompt) -> Promise<string>, log?, maxRounds? }
// 返回：{ resolved:true, file, via } | { resolved:false, reason, via }
async function resolveBreakpoint(context, options = {}) {
  const { invoke, log = () => {}, maxRounds = 2 } = options;
  if (typeof invoke !== 'function') return { resolved: false, reason: 'no-invoke', via: [] };
  const project = context.project;
  const textCache = context.textCache || new Map();
  const fileMap = buildFileMap(project);   // 仅用于校验 resolve 目标文件真实存在
  const primitives = localPrimitives(project, textCache);
  const observations = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    const prompt = buildBreakpointPrompt(context, observations);
    const raw = await invoke('breakpoint-resolve', prompt);
    log(`断点第 ${round} 轮：模型返回 ${String(raw || '').length} 字符`);
    const step = parseJson(raw);
    if (!step || !step.action) return { resolved: false, reason: 'no-step', via: observations };

    if (step.action === 'resolve') {
      const file = String(step.args?.file || '');
      if (fileMap.has(file)) {
        log(`断点已验证：渲染指向 ${file}`);
        return { resolved: true, file, via: observations };
      }
      return { resolved: false, reason: 'resolve-target-missing', via: observations };
    }
    if (step.action === 'give_up') {
      log(`断点放弃：${step.reason || '未给原因'}`);
      return { resolved: false, reason: step.reason || 'give-up', via: observations };
    }

    const primitive = primitives[step.action];
    if (!primitive) {
      observations.push({ action: step.action, error: 'unknown-action' });
      continue;
    }
    const result = primitive(step.args || {});
    observations.push({ action: step.action, args: step.args || {}, result });
    log(`断点验证：${step.action} ${JSON.stringify(step.args || {})}`);
  }
  return { resolved: false, reason: 'max-rounds', via: observations };
}

module.exports = {
  resolveBreakpoint,
  localPrimitives,
  buildBreakpointPrompt,
  parseJson,
};
