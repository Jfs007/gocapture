const { readProjectText } = require('../core/fs-utils');
const path = require('path');
const {
  discoveryPlanIssues,
  executeDiscoveryPlan,
} = require('./discovery-executor');
const { ensureProjectContext } = require('./project-context');
const {
  loadSkillContexts,
  loadSkillMetas,
  recordSkillVerification,
  saveCandidateSkill,
} = require('./skill-store');
const {
  compactTaskSession,
  getOrCreateTaskSession,
  updateTaskSession,
} = require('./task-session');

function parseJson(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (error) {
    }
  }
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(text.slice(objectStart, objectEnd + 1));
    } catch (error) {
    }
  }
  return null;
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return '{}';
  }
}

function projectFileSet(project) {
  return new Set((project.files || []).map(file => file.path));
}

function normalizeEvidenceItems(items, project, fallbackPurpose) {
  const files = projectFileSet(project);
  return (Array.isArray(items) ? items : [])
    .map(item => {
      if (typeof item === 'string') return { path: item, purpose: fallbackPurpose };
      return {
        path: String(item?.path || '').trim(),
        purpose: String(item?.purpose || item?.reason || fallbackPurpose || '').trim(),
      };
    })
    .filter(item => files.has(item.path));
}

function normalizeCandidateSkillForSave(candidate, project, discovery) {
  if (!candidate) return null;
  const textContext = String(candidate.context || candidate.content || candidate.description || '').trim();
  const examples = normalizeEvidenceItems(candidate.examples, project, '模型返回案例');
  const requiredEvidence = normalizeEvidenceItems(candidate.requiredEvidence, project, '基础能力证据');
  const unique = (items) => {
    const seen = new Set();
    return items.filter(item => {
      if (!item.path || seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    }).slice(0, 10);
  };
  return {
    ...candidate,
    context: textContext,
    examples: unique(examples),
    requiredEvidence: unique(requiredEvidence),
    recipes: Array.isArray(candidate.recipes) ? candidate.recipes : [],
    sourceContracts: Array.isArray(candidate.sourceContracts) ? candidate.sourceContracts : [],
    verificationChecklist: Array.isArray(candidate.verificationChecklist) ? candidate.verificationChecklist : [],
    triggerTags: Array.from(new Set((candidate.triggerTags || []).map(String).filter(Boolean))),
  };
}

function normalizePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('../')) return '';
  return normalized;
}

function projectFile(project, filePath) {
  const normalized = normalizePath(filePath);
  return (project.files || []).find(file => file.path === normalized) || null;
}

function resolveSpecifierFromFile(project, fromFile, specifier) {
  const files = projectFileSet(project);
  let base = '';
  const value = String(specifier || '').trim();
  if (!value) return '';
  if (value.startsWith('.')) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), value));
  } else if (value.startsWith('@/')) {
    base = path.posix.join('src', value.slice(2));
  } else if (value.startsWith('src/')) {
    base = value;
  } else {
    return '';
  }
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.vue', '.json'];
  const candidates = extensions.map(ext => `${base}${ext}`);
  for (const ext of extensions.slice(1)) candidates.push(`${base}/index${ext}`);
  return candidates.find(candidate => files.has(candidate)) || '';
}

