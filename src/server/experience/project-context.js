const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPERIENCE_DIR = '.magnus-project';
const PROJECT_META_FILE = 'project-meta.json';
const PROJECT_DOC_FILE = 'Project.md';
const PROJECT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PROJECT_CONTEXT_VERSION = 6;

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

function experienceSection(experienceMetas = []) {
  return [
    '## 已发现经验',
    ...(experienceMetas.length
      ? experienceMetas.map(meta => `- ${meta.id}：${meta.name || meta.id}（${meta.status || 'unknown'}）`)
      : ['- 暂无']),
    '',
    '## 说明',
    '- Experience 是已验证或待验证的项目经验，不是不可覆盖的硬规则。',
    '- 当前目标文件和本次任务的真实源码证据优先于 Experience。',
    '',
  ];
}

function projectDocument(project, experienceMetas = [], interpretedMarkdown = '') {
  const interpreted = String(interpretedMarkdown || '').trim();
  if (interpreted) {
    return [
      interpreted,
      '',
      ...experienceSection(experienceMetas),
    ].join('\n');
  }
  return [
    '# Project Overview',
    '',
    '## 状态',
    '- Project Interpreter 尚未运行；当前 Project.md 不提供项目技术栈或 UI 框架结论。',
    '- 绑定项目后应由模型读取 package.json、项目结构和配置文件生成项目快照。',
    '',
    '## 项目信息',
    `- 文件数：${project.fileCount || (project.files || []).length}`,
    `- 本地扫描类型：${project.kind || 'unknown'}`,
    '',
    ...experienceSection(experienceMetas),
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
  if (!match) return '## 技术栈\n- unknown';
  const fromMarkdown = match[1]
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
  const stack = Array.from(new Set(fromMarkdown));
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
    interpreted: !!context.meta?.interpreted,
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
    interpreted: !!options.interpretedMarkdown,
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
  const markdown = projectDocument(project, options.experienceMetas || [], options.interpretedMarkdown || '');
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

function writeProjectContext(project, markdown, options = {}) {
  const root = experienceRoot(project);
  const fingerprint = projectFingerprint(project);
  const meta = {
    version: PROJECT_CONTEXT_VERSION,
    projectName: project.name,
    projectKind: project.kind,
    interpreted: true,
    fingerprint,
    generatedAt: new Date().toISOString(),
    ...(options.meta || {}),
  };
  const content = projectDocument(project, options.experienceMetas || [], markdown);
  atomicWrite(path.join(root, PROJECT_META_FILE), `${JSON.stringify(meta, null, 2)}\n`);
  atomicWrite(path.join(root, PROJECT_DOC_FILE), content);
  return {
    root,
    meta,
    markdown: content,
    rebuilt: true,
    writable: true,
  };
}

function refreshProjectDocument(project, experienceMetas) {
  const context = ensureProjectContext(project, { experienceMetas });
  if (!context.writable) return context;
  try {
    const current = safeRead(path.join(context.root, PROJECT_DOC_FILE));
    const withoutExperienceSection = current.split(/\n## 已发现经验\n/)[0].trim();
    atomicWrite(path.join(context.root, PROJECT_DOC_FILE), projectDocument(project, experienceMetas, withoutExperienceSection));
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
  writeProjectContext,
};
