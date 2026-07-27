'use strict';

const fs = require('fs');
const path = require('path');

// 结构化项目知识，写入 .gocapture/project-knowledge.json，供 consult_project_knowledge 消费。
// - frameworks:          扫描 project.stack 的框架标签
// - frameworkProfiles:   由 context7 派生并烘焙的 UI 库渲染签名（class 前缀 + DOM 签名→源码写法）
// - customClassPrefixes: 本地扫描测得的高频自定义 class 前缀（如 dc-）
// - businessDirs:        业务/视图目录
// 无自由文本；UI 库知识来自 ui-profile-deriver（context7），不再有写死的 framework-profiles。

const EXPERIENCE_DIR = '.gocapture';
const PROJECT_KNOWLEDGE_FILE = 'project-knowledge.json';
const KNOWLEDGE_VERSION = 2;

const SOURCE_EXT = new Set(['.vue', '.jsx', '.tsx', '.html', '.htm']);
const GENERIC_PREFIXES = new Set(['text-', 'col-', 'row-', 'is-', 'has-', 'fa-', 'icon-', 'mt-', 'mb-', 'ml-', 'mr-', 'p-', 'm-']);
// 常见 UI 框架前缀兜底：即使 context7 派生失败（frameworkProfiles 为空），也别把它们误当自定义前缀。
const KNOWN_FRAMEWORK_PREFIXES = new Set(['ivu-', 'el-', 'ant-', 'van-', 'arco-', 'semi-', 'nut-', 'mu-', 'chakra-', 't-']);
const BUSINESS_ROOT_CANDIDATES = ['src/b-components', 'src/components', 'src/view', 'src/views', 'src/pages'];

const MAX_SCAN_FILES = 200;
const MAX_FILE_BYTES = 60000;
const CUSTOM_PREFIX_MIN_OCCURRENCES = 8;
const MAX_CUSTOM_PREFIXES = 5;

function knowledgePath(project) {
  return path.join(project.path, EXPERIENCE_DIR, PROJECT_KNOWLEDGE_FILE);
}

// 从烘焙的 frameworkProfiles 里取全部框架 class 前缀，用于扫描自定义前缀时排除。
function frameworkPrefixSet(frameworkProfiles) {
  const set = new Set();
  for (const profile of Array.isArray(frameworkProfiles) ? frameworkProfiles : []) {
    for (const entry of Array.isArray(profile.classPrefixes) ? profile.classPrefixes : []) {
      if (entry && entry.prefix) set.add(String(entry.prefix));
    }
  }
  return set;
}

// 本地扫描源码 class 属性，统计非框架/非通用的高频前缀 —— 测量出的自定义前缀（如 dc-）。
function detectCustomClassPrefixes(project, excludePrefixes) {
  const files = (Array.isArray(project.files) ? project.files : [])
    .map(file => String(file.path || ''))
    .filter(rel => SOURCE_EXT.has(path.extname(rel)))
    .slice(0, MAX_SCAN_FILES);
  const counts = new Map();
  const classRe = /class(?:Name)?\s*=\s*"([^"]*)"/g;
  for (const rel of files) {
    let text = '';
    try {
      text = fs.readFileSync(path.join(project.path, rel), 'utf8').slice(0, MAX_FILE_BYTES);
    } catch (error) {
      continue;
    }
    let match;
    while ((match = classRe.exec(text))) {
      for (const cls of match[1].split(/\s+/)) {
        const idx = cls.indexOf('-');
        if (idx <= 0) continue;
        const prefix = cls.slice(0, idx + 1);
        if (!/^[a-z]{2,5}-$/.test(prefix)) continue;
        if (excludePrefixes.has(prefix) || GENERIC_PREFIXES.has(prefix) || KNOWN_FRAMEWORK_PREFIXES.has(prefix)) continue;
        counts.set(prefix, (counts.get(prefix) || 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, occurrences]) => occurrences >= CUSTOM_PREFIX_MIN_OCCURRENCES)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CUSTOM_PREFIXES)
    .map(([prefix, occurrences]) => ({
      prefix,
      occurrences,
      action: 'downweight',
      reason: '本地扫描到的高频非框架 class 前缀，疑似项目自定义组件库',
    }));
}

function detectBusinessDirs(project) {
  const files = (Array.isArray(project.files) ? project.files : []).map(file => String(file.path || ''));
  return BUSINESS_ROOT_CANDIDATES.filter(root => files.some(p => p === root || p.startsWith(`${root}/`)));
}

function buildProjectKnowledge(project, options = {}) {
  const frameworkProfiles = Array.isArray(options.frameworkProfiles) ? options.frameworkProfiles : [];
  return {
    version: KNOWLEDGE_VERSION,
    generatedAt: new Date().toISOString(),
    frameworks: Array.isArray(project.stack) ? project.stack.map(String) : [],
    frameworkProfiles,
    customClassPrefixes: detectCustomClassPrefixes(project, frameworkPrefixSet(frameworkProfiles)),
    businessDirs: detectBusinessDirs(project),
  };
}

function writeProjectKnowledge(project, options = {}) {
  const knowledge = buildProjectKnowledge(project, options);
  const file = knowledgePath(project);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporary, `${JSON.stringify(knowledge, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, file);
    return { writable: true, path: file, knowledge };
  } catch (error) {
    return { writable: false, path: file, knowledge, error: error.message };
  }
}

function readProjectKnowledge(project) {
  try {
    return JSON.parse(fs.readFileSync(knowledgePath(project), 'utf8'));
  } catch (error) {
    return null;
  }
}

module.exports = {
  PROJECT_KNOWLEDGE_FILE,
  knowledgePath,
  buildProjectKnowledge,
  writeProjectKnowledge,
  readProjectKnowledge,
  detectCustomClassPrefixes,
  detectBusinessDirs,
};
