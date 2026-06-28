const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPERIENCE_DIR = '.magnus-project';
const PROJECT_META_FILE = 'project-meta.json';
const PROJECT_DOC_FILE = 'Project.md';
const PROJECT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PROJECT_CONTEXT_VERSION = 4;

const IMPORTANT_PATH_PATTERNS = [
  /^package\.json$/,
  /^(vite|webpack|next|nuxt)\.config\./,
  /^vue\.config\./,
  /^src\/utils\/http\//,
  /^src\/api\//,
  /^src\/components\//,
  /^src\/hooks\//,
  /^src\/store\//,
];

function experienceRoot(project) {
  return path.join(project.path, EXPERIENCE_DIR);
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    return '';
  }
}

function safeJson(file) {
  try {
    return JSON.parse(safeRead(file));
  } catch (error) {
    return null;
  }
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, file);
}

function projectFingerprint(project) {
  const digest = crypto.createHash('sha1');
  const important = (project.files || [])
    .filter(file => IMPORTANT_PATH_PATTERNS.some(pattern => pattern.test(file.path)))
    .sort((a, b) => a.path.localeCompare(b.path));
  for (const file of important) {
    digest.update(`${file.path}:${file.size || 0}:${file.mtimeMs || 0}\n`);
  }
  return digest.digest('hex');
}

function topLevelDirectories(project, root) {
  const directories = new Set();
  for (const file of project.files || []) {
    if (!file.path.startsWith(`${root}/`)) continue;
    const relative = file.path.slice(root.length + 1);
    if (!relative.includes('/')) continue;
    const first = relative.split('/')[0];
    if (first) directories.add(`${root}/${first}`);
  }
  return Array.from(directories).sort();
}

function directoryDescription(directory) {
  const name = directory.split('/').pop();
  const known = {
    api: '业务 API 与请求函数',
    components: '公共或业务组件',
    hooks: '可复用组合逻辑',
    layouts: '页面布局',
    pages: '业务页面',
    router: '路由定义',
    store: '全局状态',
    stores: '全局状态',
    utils: '基础工具与客户端封装',
    views: '业务页面',
  };
  return known[name] || '项目源码目录';
}

function projectDocument(project, skillMetas = []) {
  const directories = topLevelDirectories(project, 'src');
  const routeFiles = (project.files || [])
    .map(file => file.path)
    .filter(file => /(^|\/)(router|routes)(\/|\.|$)|(^|\/)config\/routes\./i.test(file))
    .slice(0, 20);
  const requestFiles = (project.files || [])
    .map(file => file.path)
    .filter(file => /(^|\/)(api|apis|services?|request|requests|http)(\/|\.|$)/i.test(file))
    .slice(0, 20);
  const featureApiCount = (project.files || [])
    .filter(file => /^src\/(?:views?|pages?)\/.+\/api\.(?:js|ts)$/.test(file.path))
    .length;
  return [
    '# Project Overview',
    '',
    '## 技术栈',
    ...(project.stack || []).map(item => `- ${item}`),
    '',
    '## 项目信息',
    `- 类型：${project.kind || 'unknown'}`,
    `- 文件数：${project.fileCount || (project.files || []).length}`,
    '',
    '## 目录概览',
    ...directories.map(item => `- ${item}：${directoryDescription(item)}`),
    ...(featureApiCount ? [`- src/views/**/api.ts：发现 ${featureApiCount} 个 Feature 私有 API 文件`] : []),
    '',
    '## 源码定位入口',
    ...(routeFiles.length
      ? routeFiles.map(file => `- 路由：${file}`)
      : ['- 路由：未发现明确的路由文件']),
    ...(requestFiles.length
      ? requestFiles.map(file => `- 请求/API：${file}`)
      : ['- 请求/API：未发现明确的请求目录']),
    '',
    '## 已发现经验',
    ...(skillMetas.length
      ? skillMetas.map(meta => `- ${meta.id}：${meta.name || meta.id}（${meta.status || 'unknown'}）`)
      : ['- 暂无']),
    '',
    '## 说明',
    '- Skill 是已验证或待验证的项目经验，不是不可覆盖的硬规则。',
    '- 当前目标文件和本次任务的真实源码证据优先于 Skill。',
    '',
  ].join('\n');
}

