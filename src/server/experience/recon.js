'use strict';

// 实现侦察（精简版）：LLM 只干一件事——看「用户需求 + Structure.md」，挑出需求里明确提到的能力可能对应的
// 「项目公共文件/目录」+ 检索词。其余全是本地的：把检索词扩成变体(md-table / MdTable)提高命中，搜哪些文件用了它，
// 再从用它的真实文件里抽出用法片段。LLM 不做检索、不做实现规划、不判断证据够不够。

const { readProjectText } = require('../core/fs-utils');
const { uniq } = require('../utils');
const { runDiscoveryOperation } = require('./discovery-executor');
const { loadStructureDoc } = require('./project-structure');
const { loadComponentExperiences, saveComponentExperiences } = require('./component-experience');

function buildReconPrompt(requirement, structureDoc) {
  return [
    '你是前端项目侦察员。根据用户需求和真实项目结构，挑出本次需求明确提到的能力可能对应的公共文件或目录，供本地检索验证。',
    '',
    '规则：',
    '1. 只处理用户需求中明确出现的能力、字段或对象。',
    '2. 不要补全隐含功能。用户没说的需求就不返回。',
    '3. 只输出真实结构里出现过的公共文件或目录。',
    '4. 不写实现方案，不解释。',
    '5. 不编造名字。',
    '6. 没有明显候选就输出 []。',
    '7. keywords 只能来自用户需求原文或真实结构中的文件/目录名，不要扩写近义词。',
    '',
    '公共能力优先范围：',
    'components/ hooks/ api/ store/ router/ enums/ utils/ directives/',
    '',
    '只返回 JSON 数组：',
    JSON.stringify([{
      role: 'component | api | hook | store | util | permission | other',
      path: '真实存在的文件或目录',
      keywords: ['1-3个检索词'],
      explain: '',
    }], null, 2),
    '',
    `用户需求：\n${requirement || ''}`,
    `复用骨架 Structure.md（项目工具箱）：\n${structureDoc || ''}`,
  ].join('\n');
}

function parseReconPlan(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end > start) {
      try { parsed = JSON.parse(text.slice(start, end + 1)); } catch (inner) { parsed = null; }
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(item => ({
      role: String(item?.role || 'other'),
      path: String(item?.path || '').replace(/^\.?\//, '').replace(/\/+$/, ''),
      keywords: (Array.isArray(item?.keywords) ? item.keywords : []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 3),
      explain: String(item?.explain || ''),
    }))
    .filter(item => item.path && item.keywords.length)
    .slice(0, 8);
}

function toKebab(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
}
function toPascal(value) {
  return toKebab(value).split('-').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}
// 一个检索词 → 变体：原样 + kebab + Pascal + camel（如 md-table ↔ MdTable），提高命中率。
function keywordVariants(keyword) {
  const raw = String(keyword || '').trim();
  if (!raw) return [];
  const pascal = toPascal(raw);
  const camel = pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : '';
  return uniq([raw, toKebab(raw), pascal, camel].filter(Boolean));
}

// 从一个「用到该件」的真实文件里抽调用点：命中任一变体的行（import / 使用 / 调用）+ 1 行上下文，合并相邻、截断。
function extractUsage(project, filePath, terms, textCache) {
  const file = (project?.files || []).find(item => item.path === filePath);
  if (!file) return '';
  const lines = String(readProjectText(project, file, textCache) || '').split(/\r?\n/);
  const needles = uniq((terms || []).map(term => String(term).toLowerCase())).filter(Boolean);
  const hits = [];
  lines.forEach((line, index) => {
    const low = line.toLowerCase();
    if (needles.some(needle => low.includes(needle))) hits.push(index);
  });
  if (!hits.length) return '';
  const ranges = [];
  for (const index of hits) {
    const start = Math.max(0, index - 1);
    const end = Math.min(lines.length, index + 2);
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end + 1) last.end = Math.max(last.end, end);
    else ranges.push({ start, end });
  }
  return ranges.slice(0, 6).map(range => lines.slice(range.start, range.end).join('\n')).join('\n// …\n').slice(0, 700);
}

async function runRecon(project, options = {}) {
  const { requirement = '', invoke, textCache = new Map(), log = () => {} } = options;
  if (typeof invoke !== 'function') throw new Error('runRecon requires an invoke(stage, prompt) function.');

  const structureDoc = loadStructureDoc(project);
  const prompt = buildReconPrompt(requirement, structureDoc);
  log(`实现侦察输入：${prompt.length} 字符（Structure.md ${structureDoc.length} 字符）`);
  log(`实现侦察提示词(recon):\n${prompt}`);
  const raw = await invoke('recon', prompt);
  log(`实现侦察模型返回(recon):\n${raw || '-'}`);

  const candidates = parseReconPlan(raw);
  log(`侦察候选（公共件）：${candidates.map(item => `${item.path}[${item.keywords.join('/')}]`).join('、') || '无'}`);

  const archived = new Map(loadComponentExperiences(project).map(record => [record.componentPath, record]));
  const reuse = [];
  const fresh = [];
  for (const candidate of candidates) {
    // 清单命中：直接用已有档案的使用文档，跳过本地检索（越用越快）。
    const hit = archived.get(candidate.path);
    if (hit) {
      reuse.push({ role: hit.role, path: hit.componentPath, keywords: hit.keywords, files: hit.files, usage: { path: hit.usagePath, snippet: hit.doc } });
      log(`侦察命中经验清单：${candidate.path}（跳过本地检索）`);
      continue;
    }
    // 本地：检索词扩变体，只在 src/ 内搜「谁用了它」，从真实用户文件抽调用点。
    const terms = uniq(candidate.keywords.flatMap(keywordVariants));
    const result = runDiscoveryOperation(project, { operation: 'search_text', terms, scope: { roots: ['src'] }, maxResults: 20 }, textCache);
    const ownPrefix = `${candidate.path}/`;
    const users = (result.matches || []).map(match => match.path)
      .filter(path => path !== candidate.path && !path.startsWith(ownPrefix));
    const usagePath = users[0];
    if (!usagePath) {
      log(`侦察取证：${candidate.path} → src 内未找到使用它的文件`);
      continue;
    }
    const snippet = extractUsage(project, usagePath, terms, textCache);
    if (!snippet) continue;
    reuse.push({ role: candidate.role, path: candidate.path, keywords: candidate.keywords, files: users.length, usage: { path: usagePath, snippet } });
    fresh.push({
      componentPath: candidate.path,
      name: candidate.path.split('/').filter(Boolean).pop(),
      role: candidate.role,
      keywords: candidate.keywords,
      usagePath,
      usageFiles: users.slice(0, 8), // 使用案例业务文件（验证经验是否仍成立）
      doc: snippet,
      files: users.length,
    });
    log(`侦察取证：${candidate.path} → ${users.length} 个文件在用；用法样例 ${usagePath}`);
  }

  if (fresh.length) saveComponentExperiences(project, fresh); // 新档案 upsert 进清单
  return { structureDoc, candidates, reuse };
}

module.exports = {
  buildReconPrompt,
  parseReconPlan,
  keywordVariants,
  runRecon,
};
