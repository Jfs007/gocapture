const { readProjectText } = require('../core/fs-utils');
const path = require('path');
const { ensureProjectContext } = require('./project-context');
const {
  loadExperienceContexts,
  loadExperienceMetas,
  recordExperienceVerification,
  saveCandidateExperience,
} = require('./experience-store');
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

function normalizeCandidateExperienceForSave(candidate, project, discovery) {
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

function buildPatternExperienceEvidence(project, task, discovery, textCache, log) {
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
      alignment: item.scopeAlignment || 'approximate',   // 该 codeSnippet 与选区 DOM 的对齐置信度
      directionGuess: item.directionGuess || '',
      coarsePrompt: item.prompt || '',
      confidence: item.confidence || 0,
    })),
    // 优先用「原始选区 DOM 快照」（扩区前抓取，含 tag/文案/class/父级列 data-col-key/邻域）——
    // 这是判断「用户到底选了哪个节点」的第一依据；没有时才退回指令文本。
    selections: (Array.isArray(body.originSelections) && body.originSelections.length
      ? body.originSelections
      : (payload.selectionInstructions || [])).slice(0, 8),
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
    item.codeSnippet ? `粗定位源码:\n${item.codeSnippet}` : '',
    item.directionGuess ? `初步方向: ${item.directionGuess}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  return [
    `任务: ${task.userRequirement || '按页面选区完成修改'}`,
    task.pageUrl ? `页面: ${task.pageUrl}` : '',
    targets,
    '实施要求:',
    '- 上面的粗定位源码来自页面选区定位，是本次修改的优先检查位置。',
    '- 先在目标文件中验证该源码片段是否对应页面选区；若匹配，围绕该片段完成修改。',
    '- 如果验证发现该片段不匹配，再沿相邻渲染块、直接引用链或同一列/同一区域重新定位。',
    '- 严格复用项目已有组件、请求、状态和错误处理方式。',
    '- 缺少接口字段、返回结构或调用时机时，先确认真实代码，不要臆造。',
  ].filter(Boolean).join('\n\n');
}

function toExperienceId(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text;
}

function normalizeExperienceIds(values) {
  return (values || []).map(toExperienceId).filter(Boolean);
}

function buildExperienceMatchPrompt(projectContext, metas, task) {
  return [
    '你负责为当前开发任务匹配 Experience（项目经验）。只返回 JSON 对象，不修改代码。',
    '',
    '规则：',
    '- Experience 是经验，不是硬规则；目标文件真实代码优先。',
    '- 只选择确实适用于本任务的 Experience。',
    '- 若 Experience 已覆盖实现方式，只为本次任务请求缺失事实，不要重新发现整个项目规范。',
    '- requests 必须使用白名单 operation，不得返回 shell 命令。',
    '',
    '返回格式：',
    '{"matchedExperienceIds":[],"missingFacts":[],"requests":[],"discoveryNeeded":false,"domain":""}',
    '',
    `Project.md:\n${projectContext.markdown}`,
    '',
    `Experience Meta:\n${safeJson(metas)}`,
    '',
    `当前粗任务:\n${safeJson(task)}`,
  ].join('\n');
}

function roughSourceAnchors(value) {
  const stop = new Set([
    'const', 'return', 'render', 'style', 'class', 'value', 'false', 'true',
    'size', 'type', 'text', 'primary', 'font', 'color', 'div', 'row', 'item',
    'status', 'action', 'click',
  ]);
  return Array.from(new Set(String(value || '').match(/\b[A-Za-z_$][\w$]{3,}\b/g) || []))
    .filter(item => !stop.has(item.toLowerCase()))
    .slice(0, 16);
}

function enhancedPromptMatchesRoughSource(task, enhancedPrompt) {
  const prompt = String(enhancedPrompt || '');
  const targets = (task.targets || [])
    .map(item => ({
      file: item.file,
      anchors: roughSourceAnchors(item.codeSnippet || item.rawCodeSnippet || ''),
    }))
    .filter(item => item.anchors.length >= 3);
  if (!targets.length) return true;
  return targets.some(item => {
    const matched = item.anchors.filter(anchor => prompt.includes(anchor));
    return matched.length >= Math.min(2, item.anchors.length);
  });
}

// 精简喂给变更规划的 discovery：避免「又多又重」。
//  - 目标文件已在 targetFiles 完整提供 → 从 discovery 里剔除，去重复；
//  - 某条检索命中文件数过多（通用词/框架组件，如 n-button 命中 80+ 文件）→ 判为噪音，略去其匹配；
//  - 跨请求按 path 去重，封顶文件数与单片段长度。
//  仅用于变更规划输入；Experience 沉淀仍用全量 discovery。
// 变更规划阶段：把「定位到的源码 + 用户需求 + 项目经验」增强成一份结构化「修改计划」JSON。
// 在 runChangePlanWithTools 的 tool-capable 循环里产出：模型可先按需调用工具取真实依据，再给最终计划。
function buildChangePlanPrompt(input) {
  return [
    '你负责把 Magnus 粗定位到的源码块 + 用户在页面上的选区，翻译成一份可直接落地的「结构化修改计划」。只返回 JSON 对象。',
    '',
    '核心：用户只会给「选中某个 DOM + 一句话意图」这种毛坯输入（如选中一个价格、说“删除”）。',
    '你的首要工作是「读懂选区、把它对应到源码里的具体节点」，再把需求用源码语义讲清楚——这一步用户不会替你做，正是你的价值。',
    '',
    '第一步 · 理解选区并对应到源码节点（写入 selectionUnderstanding）：',
    '- roughTask.selections 是用户真正选中的原始 DOM，保留了结构：tag / 可见文案 / style 样式(颜色/字号等) / 判别性属性 / container 所在容器(如列的 data-col-key 值) / 邻域兄弟。',
    '- 可见文案常是运行时值（如页面 ¥3.5 对应源码 `¥${expressCost}`），**不要按字面找**；要用「所在容器 + 在兄弟中的第几个 + 样式(颜色/字号) + 语义」这些结构特征，把选区对应到 roughTask.targets[].codeSnippet 这个源码块里的**具体那个节点**。',
    '- selectionUnderstanding 用一句话讲清：选的是什么、对应源码哪个节点（引用真实符号/变量，如「cost 列第二行灰色价格 → 渲染 expressCost 的那个 h(\'div\',{color:#999})」）。',
    '',
    '第二步 · 用源码语义表达需求：不要回显「删除 ¥3.5」这种页面话；按第一步的对应关系，用源码术语说清改动',
    '（如「删除 cost 列 render 中渲染 expressCost 的那个 h(\'div\') 节点，保留 itemCost 那行与 action 查看按钮」）。',
    '',
    '第三步 · 产出计划：',
    '- roughTask.targets[].codeSnippet 是「粗定位源码块」（选区大致所在的那一列/那一块，**不一定是精确节点**），作用是把你限定在正确区块内；精确到哪个节点由你在第一步对齐得出。若块里根本没有选区对应的节点、或对不齐 → 写 openQuestions，绝不改成相邻/兄弟节点。',
    '- targetFiles.content（完整文件）用于确认真实符号、判断连带影响。',
    '- 项目经验(matchedExperiences)/发现证据(discovery) 只用于约束「应复用哪些项目模式/组件/hook/API」；无真实证据不写。',
    '- 不得臆造接口字段、响应结构、函数名、导入路径、状态变量或组件 API。',
    '- 连带影响(affected) 基于真实代码判断（类型定义、调用方、props/emits、样式、i18n、测试）；缺证据放 openQuestions。',
    '- 只规划与本次需求直接相关的改动，不顺带重构。',
    '',
    '字段说明：',
    '- changePlan.selectionUnderstanding：第一步的结论（选区 → 源码节点的对应，引用真实符号）。',
    '- changePlan.summary：一句源码语义的话说明本次改动。',
    '- changePlan.targets[]：{file, anchor, line, whatToChange(源码语义级：改哪个节点/符号), why}。',
    '- changePlan.affected[]：{file, reason}，连带影响的文件与原因。',
    '- changePlan.reusePatterns[]：应复用的项目模式/组件/hook/API（引用真实证据）。',
    '- changePlan.risks[] / verification[] / openQuestions[]：风险 / 如何验证 / 需用户确认的点。',
    '- candidateExperience 必须返回 null。',
    '',
    '返回格式：',
    '{"changePlan":{"selectionUnderstanding":"","summary":"","targets":[{"file":"","anchor":"","line":0,"whatToChange":"","why":""}],"affected":[{"file":"","reason":""}],"reusePatterns":[],"risks":[],"verification":[],"openQuestions":[]},"confirmedFacts":[],"assumptions":[],"usedExperienceIds":[],"candidateExperience":null}',
    '',
    `输入上下文:\n${safeJson(input)}`,
  ].join('\n');
}

// 规范化模型返回的 changePlan（防缺字段/类型错）。
function normalizeChangePlan(raw) {
  const plan = raw && typeof raw === 'object' ? raw : {};
  const planText = value => {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    if (Array.isArray(value)) return value.map(planText).filter(Boolean).join('；');
    if (typeof value === 'object') {
      const preferred = [
        'text',
        'title',
        'description',
        'reason',
        'question',
        'content',
        'message',
        'risk',
        'verification',
        'expected',
        'action',
        'value',
        'label',
      ];
      for (const key of preferred) {
        const text = planText(value[key]);
        if (text) return text;
      }
      return Object.entries(value)
        .map(([key, item]) => {
          const text = planText(item);
          return text ? `${key}: ${text}` : '';
        })
        .filter(Boolean)
        .join('；');
    }
    return '';
  };
  const strList = value => (Array.isArray(value) ? value : []).map(item => planText(item)).filter(Boolean).slice(0, 20);
  return {
    selectionUnderstanding: planText(plan.selectionUnderstanding),
    summary: planText(plan.summary),
    targets: (Array.isArray(plan.targets) ? plan.targets : []).slice(0, 20).map(item => ({
      file: planText(item?.file),
      anchor: planText(item?.anchor),
      line: Math.max(0, Number(item?.line || 0)),
      whatToChange: planText(item?.whatToChange),
      why: planText(item?.why),
    })).filter(item => item.file || item.whatToChange),
    affected: (Array.isArray(plan.affected) ? plan.affected : []).slice(0, 20).map(item => ({
      file: planText(item?.file),
      reason: planText(item?.reason),
    })).filter(item => item.file),
    reusePatterns: strList(plan.reusePatterns),
    risks: strList(plan.risks),
    verification: strList(plan.verification),
    openQuestions: strList(plan.openQuestions),
  };
}

// 把结构化 changePlan 派生成一段可复制文本（保证旧的「复制提示词」UX 不断）。
function changePlanToText(changePlan, task) {
  if (!changePlan || !changePlan.summary && !changePlan.targets.length && !changePlan.selectionUnderstanding) return '';
  const lines = [];
  lines.push(`# 修改计划：${changePlan.summary || task?.userRequirement || ''}`.trim());
  if (changePlan.selectionUnderstanding) {
    lines.push('', '## 选区理解', `- ${changePlan.selectionUnderstanding}`);
  }
  if (changePlan.targets.length) {
    lines.push('', '## 改动点');
    for (const target of changePlan.targets) {
      const loc = target.line ? `${target.file}:${target.line}` : target.file;
      lines.push(`- ${loc}${target.anchor ? `（锚点：${target.anchor}）` : ''}`);
      if (target.whatToChange) lines.push(`  改什么：${target.whatToChange}`);
      if (target.why) lines.push(`  为什么：${target.why}`);
    }
  }
  const section = (title, items) => {
    if (!items.length) return;
    lines.push('', `## ${title}`);
    for (const item of items) lines.push(`- ${typeof item === 'string' ? item : `${item.file}：${item.reason}`}`);
  };
  section('连带影响', changePlan.affected);
  section('可复用模式', changePlan.reusePatterns);
  section('风险', changePlan.risks);
  section('验证', changePlan.verification);
  section('待确认', changePlan.openQuestions);
  return lines.join('\n').trim();
}