function projectSearchHints(project) {
  return {
    sourceRoots: topLevelDirectories(project, 'src'),
    routeFiles: (project.files || [])
      .map(file => file.path)
      .filter(file => /(^|\/)(router|routes)(\/|\.|$)|(^|\/)config\/routes\./i.test(file))
      .slice(0, 40),
    requestFiles: (project.files || [])
      .map(file => file.path)
      .filter(file => /(^|\/)(api|apis|services?|request|requests|http)(\/|\.|$)/i.test(file))
      .slice(0, 40),
  };
}

function projectTechnicalStackMarkdown(project, markdown = '') {
  const source = String(markdown || '');
  const match = source.match(/## 技术栈\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  if (match) {
    return `## 技术栈\n${match[1].trim()}`.trim();
  }
  const stack = project.stack || [];
  return [
    '## 技术栈',
    ...(stack.length ? stack.map(item => `- ${item}`) : ['- unknown']),
  ].join('\n');
}

function projectContextSummary(project, context) {
  if (!context) return null;
  return {
    path: path.join(context.root, PROJECT_DOC_FILE),
    markdown: context.markdown,
    technicalStackMarkdown: projectTechnicalStackMarkdown(project, context.markdown),
    fingerprint: context.meta?.fingerprint || '',
    generatedAt: context.meta?.generatedAt || '',
    rebuilt: !!context.rebuilt,
    writable: context.writable !== false,
    error: context.error || '',
    searchHints: projectSearchHints(project),
  };
}

function bindProjectContext(project, options = {}) {
  const context = ensureProjectContext(project, options);
  project.context = projectContextSummary(project, context);
  return project;
}

function ensureProjectContext(project, options = {}) {
  const root = experienceRoot(project);
  const metaFile = path.join(root, PROJECT_META_FILE);
  const docFile = path.join(root, PROJECT_DOC_FILE);
  const fingerprint = projectFingerprint(project);
  const current = safeJson(metaFile);
  const generatedAt = Date.parse(current?.generatedAt || '');
  const fresh = current?.version === PROJECT_CONTEXT_VERSION
    && current?.fingerprint === fingerprint
    && Number.isFinite(generatedAt)
    && Date.now() - generatedAt < PROJECT_MAX_AGE_MS
    && fs.existsSync(docFile);

  if (fresh && !options.force) {
    return {
      root,
      meta: current,
      markdown: safeRead(docFile),
      rebuilt: false,
      writable: true,
    };
  }

  const meta = {
    version: PROJECT_CONTEXT_VERSION,
    projectName: project.name,
    projectKind: project.kind,
    stack: project.stack || [],
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
  const markdown = projectDocument(project, options.skillMetas || []);
  try {
    atomicWrite(metaFile, `${JSON.stringify(meta, null, 2)}\n`);
    atomicWrite(docFile, markdown);
    return { root, meta, markdown, rebuilt: true, writable: true };
  } catch (error) {
    return {
      root,
      meta,
      markdown,
      rebuilt: true,
      writable: false,
      error: error.message || String(error),
    };
  }
}

function refreshProjectDocument(project, skillMetas) {
  const context = ensureProjectContext(project, { skillMetas });
  if (!context.writable) return context;
  try {
    atomicWrite(path.join(context.root, PROJECT_DOC_FILE), projectDocument(project, skillMetas));
  } catch (error) {
    return { ...context, writable: false, error: error.message || String(error) };
  }
  return context;
}

module.exports = {
  EXPERIENCE_DIR,
  atomicWrite,
  bindProjectContext,
  ensureProjectContext,
  experienceRoot,
  projectFingerprint,
  projectTechnicalStackMarkdown,
  refreshProjectDocument,
  safeJson,
  safeRead,
};
