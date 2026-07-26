const path = require('path');
const { z } = require('zod');
const { isTextFile, readProjectText } = require('../core/fs-utils');
const { runAgentLlmTask } = require('../agent-host/llm-adapter');
const { writeProjectContext } = require('./project-context');
const { ensureStructureDoc } = require('./project-structure');
const { writeProjectKnowledge, readProjectKnowledge } = require('./project-knowledge');
const { deriveUiProfiles } = require('./ui-profile-deriver');
const { appendKnowledgeLog } = require('./knowledge-log');

const MAX_CONFIG_CHARS = 12000;
const MAX_FILE_LIST = 420;
const MAX_VERIFY_FILES = 40;
const MAX_VERIFY_SNIPPETS = 5;

const projectDiscoverySchema = z.object({
  summary: z.string(),
  technicalStack: z.array(z.string()),
  uiFrameworkCandidates: z.array(z.object({
    name: z.string(),
    evidence: z.array(z.string()),
    verificationKeywords: z.array(z.string()),
  })),
  verificationSearches: z.array(z.object({
    id: z.string(),
    keywords: z.array(z.string()),
    mode: z.enum(['all', 'any']),
    purpose: z.string(),
  })),
  businessFeatureDirs: z.array(z.string()),
  uncertainty: z.array(z.string()),
}).meta({ title: 'magnus_project_discovery', description: 'Submit inferred project facts and local verification searches.' });

function appendLog(logs, text) {
  if (!Array.isArray(logs) || !text) return;
  logs.push(text);
  if (typeof logs.onAppend === 'function') logs.onAppend(text, logs.slice());
}

function importantConfigFiles(project) {
  const patterns = [
    /^package\.json$/,
    /^(vite|webpack|next|nuxt)\.config\./,
    /^vue\.config\./,
    /^tsconfig\.json$/,
    /^jsconfig\.json$/,
    /^babel\.config\./,
    /^postcss\.config\./,
    /^tailwind\.config\./,
    /^src\/main\.(?:js|ts|jsx|tsx)$/,
    /^src\/App\.vue$/,
    /^src\/app\.(?:jsx|tsx)$/,
    /^src\/index\.(?:js|ts|jsx|tsx)$/,
    /(^|\/)(router|routes)(\/|\.|$)/,
  ];
  return (project.files || [])
    .map(file => file.path)
    .filter(file => patterns.some(pattern => pattern.test(file)))
    .slice(0, 40);
}

function directorySummary(project) {
  const counts = new Map();
  for (const file of project.files || []) {
    const parts = String(file.path || '').split('/');
    const key = parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([dir, count]) => ({ dir, count }));
}

function readConfigFacts(project) {
  const cache = new Map();
  return importantConfigFiles(project).map(filePath => {
    const file = (project.files || []).find(item => item.path === filePath);
    const raw = file ? readProjectText(project, file, cache) : '';
    const content = raw.length > MAX_CONFIG_CHARS ? `${raw.slice(0, MAX_CONFIG_CHARS)}\n...<truncated>` : raw;
    return { path: filePath, content };
  }).filter(item => item.content);
}

function projectFacts(project) {
  return {
    name: project.name,
    fileCount: project.fileCount || (project.files || []).length,
    directories: directorySummary(project),
    files: (project.files || []).map(file => file.path).slice(0, MAX_FILE_LIST),
    configFiles: readConfigFacts(project),
  };
}

function buildDiscoveryPrompt(project) {
  return [
    '你是 Project Interpreter。',
    '你不能访问文件系统，只能阅读输入中的 package.json、配置文件、入口文件片段和目录结构。',
    '你的任务是推测项目快照，并提出需要本地验证的关键词。',
    '',
    '规则：',
    '- 不要使用内置框架知识表，不要编造源码中没有证据的结论。',
    '- 技术栈、UI 框架、路由、状态管理、请求库都必须从输入配置或入口文件中推断。',
    '- 如果怀疑存在 UI 框架，请输出用于本地验证的关键词，例如包名、样式文件名、入口 import 片段、可能的 class 前缀候选。',
    '- class 前缀只能作为待验证关键词，不能在第一轮当成已确认事实。',
    '- businessFeatureDirs：顶层源码目录里，那些「其下每一项装的是一个具体业务页面/功能」的目录名（相对 src、只列顶层）。判据是内容性质——装的是一次性业务功能，而非可复用组件/hook/工具/基建/状态/路由；按项目实际结构判断，不要凭目录叫什么名字来定。',
    '- 按照给定结构化响应格式返回。',
    '',
    '项目事实：',
    JSON.stringify(projectFacts(project), null, 2),
  ].join('\n');
}