// 变更计划护栏：计划必须引用定位源码的核心锚点，否则可能改判到同文件其它相似块 → 回退。
function changePlanMatchesRoughSource(task, changePlan) {
  return enhancedPromptMatchesRoughSource(task, safeJson(changePlan));
}

function buildExperienceCandidatePrompt(input) {
  return [
    '你负责判断一组“高频触发后的项目实现模式证据”是否值得沉淀为 Magnus Experience。只返回 JSON 对象。',
    '',
    '定位：',
    '- 高频只是门票，不是结论。你必须阅读 patternCandidate 判断它是否是项目级、可复用、能指导后续同类需求的实现经验。',
    '- 不要判断本次业务需求是否可复用；本阶段只判断候选模式本身是否可沉淀。',
    '- target 只是触发候选模式校验的一个用法案例，不是要沉淀的业务需求。',
    '- Experience 应接近项目开发文档水准：说明适用场景、入口 import、核心组件/hook/工具怎么组合、实现步骤、注意事项。',
    '- context/recipes/sourceContracts/verificationChecklist 是后续进入提示词的真正经验内容，必须能直接指导同类开发。',
    '- requiredEvidence/examples 只用于存档追溯，不会作为后续提示词主体；不要把泛化搜索结果、无关 columns 文件或一次性业务页面塞进去。',
    '- 不要把本次用户需求、接口名、字段名、一次性文案写成 triggerTags。',
    '- triggerTags 只能是短标签或符号，例如 MdTable、useTable、md-table、表格、列表；不要超过 8 个。',
    '- 如果只是当前页面细节、当前业务接口、当前字段，或证据不足以指导后续同类任务，shouldSave=false。',
    '- shouldSave=true 时，candidateExperience.context 必须包含“如何使用”的具体写法，而不是空泛总结。',
    '- requiredEvidence/examples 的 path 必须来自 patternCandidate 中的真实文件，且只保留证明该模式公共来源和代表用法所必需的最小集合。',
    '',
    '返回格式：',
    '{"shouldSave":false,"reason":"","candidateExperience":null}',
    '',
    'candidateExperience 格式：',
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

function truncate(value, max) {
  const text = String(value == null ? '' : value);
  return text.length > max ? `${text.slice(0, max)}…（已截断）` : text;
}

function compactToolSchema(schema) {
  const value = schema && typeof schema === 'object' ? schema : {};
  const properties = value.properties && typeof value.properties === 'object' ? value.properties : {};
  const compactProperties = {};
  for (const [key, prop] of Object.entries(properties).slice(0, 16)) {
    compactProperties[key] = {
      type: prop?.type || 'unknown',
      description: truncate(prop?.description || prop?.title || '', 120),
      enum: Array.isArray(prop?.enum) ? prop.enum.slice(0, 12) : undefined,
    };
  }
  return {
    type: value.type || 'object',
    required: Array.isArray(value.required) ? value.required.slice(0, 16) : [],
    properties: compactProperties,
  };
}

function compactToolResult(result) {
  if (typeof result === 'string') return result;
  if (Array.isArray(result?.content)) {
    return result.content.map(item => {
      if (typeof item === 'string') return item;
      if (item?.type === 'text') return item.text || '';
      return JSON.stringify(item);
    }).filter(Boolean).join('\n\n');
  }
  return JSON.stringify(result);
}

function selectChangePlanTools(tools, options = {}) {
  const allowedSources = new Set(options.allowedSources || ['builtin', 'mcp', 'skill']);
  const blockedProviders = new Set(options.blockedProviders || ['builtin.experience']);
  const blockedCategories = new Set(options.blockedCategories || ['experience']);
  return (tools || []).filter(tool => {
    if (blockedProviders.has(tool.providerId)) return false;
    if (blockedCategories.has(tool.category)) return false;
    if (!allowedSources.has(tool.source || 'unknown')) return false;
    if (options.readOnlyOnly && tool.access !== 'read' && tool.access !== 'external') return false;
    return true;
  });
}

// 工具是拔插的、与链路无关：任何一次 LLM 调用都能看到当前注册的全部工具（project-crud + MCP + skills），
// 需要时先调用工具取真实信息（如读源码、查外部系统、取项目经验），再产出结构化结果。
function buildAgentToolsSection(tools) {
  const lines = tools.slice(0, 40).map(tool => {
    const desc = truncate(tool.description || tool.title || '', 160);
    const schema = truncate(JSON.stringify(compactToolSchema(tool.inputSchema)), 800);
    return [
      `- ${tool.name}${tool.source ? ` [${tool.source}]` : ''}${desc ? `：${desc}` : ''}`,
      `  inputSchema: ${schema}`,
    ].join('\n');
  });
  return [
    '## 可用工具（拔插，按需调用；先取真实信息，再产出计划）',
    '在产出 changePlan 之前，你可以调用下列工具收集真实依据。根据工具的 source/name/description/inputSchema 判断用途：builtin 工具用于读取/检索本地源码，mcp 工具用于外部服务能力（例如文档、设计稿、远端仓库、工单、知识库等），skill 工具用于项目或用户安装的专用能力。不要编造工具名，不要假设某个 MCP 一定存在。',
    ...lines,
    '',
    '协议（严格遵守其一，不要混用）：',
    '- 需要调用工具：只返回 {"toolCalls":[{"id":"t1","tool":"<工具名>","input":{...}}]}（可一次多个）。',
    '- 信息足够，产出最终计划：返回原格式 {"changePlan":{...},"confirmedFacts":[],"assumptions":[],"usedExperienceIds":[],"candidateExperience":null}。',
  ].join('\n');
}

function formatToolObservation(observation) {
  const input = truncate(JSON.stringify(observation.input || {}), 1000);
  const body = observation.ok
    ? truncate(compactToolResult(observation.result), observation.source === 'mcp' ? 8000 : 4000)
    : `错误：${observation.error}`;
  return [
    `### ${observation.tool}${observation.ok ? '' : '（失败）'}`,
    `input: ${input}`,
    'result:',
    body,
  ].join('\n');
}

async function executeToolWithRetry(executeTool, project, call, context, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const output = await executeTool(project, call, context);
      return { output, attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    }
  }
  throw lastError;
}

// change-plan 走「tool-capable 循环」：模型可在产计划前调用当前场景允许的工具（项目源码、MCP 文档、Skills），取完再给最终计划。
async function runChangePlanWithTools({ project, invoke, input, log, textCache, maxTurns = 4, toolRuntime = null }) {
  const basePrompt = buildChangePlanPrompt(input);
  let tools = [];
  let executeTool = null;
  // 工具运行时由调用方注入（agent-host 的 { listTools, executeTool }），experience 不再反向 require agent-host——
  // 这样打断了 registry → experience-tools → prompt-enhancer 的跨层循环依赖。无注入则退回无工具模式。
  if (toolRuntime && typeof toolRuntime.listTools === 'function' && typeof toolRuntime.executeTool === 'function') {
    tools = selectChangePlanTools(toolRuntime.listTools(), { readOnlyOnly: true }); // 排除经验工具/写工具，防递归和副作用
    executeTool = toolRuntime.executeTool;
  } else {
    log('未注入工具运行时，change-plan 退回无工具模式');
  }
  const observations = [];
  if (!tools.length || typeof executeTool !== 'function') {
    const single = await invokeJson(invoke, 'change-plan', basePrompt, log);
    return { ...single, observations };
  }
  log(`change-plan 可用工具 ${tools.length} 个：${tools.map(tool => tool.name).join('、')}`);
  const mcpTools = tools.filter(tool => tool.source === 'mcp');
  if (mcpTools.length) {
    log(`change-plan 可用 MCP 工具 ${mcpTools.length} 个：${mcpTools.map(tool => tool.name).join('、')}`);
  }

  const toolsSection = buildAgentToolsSection(tools);
  let last = { raw: '', parsed: null };
  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const prompt = [
      basePrompt,
      toolsSection,
      observations.length ? `## 已取得的工具结果（产出计划的真实依据）\n${observations.map(formatToolObservation).join('\n\n')}` : '',
      turn >= maxTurns ? '（已达工具调用上限，请直接产出最终 changePlan，不要再调用工具。）' : '',
    ].filter(Boolean).join('\n\n');
    last = await invokeJson(invoke, turn === 1 ? 'change-plan' : `change-plan-turn-${turn}`, prompt, log);
    const calls = Array.isArray(last.parsed?.toolCalls) ? last.parsed.toolCalls : [];
    if (turn >= maxTurns || !calls.length) return { ...last, observations };
    for (const call of calls.slice(0, 5)) {
      const name = String(call.tool || call.name || '');
      try {
        const toolInput = call.input || call.arguments || {};
        log(`change-plan 工具调用：${name}；input=${truncate(JSON.stringify(toolInput), 500)}`);
        const { output, attempt } = await executeToolWithRetry(executeTool, project, { tool: name, input: toolInput }, {
          textCache,
          allowedTools: tools.map(tool => tool.name),
          readOnlyOnly: true,
        }, 1);
        const compactedResult = compactToolResult(output.result);
        observations.push({
          tool: name,
          source: output.providerId && output.providerId.startsWith('mcp.') ? 'mcp' : output.providerId,
          input: toolInput,
          ok: true,
          result: output.result,
        });
        log(`change-plan 工具调用：${name} ✓${attempt ? `（重试 ${attempt} 次后成功）` : ''}；结果 ${compactedResult.length} 字符`);
      } catch (error) {
        observations.push({
          tool: name,
          input: call.input || call.arguments || {},
          ok: false,
          error: error.message || String(error),
        });
        log(`change-plan 工具调用：${name} ✗ ${error.message || error}`);
      }
    }
    if (observations.length) {
      log(`change-plan 工具结果已写入下一轮上下文：${observations.map(obs => obs.tool).join('、')}`);
    }
  }
  return { ...last, observations };
}

