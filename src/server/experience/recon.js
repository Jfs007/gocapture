'use strict';

// 实现侦察（精简版）：LLM 只干一件事——看「用户需求 + Structure.md」，挑出需求里明确提到的能力可能对应的
// 「项目公共文件/目录」+ 检索词。其余全是本地的：把检索词扩成变体(md-table / MdTable)提高命中，搜哪些文件用了它，
// 再从用它的真实文件里抽出用法片段。LLM 不做检索、不做实现规划、不判断证据够不够。

const { readProjectText } = require('../core/fs-utils');
const { uniq } = require('../utils');
const { runDiscoveryOperation } = require('./discovery-executor');
const { loadStructureDoc } = require('./project-structure');
const { loadComponentExperiences, saveComponentExperiences } = require('./component-experience');
const { extractUsageDoc, rankUsageFiles, scoreUsagePath } = require('./usage-doc');

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
    '7. keywords 只能来自真实结构中的文件名、目录名或路径片段；不能来自用户需求原文，不能输出“列表/表格/筛选/时间/店铺/操作人”这类需求词。',
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

function normalizeStructureText(structureDoc) {
  return String(structureDoc || '').toLowerCase();
}

function isStructureKeyword(keyword, structureDoc) {
  const value = String(keyword || '').trim();
  if (!value) return false;
  return normalizeStructureText(structureDoc).includes(value.toLowerCase());
}