function searchVerification(project, searches) {
  const normalizedSearches = (Array.isArray(searches) ? searches : [])
    .map((search, index) => ({
      id: String(search?.id || `search-${index + 1}`),
      keywords: (Array.isArray(search?.keywords) ? search.keywords : [])
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 10),
      mode: search?.mode === 'any' ? 'any' : 'all',
      purpose: String(search?.purpose || ''),
    }))
    .filter(search => search.keywords.length);
  const files = (project.files || [])
    .filter(file => isTextFile(file.path))
    .filter(file => !/(^|\/)(node_modules|dist|build|coverage)\//.test(file.path))
    .slice(0, 5000);
  const cache = new Map();
  return normalizedSearches.map(search => {
    const matches = [];
    for (const file of files) {
      if (matches.length >= MAX_VERIFY_FILES) break;
      const text = readProjectText(project, file, cache);
      if (!text) continue;
      const checks = search.keywords.map(keyword => text.includes(keyword));
      const matched = search.mode === 'any' ? checks.some(Boolean) : checks.every(Boolean);
      if (!matched) continue;
      const snippets = search.keywords
        .flatMap(keyword => excerptMatches(text, keyword))
        .slice(0, MAX_VERIFY_SNIPPETS);
      matches.push({
        path: file.path,
        ext: path.extname(file.path).toLowerCase(),
        isStyle: /\.(?:css|less|s[ac]ss|styl)$/.test(file.path),
        snippets,
      });
    }
    return { ...search, matches };
  });
}

function excerptMatches(text, keyword) {
  const result = [];
  const value = String(keyword || '');
  if (!value) return result;
  let offset = 0;
  while (result.length < 2) {
    const index = text.indexOf(value, offset);
    if (index === -1) break;
    const start = Math.max(0, index - 90);
    const end = Math.min(text.length, index + value.length + 140);
    result.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
    offset = index + value.length;
  }
  return result;
}

function buildFinalPrompt(project, discovery, verification) {
  return [
    '你是 Project Interpreter。',
    '你现在会收到第一轮项目推测和本地真实检索验证结果。',
    '请生成精简 Project.md，用于后续源码定位和 DOM Agent 提示词。必须只写经过配置或本地验证支持的结论；不确定的内容写入“不确定/待验证”。',
    '',
    'Project.md 是给 LLM 读的短事实清单，不是目录结构文档。目录骨架由 Structure.md 负责，Project.md 不要重复目录树。',
    '写作要求：',
    '- 每行一个可检索的事实/结论，用短语和符号，不写解释性叙述、背景铺垫、过渡句或礼貌用语。',
    '- 能用「前缀 / 路径 / 包名 / 符号」表达就不要用句子；不解释每个结论来自哪里。',
    '- 不重复、不空话；不要列完整文件树、目录清单、业务页面列表或 Experience 清单。',
    '- 没有证据的章节直接写「- 无」或归入「不确定/待验证」。',
    '',
    '只允许包含这些 Markdown 章节：',
    '- # Project.md',
    '- ## 技术栈',
    '- ## 项目约定',
    '- ## UI 与 DOM class 判断',
    '- ## 不确定/待验证',
    '',
    '技术栈要求：',
    '- 只列结论，不解释来源。',
    '- 每个「组件库/UI 框架」结论都必须带上它在 DOM 里的 class 前缀（从本地验证到的高频 class 推断），格式：`库名 (前缀-*)`；只验证到库、没验证到前缀时写 `库名 (前缀待验证)`。这对第三方 UI 框架和项目自定义组件库同样适用。',
    '',
    '项目约定要求：',
    '- 只写源码定位需要的约定：源码根、路径别名、路由入口、状态入口、API 入口、公共组件入口、公共 hooks 入口。',
    '- 不展开每个目录下面有哪些文件。',
    '',
    'UI 与 DOM class 判断要求：',
    '- 如果本地验证到了样式文件、入口 import 或高频 class 前缀，逐个列出「建议 Planner 优先跳过/降权的 class 前缀」（用本地真实验证到的前缀，不要套用通用知识）。',
    '- 如果本地验证不足，不要写已确认前缀。',
    '- 不要输出 JSON，只输出 Markdown。',
    '',
    '项目基础信息：',
    JSON.stringify({
      name: project.name,
      fileCount: project.fileCount || (project.files || []).length,
    }, null, 2),
    '',
    '第一轮推测：',
    JSON.stringify(discovery, null, 2),
    '',
    '本地验证结果：',
    JSON.stringify(verification, null, 2),
  ].join('\n');
}