// 从 tool-capable 循环的观测里，重建「经验沉淀」需要的 discovery 结构（find_related_examples/search_text 的 stats+matches）。
function discoveryFromObservations(observations) {
  const entries = (observations || [])
    .filter(obs => obs.ok && obs.result && (obs.result.stats || obs.result.matches))
    .map((obs, index) => [`obs-${index}`, {
      operation: obs.result.operation || obs.tool,
      stats: obs.result.stats || null,
      matches: Array.isArray(obs.result.matches) ? obs.result.matches : [],
    }]);
  if (!entries.length) return null;
  return { plan: { objective: '' }, results: Object.fromEntries(entries) };
}

async function enhanceLocatedPrompt(options) {
  const {
    project,
    body,
    modelItems,
    textCache = new Map(),
    invoke,
    log = () => {},
    toolRuntime = null,
  } = options;
  const task = roughTask(body, modelItems);
  const fallback = fallbackEnhancedPrompt(task);
  if (!modelItems?.length || typeof invoke !== 'function') {
    return { enhancedPrompt: fallback, usedExperienceIds: [], mode: 'fallback' };
  }
  const taskSession = getOrCreateTaskSession(project, task);
  const activeTask = compactTaskSession(taskSession.session);
  const activeExperienceIds = normalizeExperienceIds(activeTask.confirmedExperienceIds || []);
  log(`任务上下文：${taskSession.mode === 'append' ? '复用' : '新建'}；key=${activeTask.pageKey}；需求 ${activeTask.requirements.length} 条；已确认 Experience ${activeExperienceIds.length} 个`);

  const initialMetas = loadExperienceMetas(project);
  const matchableMetas = initialMetas.filter(meta => meta.status === 'active' || meta.status === 'needs-verification');
  const projectContext = ensureProjectContext(project, { experienceMetas: initialMetas });
  log(`项目经验上下文：${projectContext.rebuilt ? '已重建' : '已复用'} Project.md；可匹配 Experience Meta ${matchableMetas.length} 个`);
  if (!projectContext.writable) log(`项目经验目录不可写，将仅在本次请求内使用：${projectContext.error || '-'}`);

  let matchedExperienceIds = [];

  const reusableExperienceIds = (activeExperienceIds || [])
    .filter(id => matchableMetas.some(meta => meta.id === id))
    .slice(0, 4);
  if (reusableExperienceIds.length) {
    matchedExperienceIds = reusableExperienceIds;
    log(`任务上下文复用 Experience：${matchedExperienceIds.join('、')}，跳过 experience-match`);
  } else if (matchableMetas.length) {
    const match = await invokeJson(
      invoke,
      'experience-match',
      buildExperienceMatchPrompt(projectContext, matchableMetas, task),
      log
    );
    matchedExperienceIds = normalizeExperienceIds(match.parsed?.matchedExperienceIds || []).slice(0, 4);
  }

  const experiences = loadExperienceContexts(project, matchedExperienceIds);

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
    matchedExperiences: experiences,
  };
  // 变更规划阶段：tool-capable 循环——模型自己按需调用工具（project-crud 读源码/搜索/找引用 + MCP 查文档 + skills）
  // 取真实信息后再产出计划。这一步取代了旧的「discovery-plan → 固定操作执行器」（那是 project-crud 工具的重复实现）。
  const enhanced = await runChangePlanWithTools({
    project,
    invoke,
    input: enhancementInput,
    log,
    textCache,
    toolRuntime,
  });
  // 经验沉淀的证据：来自循环里模型真实调用的 find_related_examples/search_text 等工具的观测。
  const discovery = discoveryFromObservations(enhanced.observations);
  let changePlan = normalizeChangePlan(enhanced.parsed?.changePlan);
  let usedExperienceIds = normalizeExperienceIds(enhanced.parsed?.usedExperienceIds || matchedExperienceIds).slice(0, 4);
  const hasPlan = !!(changePlan.summary || changePlan.targets.length);
  if (hasPlan && !changePlanMatchesRoughSource(task, changePlan)) {
    log('变更规划被回退：计划未引用粗定位源码核心锚点，可能改判到同文件其它相似代码');
    changePlan = normalizeChangePlan(null);
    usedExperienceIds = matchedExperienceIds;
  }
  // 由 changePlan 派生一段可复制文本，旧的「复制提示词」UX 仍可用；无有效计划则回退。
  const enhancedPrompt = changePlanToText(changePlan, task) || fallback;

  if (usedExperienceIds.length) {
    recordExperienceVerification(project, usedExperienceIds);
    log(`Experience 已验证：${usedExperienceIds.join('、')}`);
  }
  const updatedSession = updateTaskSession(project, task, {
    targetFiles: task.targets.map(item => item.file).filter(Boolean),
    confirmedExperienceIds: usedExperienceIds.length ? usedExperienceIds : matchedExperienceIds,
    confirmedFacts: enhanced.parsed?.confirmedFacts || [],
    assumptions: enhanced.parsed?.assumptions || [],
    enhancedPrompt,
  });
  if (updatedSession) {
    log(`任务上下文已更新：需求 ${updatedSession.requirements.length} 条；Experience ${(updatedSession.confirmedExperienceIds || []).length} 个`);
  }

  let savedExperience = null;
  let rawCandidate = null;
  if (!experiences.length) {
    const evidencePack = buildPatternExperienceEvidence(project, task, discovery, textCache, log);
    if (evidencePack) {
      const candidateResult = await invokeJson(
        invoke,
        'experience-candidate',
        buildExperienceCandidatePrompt({
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
        rawCandidate = candidateResult.parsed.candidateExperience;
        log('经验候选模型：建议保存项目经验');
      } else {
        log(`经验候选模型：不保存；${candidateResult.parsed?.reason || '未给出原因'}`);
      }
    }
  }
  if (!experiences.length && rawCandidate) {
    const candidate = normalizeCandidateExperienceForSave({
      ...rawCandidate,
      discoverySummary: discovery?.plan?.objective || '',
    }, project, discovery);
    savedExperience = saveCandidateExperience(project, candidate);
    log(savedExperience.saved
      ? `候选经验已保存：${savedExperience.meta.id}（needs-verification）`
      : `候选经验未保存：${savedExperience.reason}`);
    if (savedExperience.saved) {
      updateTaskSession(project, task, {
        confirmedExperienceIds: [savedExperience.meta.id],
      });
    }
  }

  return {
    changePlan,
    enhancedPrompt,
    confirmedFacts: enhanced.parsed?.confirmedFacts || [],
    assumptions: enhanced.parsed?.assumptions || [],
    usedExperienceIds,
    savedExperience,
    mode: experiences.length ? 'experience' : discovery ? 'discovery' : 'target-only',
  };
}

module.exports = {
  enhanceLocatedPrompt,
  fallbackEnhancedPrompt,
  normalizeChangePlan,
  changePlanToText,
  changePlanMatchesRoughSource,
  roughTask,
  buildChangePlanPrompt,
  runChangePlanWithTools,
  parseJson,
};