function parseImportBindings(text) {
  const result = [];
  const source = String(text || '');
  const importPattern = /\bimport\s+([^'";]+?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importPattern.exec(source))) {
    const clause = match[1].trim();
    const specifier = match[2];
    const named = clause.match(/\{([\s\S]*?)\}/);
    if (named) {
      for (const item of named[1].split(',')) {
        const parts = item.trim().split(/\s+as\s+/i).map(part => part.trim()).filter(Boolean);
        if (!parts.length) continue;
        result.push({
          imported: parts[0],
          local: parts[1] || parts[0],
          specifier,
          kind: 'named-import',
        });
      }
    }
    const withoutNamed = clause.replace(/\{[\s\S]*?\}/, '').replace(/,/g, ' ').trim();
    const defaultName = withoutNamed.split(/\s+/).find(Boolean);
    if (defaultName && defaultName !== '*') {
      result.push({
        imported: 'default',
        local: defaultName,
        specifier,
        kind: 'default-import',
      });
    }
    const namespace = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (namespace) {
      result.push({
        imported: '*',
        local: namespace[1],
        specifier,
        kind: 'namespace-import',
      });
    }
  }
  return result;
}

function pascalToKebab(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function termUsageInText(term, text) {
  const value = String(term || '').trim();
  if (!value) return null;
  const source = String(text || '');
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const kebab = pascalToKebab(value);
  const usage = {
    term: value,
    symbol: new RegExp(`\\b${escaped}\\b`).test(source),
    componentTag: new RegExp(`<\\s*(?:${escaped}|${kebab})\\b`, 'i').test(source),
    call: new RegExp(`\\b${escaped}\\s*\\(`).test(source),
    propOrString: new RegExp(`['"]${escaped}['"]|['"]${kebab}['"]`, 'i').test(source),
  };
  usage.used = usage.symbol || usage.componentTag || usage.call || usage.propOrString;
  return usage;
}

function sourceLineForTerm(text, term) {
  const lines = String(text || '').split(/\r?\n/);
  const lowerTerm = String(term || '').toLowerCase();
  const kebab = pascalToKebab(term);
  const index = lines.findIndex(line => {
    const lower = line.toLowerCase();
    return lower.includes(lowerTerm) || lower.includes(kebab);
  });
  if (index < 0) return '';
  return lines[index].trim();
}

function exportedTermPattern(term) {
  const escaped = String(term || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bexport\\b[\\s\\S]{0,400}\\b${escaped}\\b`);
}

function siblingImplementationFiles(project, filePath) {
  const files = projectFileSet(project);
  const directory = path.posix.dirname(filePath);
  const ext = path.posix.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  const candidates = [
    `${base}.vue`,
    `${base}.tsx`,
    `${base}.jsx`,
    `${directory}/index.vue`,
    `${directory}/index.tsx`,
    `${directory}/index.jsx`,
  ];
  return Array.from(new Set(candidates.filter(item => item !== filePath && files.has(item))));
}

function resolveBarrelExport(project, barrelFile, term, textCache) {
  const source = projectFile(project, barrelFile);
  if (!source) return null;
  const text = readProjectText(project, source, textCache);
  const lines = String(text || '').split(/\r?\n/);
  const termPattern = new RegExp(`\\b${String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  for (const line of lines) {
    const specifier = (line.match(/\bfrom\s+['"]([^'"]+)['"]/) || [])[1];
    if (!specifier) continue;
    const isExportLine = /\bexport\b/.test(line);
    const isImportedThenExported = /\bimport\b/.test(line) && exportedTermPattern(term).test(text);
    if (!isExportLine && !isImportedThenExported) continue;
    const mentionsTerm = termPattern.test(line);
    const mentionsAll = /\bexport\s+\*/.test(line);
    const mentionsKebab = line.toLowerCase().includes(pascalToKebab(term));
    if (!mentionsTerm && !mentionsAll && !mentionsKebab) continue;
    const resolved = resolveSpecifierFromFile(project, barrelFile, specifier);
    if (resolved) {
      return {
        file: resolved,
        via: barrelFile,
        line: line.trim(),
        chain: [barrelFile, resolved],
        implementationFiles: siblingImplementationFiles(project, resolved),
      };
    }
  }
  return null;
}

function discoveryFrequencyTerms(discovery) {
  const result = [];
  for (const [id, entry] of Object.entries(discovery?.results || {})) {
    for (const stat of entry?.stats?.termStats || []) {
      if (stat.files >= 2 && stat.occurrences >= stat.files) {
        result.push({
          requestId: id,
          term: stat.term,
          files: stat.files,
          occurrences: stat.occurrences,
        });
      }
    }
  }
  const seen = new Set();
  return result
    .sort((a, b) => b.files - a.files || b.occurrences - a.occurrences || a.term.localeCompare(b.term))
    .filter(item => {
      const key = item.term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function matchesForTerm(discovery, term, project) {
  const files = projectFileSet(project);
  const result = [];
  for (const entry of Object.values(discovery?.results || {})) {
    for (const match of entry?.matches || []) {
      if (!files.has(match.path)) continue;
      if (!(match.matchedTerms || []).some(item => String(item).toLowerCase() === String(term).toLowerCase())) continue;
      result.push(match);
    }
  }
  const seen = new Set();
  return result.filter(match => {
    if (seen.has(match.path)) return false;
    seen.add(match.path);
    return true;
  });
}

function isLikelyReusableSource(filePath, examples) {
  const file = String(filePath || '');
  if (!file) return false;
  const importers = examples.filter(item => item.path !== filePath).length;
  if (importers < 2) return false;
  return !/^src\/(?:views|pages|routes)\//.test(file);
}

function excerptForTerms(project, filePath, terms, textCache, maxChars = 2400) {
  const file = projectFile(project, filePath);
  if (!file) return '';
  const text = readProjectText(project, file, textCache);
  if (String(text || '').length <= maxChars) return String(text || '');
  const lower = String(text || '').toLowerCase();
  const index = (terms || [])
    .map(term => lower.indexOf(String(term || '').toLowerCase()))
    .filter(value => value >= 0)
    .sort((a, b) => a - b)[0];
  if (index === undefined) return String(text || '').slice(0, maxChars);
  const start = Math.max(0, index - Math.floor(maxChars / 3));
  return String(text || '').slice(start, start + maxChars);
}

function compactPatternExcerpt(project, filePath, terms, textCache, maxChars = 1800) {
  const file = projectFile(project, filePath);
  if (!file) return '';
  const text = readProjectText(project, file, textCache);
  const lines = String(text || '').split(/\r?\n/);
  const lowerTerms = (terms || []).map(term => String(term || '').toLowerCase()).filter(Boolean);
  const indexes = [];
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    if (lowerTerms.some(term => lower.includes(term) || lower.includes(pascalToKebab(term)))) {
      indexes.push(index);
    }
  });
  if (!indexes.length) return String(text || '').slice(0, maxChars);
  const picked = [];
  for (const index of indexes.slice(0, 8)) {
    const start = Math.max(0, index - 4);
    const end = Math.min(lines.length, index + 10);
    picked.push({ start, end });
  }
  const merged = [];
  for (const range of picked) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + 2) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  let output = merged
    .map(range => lines.slice(range.start, range.end).join('\n'))
    .join('\n\n// ...\n\n');
  if (output.length > maxChars) output = output.slice(0, maxChars);
  return output;
}

function buildPatternSkillEvidence(project, task, discovery, textCache, log) {
  if (!discovery) return null;
  const targetFiles = (task.targets || []).map(item => item.file).filter(Boolean);
  if (!targetFiles.length) return null;
  const targetFile = targetFiles[0];
  const target = projectFile(project, targetFile);
  if (!target) return null;
  const targetText = readProjectText(project, target, textCache);
  const frequencyTerms = discoveryFrequencyTerms(discovery);
  const targetTerms = frequencyTerms
    .map(item => ({ ...item, usage: termUsageInText(item.term, targetText) }))
    .filter(item => item.usage?.used);

  if (targetTerms.length) {
    log(`经验触发器：目标文件命中高频项 ${targetTerms.map(item => `${item.term}=${item.files}文件/${item.occurrences}次`).join('、')}，开始校验来源和复用性`);
  }

  const imports = parseImportBindings(targetText);
  const evidenceByFile = new Map();
  const exampleByFile = new Map();
  const confirmedTerms = [];

  for (const item of targetTerms) {
    const importBinding = imports.find(binding => binding.local === item.term || binding.imported === item.term);
    let origin = null;
    if (importBinding) {
      const resolved = resolveSpecifierFromFile(project, targetFile, importBinding.specifier);
      if (resolved) {
        const barrel = resolveBarrelExport(project, resolved, item.term, textCache);
        origin = barrel || {
          file: resolved,
          via: importBinding.specifier,
          line: sourceLineForTerm(readProjectText(project, projectFile(project, resolved), textCache), item.term),
          chain: [targetFile, resolved],
          implementationFiles: siblingImplementationFiles(project, resolved),
        };
      }
    }

    const examples = matchesForTerm(discovery, item.term, project)
      .filter(match => match.path !== origin?.file)
      .filter(match => {
        const file = projectFile(project, match.path);
        if (!file) return false;
        const text = readProjectText(project, file, textCache);
        return !!termUsageInText(item.term, text)?.used;
      });

    if (!origin?.file) {
      log(`经验校验跳过：${item.term} 高频但无法从目标文件 import/导出链追到来源`);
      continue;
    }
    if (!isLikelyReusableSource(origin.file, examples)) {
      log(`经验校验跳过：${item.term} 来源 ${origin.file} 未形成可复用公共来源或业务案例不足`);
      continue;
    }

    confirmedTerms.push({
      term: item.term,
      files: item.files,
      occurrences: item.occurrences,
      usage: item.usage,
      origin,
      examples: examples.slice(0, 4).map(example => ({
        path: example.path,
        matchedTerms: example.matchedTerms || [],
        snippet: String(example.snippet || '').slice(0, 1600),
      })),
    });
    evidenceByFile.set(origin.file, {
      path: origin.file,
      purpose: origin.via && origin.via !== origin.file
        ? `${item.term} 来源；由 ${origin.via} 导出/引入`
        : `${item.term} 来源`,
    });
    for (const implFile of origin.implementationFiles || []) {
      evidenceByFile.set(implFile, {
        path: implFile,
        purpose: `${item.term} 真实实现文件`,
      });
    }
    if (origin.via && projectFile(project, origin.via)) {
      evidenceByFile.set(origin.via, {
        path: origin.via,
        purpose: `${item.term} 的导出入口`,
      });
    }
    for (const example of examples) {
      if (exampleByFile.size >= 6) break;
      exampleByFile.set(example.path, {
        path: example.path,
        purpose: `${item.term} 代表用法`,
      });
    }
    log(`经验校验通过：${item.term} -> ${origin.file}；业务用例 ${examples.slice(0, 4).map(example => example.path).join('、')}`);
  }

  const examples = [
    { path: targetFile, purpose: '当前目标文件中的模式用法' },
    ...Array.from(exampleByFile.values()).filter(item => item.path !== targetFile),
  ].slice(0, 3);
  const requiredEvidence = Array.from(evidenceByFile.values());
  if (confirmedTerms.length < 1 || examples.length < 2 || requiredEvidence.length < 1) {
    if (targetTerms.length) {
      log(`经验校验未通过：已确认来源 ${confirmedTerms.length} 个，业务案例 ${examples.length} 个，基础证据 ${requiredEvidence.length} 个`);
    }
    return null;
  }

  const termNames = confirmedTerms.map(item => item.term);
  const sourceFiles = Array.from(new Set(requiredEvidence.map(item => item.path)));
  return {
    pattern: {
      name: `${termNames.slice(0, 3).join(' + ')} 项目实现模式`,
      terms: termNames,
      triggerReason: `高频项 ${termNames.join('、')} 已在目标文件中使用，并能追到公共来源和多个业务用例`,
    },
    gate: {
      terms: confirmedTerms.map(item => ({
        term: item.term,
        files: item.files,
        occurrences: item.occurrences,
        origin: item.origin,
      })),
      reason: `高频项 ${termNames.join('、')} 已在目标文件中使用，并能追到公共来源和多个业务用例`,
    },
    requiredEvidence,
    examples,
    target: {
      file: targetFile,
      purpose: '触发该模式校验的目标文件，仅作为一个用法案例，不代表本次业务需求需要沉淀',
      excerpt: compactPatternExcerpt(project, targetFile, termNames, textCache, 1800),
    },
    sourceEvidence: sourceFiles.map(file => ({
      path: file,
      excerpt: compactPatternExcerpt(project, file, termNames, textCache, 1800),
    })),
    exampleEvidence: examples.map(item => ({
      path: item.path,
      purpose: item.purpose,
      excerpt: compactPatternExcerpt(project, item.path, termNames, textCache, 1600),
    })),
    confirmedTerms,
  };
}

function roughTask(body, modelItems) {
  const payload = body.searchPayload || {};
  return {
    pageUrl: payload.url || body.url || '',
    pagePath: body.pagePath || body.routeResolver?.pagePath || '',
    userRequirement: payload.userPrompt || '',
    targets: (modelItems || []).slice(0, 4).map(item => ({
      file: item.file,
      locateLevel: item.locateLevel,
      codeSnippet: item.codeSnippet || item.rawCodeSnippet || '',
      directionGuess: item.directionGuess || '',
      coarsePrompt: item.prompt || '',
      confidence: item.confidence || 0,
    })),
    selections: (payload.selectionInstructions || []).slice(0, 8),
  };
}

function targetFileContext(project, modelItems, textCache) {
  return (modelItems || []).slice(0, 4).map(item => {
    const file = (project.files || []).find(entry => entry.path === item.file);
    const text = file ? readProjectText(project, file, textCache) : '';
    return {
      path: item.file,
      mode: file ? 'full' : 'missing',
      content: String(text || ''),
      fullFileOmitted: false,
      rawChars: String(text || '').length,
    };
  });
}

function fallbackEnhancedPrompt(task) {
  const targets = task.targets.map(item => [
    `文件: ${item.file}`,
    item.codeSnippet ? `源码方向:\n${item.codeSnippet}` : '',
    item.directionGuess ? `初步方向: ${item.directionGuess}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  return [
    `任务: ${task.userRequirement || '按页面选区完成修改'}`,
    task.pageUrl ? `页面: ${task.pageUrl}` : '',
    targets,
    '实施要求:',
    '- 先重新阅读目标文件及直接相关代码，验证上面的源码方向。',
    '- 严格复用项目已有组件、请求、状态和错误处理方式。',
    '- 缺少接口字段、返回结构或调用时机时，先确认真实代码，不要臆造。',
  ].filter(Boolean).join('\n\n');
}

function buildSkillMatchPrompt(projectContext, metas, task) {
  return [
    '你负责为当前开发任务匹配项目经验。只返回 JSON 对象，不修改代码。',
    '',
    '规则：',
    '- Skill 是经验，不是硬规则；目标文件真实代码优先。',
    '- 只选择确实适用于本任务的 Skill。',
    '- 若 Skill 已覆盖实现方式，只为本次任务请求缺失事实，不要重新发现整个项目规范。',
    '- requests 必须使用白名单 operation，不得返回 shell 命令。',
    '',
    '返回格式：',
    '{"matchedSkillIds":[],"missingFacts":[],"requests":[],"discoveryNeeded":false,"domain":""}',
    '',
    `Project.md:\n${projectContext.markdown}`,
    '',
    `Skill Meta:\n${safeJson(metas)}`,
    '',
    `当前粗任务:\n${safeJson(task)}`,
  ].join('\n');
}

function buildDiscoveryPlanPrompt(projectContext, task) {
  return [
    '你负责发现当前项目完成此类任务的真实实现经验。只返回 JSON 对象。',
    '',
    '不要返回 rg/grep/find 或任何 shell 命令。',
    'requests.operation 只能使用：read_file、search_text、find_files、find_symbol、find_endpoint、find_imports、find_importers、find_related_examples。',
    '每个 request 必须严格使用以下字段：',
    '- read_file: {"operation":"read_file","scope":{"files":["src/..."]},"terms":["可选聚焦词"],"maxResults":2,"maxLinesPerResult":120,"reason":"..."}',
    '- search/find: {"operation":"search_text","scope":{"roots":["src"]},"terms":["明确检索词"],"maxResults":20,"maxLinesPerResult":20,"reason":"..."}',
    '- import: {"operation":"find_imports","target":"src/目标文件","scope":{"roots":["src"]},"maxResults":20,"maxLinesPerResult":60,"reason":"..."}',
    '禁止使用 path 代替 scope，禁止省略 search/find 操作的 terms。',
    '优先读取目标文件，再通过少量代表案例回答项目通常怎么做；不要扫描并返回整仓源码。',
    '每个请求必须说明 reason，并设置 maxResults 和 maxLinesPerResult。',
    '',
    '返回格式：',
    '{"domain":"","objective":"","questions":[],"requests":[],"expectedSkill":{"name":"","triggerTags":[]}}',
    '',
    `Project.md:\n${projectContext.markdown}`,
    '',
    `当前粗任务:\n${safeJson(task)}`,
  ].join('\n');
}

function buildDiscoveryRepairPrompt(projectContext, task, rawPlan, issues) {
  return [
    '上一份项目经验发现计划不符合协议。请修复后只返回 JSON 对象。',
    '',
    `协议问题:\n${issues.map(item => `- ${item}`).join('\n')}`,
    '',
    '硬性要求：',
    '- read_file 必须提供 scope.files。',
    '- search_text/find_files/find_symbol/find_endpoint/find_related_examples 必须提供 scope.roots 和非空 terms。',
    '- find_imports/find_importers 必须提供 target。',
    '- 不得使用 path 字段，不得输出 shell 命令。',
    '- 需要分别发现目标 UI/组件的项目用法，以及数据/API 的项目接入方式。',
    '',
    `Project.md:\n${projectContext.markdown}`,
    '',
    `当前任务:\n${safeJson(task)}`,
    '',
    `待修复计划:\n${safeJson(rawPlan)}`,
  ].join('\n');
}

function splitIdentifier(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9_-]+/)
    .map(item => item.toLowerCase())
    .filter(item => item.length >= 4)
    .filter(item => !['data', 'item', 'list', 'page', 'table', 'value'].includes(item));
}

function taskSearchAnchors(task) {
  const requirement = String(task.userRequirement || '');
  const snippets = (task.targets || []).map(item => item.codeSnippet || '').join('\n');
  const symbols = Array.from(new Set(
    (requirement.match(/\b[A-Za-z_$][A-Za-z0-9_$]{3,}\b/g) || [])
      .filter(item => /[A-Z_$]/.test(item.slice(1)) || /^(?:get|set|load|fetch|save|update|create|delete)[A-Z_]/.test(item))
  )).slice(0, 12);
  const endpoints = Array.from(new Set(requirement.match(/\/[A-Za-z0-9_./?=&:-]{3,}/g) || [])).slice(0, 8);
  const components = Array.from(new Set(
    (snippets.match(/<([a-zA-Z][\w-]*)\b/g) || []).map(item => item.slice(1))
  )).filter(item => item.includes('-') || /^[A-Z]/.test(item)).slice(0, 8);
  const identifierParts = Array.from(new Set(symbols.flatMap(splitIdentifier))).slice(0, 12);
  return { symbols, endpoints, components, identifierParts };
}

function implementationPatternTerms(project, task, textCache) {
  const requirement = String(task.userRequirement || '');
  const targetSnippets = (task.targets || []).map(item => item.codeSnippet || item.directionGuess || '').join('\n');
  const targetTexts = (task.targets || []).slice(0, 4).map(item => {
    const file = (project.files || []).find(entry => entry.path === item.file);
    return file ? readProjectText(project, file, textCache) : '';
  }).join('\n');
  const combined = [requirement, targetSnippets, targetTexts].join('\n');
  const hasTableIntent = /表格|列表|\btable\b|\blist\b/i.test(combined);
  const result = new Set();
  if (hasTableIntent) {
    for (const match of combined.matchAll(/<([A-Za-z][\w-]*(?:table|list)[\w-]*)\b/gi)) {
      result.add(match[1]);
    }
    for (const match of targetTexts.matchAll(/\b(?:Md|N|El|A|V)[A-Za-z0-9_$]*Table\b/g)) {
      result.add(match[0]);
    }
    for (const match of targetTexts.matchAll(/\buse[A-Za-z0-9_$]*Table\b/g)) {
      result.add(match[0]);
    }
    for (const match of targetTexts.matchAll(/['"]([^'"]*(?:md-table|data-table|table)[^'"]*)['"]/gi)) {
      const value = match[1].split('/').filter(Boolean).slice(-1)[0] || match[1];
      if (/table/i.test(value)) result.add(value);
    }
  }
  return Array.from(result)
    .filter(item => item.length >= 4)
    .filter(item => !/^(data|loading|pagination|columns|list|table)$/i.test(item))
    .slice(0, 16);
}

function augmentDiscoveryPlan(rawPlan, task, project, textCache) {
  const anchors = taskSearchAnchors(task);
  const patternTerms = project ? implementationPatternTerms(project, task, textCache) : [];
  const targetFiles = (task.targets || []).map(item => item.file).filter(Boolean);
  const requests = (rawPlan?.requests || []).map(request => {
    const next = { ...request };
    const existingTerms = Array.isArray(next.terms) ? next.terms.filter(Boolean) : [];
    if (!existingTerms.length) {
      if (next.operation === 'find_files') {
        next.terms = anchors.identifierParts;
      } else if (next.operation === 'find_related_examples') {
        next.terms = [...anchors.components, ...anchors.symbols].slice(0, 12);
      } else if (['search_text', 'find_symbol', 'find_endpoint'].includes(next.operation)) {
        next.terms = [...anchors.endpoints, ...anchors.symbols].slice(0, 12);
      }
    }
    return next;
  });

  const readTargets = new Set(requests
    .filter(request => request.operation === 'read_file')
    .flatMap(request => request.scope?.files || []));
  for (const file of targetFiles) {
    if (!readTargets.has(file)) {
      requests.unshift({
        id: `read-target-${requests.length + 1}`,
        operation: 'read_file',
        scope: { files: [file] },
        terms: anchors.components,
        maxResults: 1,
        maxLinesPerResult: 120,
        reason: '读取目标文件中的当前 UI 与相关实现',
      });
    }
    if (!requests.some(request => request.operation === 'find_imports' && request.target === file)) {
      requests.push({
        id: `target-imports-${requests.length + 1}`,
        operation: 'find_imports',
        target: file,
        scope: { roots: ['src'] },
        maxResults: 20,
        maxLinesPerResult: 60,
        reason: '读取目标文件直接依赖，确认 Feature API、组件和状态封装',
      });
    }
  }
  if (anchors.symbols.length && !requests.some(request =>
    request.operation === 'find_symbol'
    && (request.terms || []).some(term => anchors.symbols.includes(term)))) {
    requests.push({
      id: `task-symbol-${requests.length + 1}`,
      operation: 'find_symbol',
      scope: { roots: ['src'] },
      terms: anchors.symbols,
      maxResults: 20,
      maxLinesPerResult: 24,
      reason: '全仓确认用户明确给出的函数或符号是否已有定义和调用',
    });
  }
  if (patternTerms.length && !requests.some(request =>
    request.operation === 'find_related_examples'
    && (request.terms || []).some(term => patternTerms.includes(term)))) {
    requests.push({
      id: `pattern-frequency-${requests.length + 1}`,
      operation: 'find_related_examples',
      scope: { roots: ['src'] },
      terms: patternTerms,
      maxResults: 12,
      maxLinesPerResult: 80,
      reason: '统计并抽样项目内同类实现标识符的使用频次，用于判断是否形成项目基础经验',
    });
  }
  if (anchors.components.length && !requests.some(request => request.operation === 'find_related_examples')) {
    requests.push({
      id: `ui-examples-${requests.length + 1}`,
      operation: 'find_related_examples',
      scope: { roots: ['src'] },
      terms: anchors.components,
      maxResults: 4,
      maxLinesPerResult: 100,
      reason: '寻找当前 UI 组件在项目中的代表用法',
    });
  }
  return { ...rawPlan, requests: requests.slice(0, 8) };
}

function buildEnhancementPrompt(input) {
  return [
    '你负责把 Magnus 的粗源码定位结果增强成可交给专业 Code Agent 的精准需求提示词。只返回 JSON 对象。',
    '',
    '要求：',
    '- 不要直接修改代码。',
    '- 项目经验只用于约束实现方式，目标文件真实代码优先。',
    '- targetFiles.content 是本地已读取的完整目标文件内容，不是片段；必须基于完整文件提炼可直接执行的修改方案。',
    '- activeTask 是同一 projectRoot + 页面路径下累计的任务上下文；若包含多条 requirements，需要把它们合并成一个完整任务，而不是只处理最后一句。',
    '- 如果 activeTask.confirmedSkillIds 已存在，说明这些经验已在当前任务中确认过，应优先复用，不要重复质疑其项目级适用性；但目标文件真实代码仍优先。',
    '- enhancedPrompt 应尽量让 Code Agent 上手即可修改：指出应改的文件、应放置的位置、应复用的 import/变量/函数/组件/API 模式、实施步骤和校验点。',
    '- 不要笼统要求 Code Agent “重新完整阅读目标文件”；只有当目标文件以外的 API、hook、子组件、父组件或公共实现仍缺失时，才列出“需要继续阅读的相关文件/方向”。',
    '- 明确区分已确认事实、待验证假设和实施要求。',
    '- 不得臆造接口字段、响应结构、函数名、导入路径、状态变量或组件 API。',
    '- 禁止建议创建占位接口、猜测接口路径、猜测字段名，或发明 columns2/data2/loading2 这类实现名称。',
    '- “已确认项目经验”必须引用 discovery/matchedSkills 中真实命中的文件和代码模式；没有证据就明确写未确认。',
    '- 若 discovery.stats 显示某组实现标识符在多个文件中高频出现，并且代表案例代码模式一致，可以把它作为“项目基础经验”；不要求业务语义完全相同。',
    '- 例如表格任务中，如果 useTable、MdTable、md-table、NDataTable 等从目标文件抽取出的同类实现标识符在多个文件中稳定共现，可确认项目表格实现倾向。',
    '- 如果粗定位可能不准确，要求 Code Agent 沿直接引用链验证相关文件，不要把验证范围泛化成重读整个项目。',
    '- enhancedPrompt 必须包含任务、目标文件、目标文件内已确认上下文、已确认项目经验、实施步骤、需要继续阅读的相关文件/方向、待确认项和安全准则。',
    '- 不要在本阶段生成或保存 Skill；candidateSkill 必须返回 null。Skill 是否沉淀会由后续独立阶段基于高频门票和证据包判断。',
    '',
    '返回格式：',
    '{"enhancedPrompt":"","confirmedFacts":[],"assumptions":[],"usedSkillIds":[],"candidateSkill":null}',
    '',
    `输入上下文:\n${safeJson(input)}`,
  ].join('\n');
}

function buildSkillCandidatePrompt(input) {
  return [
    '你负责判断一组“高频触发后的项目实现模式证据”是否值得沉淀为 Magnus Skill。只返回 JSON 对象。',
    '',
    '定位：',
    '- 高频只是门票，不是结论。你必须阅读 patternCandidate 判断它是否是项目级、可复用、能指导后续同类需求的实现经验。',
    '- 不要判断本次业务需求是否可复用；本阶段只判断候选模式本身是否可沉淀。',
    '- target 只是触发候选模式校验的一个用法案例，不是要沉淀的业务需求。',
    '- Skill 应接近项目开发文档水准：说明适用场景、入口 import、核心组件/hook/工具怎么组合、实现步骤、注意事项。',
    '- context/recipes/sourceContracts/verificationChecklist 是后续进入提示词的真正经验内容，必须能直接指导同类开发。',
    '- requiredEvidence/examples 只用于存档追溯，不会作为后续提示词主体；不要把泛化搜索结果、无关 columns 文件或一次性业务页面塞进去。',
    '- 不要把本次用户需求、接口名、字段名、一次性文案写成 triggerTags。',
    '- triggerTags 只能是短标签或符号，例如 MdTable、useTable、md-table、表格、列表；不要超过 8 个。',
    '- 如果只是当前页面细节、当前业务接口、当前字段，或证据不足以指导后续同类任务，shouldSave=false。',
    '- shouldSave=true 时，candidateSkill.context 必须包含“如何使用”的具体写法，而不是空泛总结。',
    '- requiredEvidence/examples 的 path 必须来自 patternCandidate 中的真实文件，且只保留证明该模式公共来源和代表用法所必需的最小集合。',
    '',
    '返回格式：',
    '{"shouldSave":false,"reason":"","candidateSkill":null}',
    '',
    'candidateSkill 格式：',
    '{"id":"","name":"","triggerTags":[],"applicableWhen":[],"notApplicableWhen":[],"context":"","recipes":[],"sourceContracts":[],"verificationChecklist":[],"requiredEvidence":[{"path":"src/...","purpose":""}],"examples":[{"path":"src/...","purpose":""}],"confidence":"medium"}',
    '',
    'context 建议结构：',
    '## 适用场景',
    '## 标准用法',
    '## 关键文件',
    '## 实现步骤',
    '## 注意事项',
    '',
    `输入上下文:\n${safeJson(input)}`,
  ].join('\n');
}

async function invokeJson(invoke, stage, prompt, log) {
  log(`经验增强模型阶段：${stage}；提示词 ${prompt.length} 字符`);
  log(`经验增强提示词(${stage}):\n${prompt}`);
  const raw = await invoke(stage, prompt);
  log(`经验增强模型返回(${stage}):\n${raw || '-'}`);
  return { raw, parsed: parseJson(raw) };
}

async function enhanceLocatedPrompt(options) {
  const {
    project,
    body,
    modelItems,
    textCache = new Map(),
    invoke,
    log = () => {},
  } = options;
  const task = roughTask(body, modelItems);
  const fallback = fallbackEnhancedPrompt(task);
  if (!modelItems?.length || typeof invoke !== 'function') {
    return { enhancedPrompt: fallback, usedSkillIds: [], mode: 'fallback' };
  }
  const taskSession = getOrCreateTaskSession(project, task);
  const activeTask = compactTaskSession(taskSession.session);
  log(`任务上下文：${taskSession.mode === 'append' ? '复用' : '新建'}；key=${activeTask.pageKey}；需求 ${activeTask.requirements.length} 条；已确认 Skill ${activeTask.confirmedSkillIds.length} 个`);

  const initialMetas = loadSkillMetas(project);
  const matchableMetas = initialMetas.filter(meta => meta.status === 'active' || meta.status === 'needs-verification');
  const projectContext = ensureProjectContext(project, { skillMetas: initialMetas });
  log(`项目经验上下文：${projectContext.rebuilt ? '已重建' : '已复用'} Project.md；可匹配 Skill Meta ${matchableMetas.length} 个`);
  if (!projectContext.writable) log(`项目经验目录不可写，将仅在本次请求内使用：${projectContext.error || '-'}`);

  let matchedSkillIds = [];
  let taskFacts = null;
  let discovery = null;

  const reusableSkillIds = (activeTask.confirmedSkillIds || [])
    .filter(id => matchableMetas.some(meta => meta.id === id))
    .slice(0, 4);
  if (reusableSkillIds.length) {
    matchedSkillIds = reusableSkillIds;
    log(`任务上下文复用经验：${matchedSkillIds.join('、')}，跳过 skill-match`);
  } else if (matchableMetas.length) {
    const match = await invokeJson(
      invoke,
      'skill-match',
      buildSkillMatchPrompt(projectContext, matchableMetas, task),
      log
    );
    matchedSkillIds = (match.parsed?.matchedSkillIds || []).map(String).filter(Boolean).slice(0, 4);
    if (match.parsed?.requests?.length) {
      taskFacts = executeDiscoveryPlan(project, {
        domain: match.parsed.domain || 'task-facts',
        objective: '补齐当前任务事实',
        questions: match.parsed.missingFacts || [],
        requests: match.parsed.requests,
      }, textCache, log);
    }
  }

  const skills = loadSkillContexts(project, matchedSkillIds);
  if (!skills.length) {
    const planResult = await invokeJson(
      invoke,
      'experience-discovery-plan',
      buildDiscoveryPlanPrompt(projectContext, task),
      log
    );
    let discoveryPlan = planResult.parsed;
    let issues = discoveryPlanIssues(discoveryPlan);
    if (issues.length) {
      log(`经验发现计划协议校验失败：${issues.join('；')}`);
      const repaired = await invokeJson(
        invoke,
        'experience-discovery-plan-repair',
        buildDiscoveryRepairPrompt(projectContext, task, discoveryPlan, issues),
        log
      );
      discoveryPlan = repaired.parsed || discoveryPlan;
      issues = discoveryPlanIssues(discoveryPlan);
    }
    discoveryPlan = augmentDiscoveryPlan(discoveryPlan || {}, task, project, textCache);
    issues = discoveryPlanIssues(discoveryPlan);
    if (!issues.length && discoveryPlan?.requests?.length) {
      discovery = executeDiscoveryPlan(project, discoveryPlan, textCache, log);
    } else {
      log(`经验发现计划仍不可执行，本次使用目标文件与粗定位结果增强：${issues.join('；') || 'requests 为空'}`);
    }
  }

  const enhancementInput = {
    project: {
      name: project.name,
      kind: project.kind,
      stack: project.stack || [],
      overview: projectContext.markdown,
    },
    roughTask: task,
    activeTask,
    targetFiles: targetFileContext(project, modelItems, textCache),
    matchedSkills: skills,
    taskFacts,
    discovery,
  };
  const enhanced = await invokeJson(
    invoke,
    'prompt-enhancement',
    buildEnhancementPrompt(enhancementInput),
    log
  );
  const enhancedPrompt = String(enhanced.parsed?.enhancedPrompt || '').trim() || fallback;
  const usedSkillIds = (enhanced.parsed?.usedSkillIds || matchedSkillIds).map(String).filter(Boolean).slice(0, 4);

  if (usedSkillIds.length) {
    recordSkillVerification(project, usedSkillIds);
    log(`项目经验已验证：${usedSkillIds.join('、')}`);
  }
  const updatedSession = updateTaskSession(project, task, {
    targetFiles: task.targets.map(item => item.file).filter(Boolean),
    confirmedSkillIds: usedSkillIds.length ? usedSkillIds : matchedSkillIds,
    confirmedFacts: enhanced.parsed?.confirmedFacts || [],
    assumptions: enhanced.parsed?.assumptions || [],
    enhancedPrompt,
  });
  if (updatedSession) {
    log(`任务上下文已更新：需求 ${updatedSession.requirements.length} 条；Skill ${updatedSession.confirmedSkillIds.length} 个`);
  }

  let savedSkill = null;
  let rawCandidate = null;
  if (!skills.length) {
    const evidencePack = buildPatternSkillEvidence(project, task, discovery, textCache, log);
    if (evidencePack) {
      const candidateResult = await invokeJson(
        invoke,
        'skill-candidate',
        buildSkillCandidatePrompt({
          project: {
            name: project.name,
            kind: project.kind,
            stack: project.stack || [],
          },
          patternCandidate: evidencePack,
        }),
        log
      );
      if (candidateResult.parsed?.shouldSave) {
        rawCandidate = candidateResult.parsed.candidateSkill;
        log('经验候选模型：建议保存项目经验');
      } else {
        log(`经验候选模型：不保存；${candidateResult.parsed?.reason || '未给出原因'}`);
      }
    }
  }
  if (!skills.length && rawCandidate) {
    const candidate = normalizeCandidateSkillForSave({
      ...rawCandidate,
      discoverySummary: discovery?.plan?.objective || '',
    }, project, discovery);
    savedSkill = saveCandidateSkill(project, candidate);
    log(savedSkill.saved
      ? `候选经验已保存：${savedSkill.meta.id}（needs-verification）`
      : `候选经验未保存：${savedSkill.reason}`);
    if (savedSkill.saved) {
      updateTaskSession(project, task, {
        confirmedSkillIds: [savedSkill.meta.id],
      });
    }
  }

  return {
    enhancedPrompt,
    confirmedFacts: enhanced.parsed?.confirmedFacts || [],
    assumptions: enhanced.parsed?.assumptions || [],
    usedSkillIds,
    savedSkill,
    mode: skills.length ? 'skill' : discovery ? 'discovery' : 'target-only',
  };
}

module.exports = {
  enhanceLocatedPrompt,
  fallbackEnhancedPrompt,
  parseJson,
};