function sanitizeReconCandidates(candidates, structureDoc) {
  return (candidates || [])
    .map(candidate => {
      const pathParts = candidate.path.split('/').filter(Boolean);
      const basename = pathParts[pathParts.length - 1] || '';
      const keywords = uniq([
        ...candidate.keywords.filter(keyword => isStructureKeyword(keyword, structureDoc)),
        basename,
        candidate.path,
      ]).filter(keyword => isStructureKeyword(keyword, structureDoc));
      return { ...candidate, keywords: keywords.slice(0, 3) };
    })
    .filter(candidate => candidate.path && candidate.keywords.length);
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

function candidateTerms(candidate) {
  const basename = candidate.path.split('/').filter(Boolean).pop() || '';
  return uniq([basename, candidate.path, ...candidate.keywords].flatMap(keywordVariants));
}

function buildUsageDocPrompt(candidate, usageDoc) {
  return [
    '你是项目经验示例裁剪器。根据本地证据包，输出一个公共能力的最小完整用法文档。',
    '',
    '规则：',
    '1. 不写本次用户需求的实现方案。',
    '2. 不编造证据包里没有的组件、hook、接口、字段或路径。',
    '3. 保留能指导同类开发的最小完整用法：import、调用点、数据/hook、核心配置、刷新/分页/事件约定。',
    '4. 删除一次性业务噪音；如果某段是业务示例字段，可以改成占位说明，但不要改写项目 API 名。',
    '5. 只返回 Markdown 文档，不要返回 JSON，不要解释裁剪过程。',
    '',
    `公共能力：${candidate.path}`,
    `角色：${candidate.role}`,
    `关键词：${candidate.keywords.join(', ')}`,
    '',
    `本地证据包：\n${JSON.stringify(usageDoc?.evidence || usageDoc, null, 2)}`,
  ].join('\n');
}

function normalizeProjectPath(project, value) {
  let text = String(value || '').trim().replace(/\\/g, '/');
  if (!text) return '';
  const root = String(project?.path || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (root && text.startsWith(`${root}/`)) text = text.slice(root.length + 1);
  return text.replace(/^\.?\//, '').replace(/\/+$/, '');
}

function projectHasFile(project, value) {
  const filePath = normalizeProjectPath(project, value);
  if (!filePath) return false;
  return (project?.files || []).some(file => file.path === filePath);
}

function validateArchivedExperience(project, record) {
  if (!record?.componentPath) return { usable: false, reason: '缺少 componentPath' };
  if (!String(record?.doc || '').trim()) return { usable: false, reason: '缺少 doc.md' };

  const evidenceFiles = uniq([record.usagePath, ...(record.usageFiles || [])]
    .map(file => normalizeProjectPath(project, file))
    .filter(Boolean));
  if (!evidenceFiles.length) return { usable: false, reason: '缺少 evidence.json 使用文件' };

  const existingEvidenceFiles = evidenceFiles.filter(file => projectHasFile(project, file));
  if (!existingEvidenceFiles.length) {
    return { usable: false, reason: `evidence 使用文件不存在：${evidenceFiles.join('、')}` };
  }
  return { usable: true, existingEvidenceFiles };
}

function usableUsageMarkdown(value, candidate) {
  const text = String(value || '').trim().replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (!text || text.length < 80) return '';
  const low = text.toLowerCase();
  const terms = candidateTerms(candidate).map(term => term.toLowerCase());
  if (!terms.some(term => low.includes(term))) return '';
  return text.endsWith('\n') ? text : `${text}\n`;
}

async function buildUsageSnippet({ candidate, usageDoc, invoke, log }) {
  if (!usageDoc) return '';
  const prompt = buildUsageDocPrompt(candidate, usageDoc);
  log(`侦察用法裁剪输入：${prompt.length} 字符；公共件=${candidate.path}；示例=${usageDoc.usageFile || '-'}`);
  log(`侦察用法裁剪提示词(recon-usage):\n${prompt}`);
  try {
    const raw = await invoke('recon-usage', prompt);
    log(`侦察用法裁剪模型返回(recon-usage):\n${raw || '-'}`);
    const markdown = usableUsageMarkdown(raw, candidate);
    if (markdown) return markdown;
    log(`侦察用法裁剪结果不可用：${candidate.path}（回退本地证据 Markdown）`);
  } catch (error) {
    log(`侦察用法裁剪失败：${candidate.path}；${error.message || error}（回退本地证据 Markdown）`);
  }
  return usageDoc.markdown || '';
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

  const rawCandidates = parseReconPlan(raw);
  const candidates = sanitizeReconCandidates(rawCandidates, structureDoc);
  log(`侦察候选（公共件）：${candidates.map(item => `${item.path}[${item.keywords.join('/')}]`).join('、') || '无'}`);
  const dropped = rawCandidates
    .map(item => {
      const kept = new Set((candidates.find(candidate => candidate.path === item.path)?.keywords || []));
      const removed = item.keywords.filter(keyword => !kept.has(keyword));
      return removed.length ? `${item.path}[${removed.join('/')}]` : '';
    })
    .filter(Boolean);
  if (dropped.length) log(`侦察候选关键词过滤：已丢弃非目录结构关键词 ${dropped.join('、')}`);

  const archived = new Map(loadComponentExperiences(project).map(record => [record.componentPath, record]));
  const reuse = [];
  const fresh = [];
  for (const candidate of candidates) {
    // 清单命中：直接用已有档案的使用文档，跳过本地检索（越用越快）。
    const hit = archived.get(candidate.path);
    const archivedState = validateArchivedExperience(project, hit);
    if (archivedState.usable) {
      reuse.push({ role: hit.role, path: hit.componentPath, keywords: hit.keywords, files: hit.files, usage: { path: hit.usagePath, snippet: hit.doc } });
      log(`侦察命中经验清单：${candidate.path}（evidence 已验证：${archivedState.existingEvidenceFiles.join('、')}；跳过本地检索）`);
      continue;
    } else if (hit) {
      log(`侦察经验清单失效：${candidate.path}；${archivedState.reason}（重新本地取证）`);
    }
    // 本地：检索词扩变体，只在 src/ 内搜「谁用了它」，从真实用户文件抽调用点。
    const terms = candidateTerms(candidate);
    const result = runDiscoveryOperation(project, { operation: 'search_text', terms, scope: { roots: ['src'] }, maxResults: 20 }, textCache);
    const users = rankUsageFiles((result.matches || []).map(match => match.path), candidate.path, project);
    log(`侦察取证候选文件：${candidate.path} → ${users.slice(0, 8).join('、') || '无'}`);
    const usagePath = users[0];
    if (!usagePath) {
      log(`侦察取证：${candidate.path} → src 内未找到使用它的文件`);
      continue;
    }
    const usageDoc = extractUsageDoc(project, {
      capabilityPath: candidate.path,
      usagePath,
      terms,
      textCache,
    });
    const snippet = await buildUsageSnippet({ candidate, usageDoc, invoke, log })
      || extractUsage(project, usagePath, terms, textCache);
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