async function interpretProject(project, rawAdapter, options = {}) {
  const logs = [];
  if (typeof options.onLog === 'function') logs.onAppend = options.onLog;
  if (project?.context?.interpreted && project?.context?.markdown) {
    appendLog(logs, 'Project Interpreter: 已存在未过期 Project.md，跳过解释器');
    // 复用缓存时若结构化知识缺失则补写一次（context7 派生 UI 签名，失败退化为空）。
    try {
      if (!readProjectKnowledge(project)) {
        const frameworkProfiles = await deriveUiProfiles(project, {
          adapter: rawAdapter,
          signal: options.signal,
          onLog: log => appendLog(logs, log),
        });
        const knowledge = writeProjectKnowledge(project, { frameworkProfiles });
        const summary = `project-knowledge.json（缓存补写）：${knowledge.writable ? '已写入' : '写入失败'}；frameworkProfiles=${frameworkProfiles.length}；自定义前缀=${knowledge.knowledge.customClassPrefixes.map(p => p.prefix).join('、') || '无'}${knowledge.error ? `；error=${knowledge.error}` : ''}`;
        appendLog(logs, summary);
        appendKnowledgeLog(project, summary);
      }
    } catch (error) {
      appendLog(logs, `project-knowledge.json 补写异常：${error.message}`);
    }
    return {
      project,
      context: project.context,
      discovery: null,
      verification: [],
      logs,
      skipped: true,
    };
  }
  appendLog(logs, 'Project Interpreter: 开始读取 package.json、配置文件和目录结构');
  const discoveryPrompt = buildDiscoveryPrompt(project);
  appendLog(logs, `Project Interpreter 第一轮输入：${discoveryPrompt.length} 字符`);
  const discoveryResult = await runAgentLlmTask(rawAdapter, discoveryPrompt, project, {
    signal: options.signal,
    onLog: log => appendLog(logs, log),
    systemPrompt: '你是项目解释器。按照给定结构化响应格式返回项目推测与验证计划。',
    responseFormat: projectDiscoverySchema,
  });
  appendLog(logs, `Project Interpreter 第一轮输出：${discoveryResult.rawText.length} 字符`);
  const discovery = discoveryResult.structuredResponse;
  if (!discovery) throw new Error('Project Interpreter 未返回结构化项目推测。');
  // 业务功能目录由 LLM 断定（非写死）；据此生成「复用骨架」Structure.md（扫盘，排除业务区）。
  const businessFeatureDirs = (Array.isArray(discovery.businessFeatureDirs) ? discovery.businessFeatureDirs : [])
    .map(item => String(item || '').trim().replace(/^src\//, '').replace(/\/+$/, ''))
    .filter(Boolean);
  const structure = ensureStructureDoc(project, businessFeatureDirs);
  appendLog(logs, `Structure.md：复用骨架已生成（业务功能目录=${businessFeatureDirs.join('、') || '无'}）；${structure.writable ? '已写入 .magnus/Structure.md' : '仅内存（目录不可写）'}`);
  const verification = searchVerification(project, discovery.verificationSearches);
  appendLog(logs, `Project Interpreter 本地验证：执行 ${verification.length} 组检索`);
  const finalPrompt = buildFinalPrompt(project, discovery, verification);
  appendLog(logs, `Project Interpreter 第二轮输入：${finalPrompt.length} 字符`);
  const finalResult = await runAgentLlmTask(rawAdapter, finalPrompt, project, {
    signal: options.signal,
    onLog: log => appendLog(logs, log),
    systemPrompt: '你是项目解释器，只输出 Project.md Markdown。',
  });
  appendLog(logs, `Project Interpreter 第二轮输出：${finalResult.rawText.length} 字符`);
  const context = writeProjectContext(project, finalResult.rawText, {
    meta: {
      interpreterAdapter: discoveryResult.adapter,
      verificationCount: verification.length,
    },
  });
  const interpretedStack = technicalStackItems(context.markdown);
  project.stack = interpretedStack;
  project.stackText = interpretedStack.join(' / ');
  // 结构化项目知识：context7 派生 UI 签名（失败退化为空）+ 确定性测量，供 consult_project_knowledge 消费。
  try {
    const frameworkProfiles = await deriveUiProfiles(project, {
      adapter: rawAdapter,
      signal: options.signal,
      onLog: log => appendLog(logs, log),
    });
    const knowledge = writeProjectKnowledge(project, { frameworkProfiles });
    const summary = `project-knowledge.json：${knowledge.writable ? '已写入' : '写入失败'}；框架=${knowledge.knowledge.frameworks.join('、') || '无'}；UI签名=${frameworkProfiles.length}；自定义前缀=${knowledge.knowledge.customClassPrefixes.map(p => p.prefix).join('、') || '无'}${knowledge.error ? `；error=${knowledge.error}` : ''}`;
    appendLog(logs, summary);
    appendKnowledgeLog(project, summary);
  } catch (error) {
    appendLog(logs, `project-knowledge.json 写入异常：${error.message}`);
  }
  project.context = {
    path: path.join(context.root, 'Project.md'),
    markdown: context.markdown,
    technicalStackMarkdown: technicalStackMarkdown(context.markdown),
    fingerprint: context.meta?.fingerprint || '',
    generatedAt: context.meta?.generatedAt || '',
    interpreted: true,
    rebuilt: true,
    writable: true,
    error: '',
    searchHints: {},
  };
  return {
    project,
    context,
    discovery,
    verification,
    logs,
  };
}

function technicalStackMarkdown(markdown) {
  const match = String(markdown || '').match(/## 技术栈\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  return match ? `## 技术栈\n${match[1].trim()}` : '## 技术栈\n- unknown';
}

function technicalStackItems(markdown) {
  const match = String(markdown || '').match(/## 技术栈\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean)
    .filter(item => item !== 'unknown');
}

module.exports = {
  interpretProject,
  projectFacts,
  searchVerification,
};
