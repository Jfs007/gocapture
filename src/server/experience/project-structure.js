'use strict';

// Structure.md：项目「复用骨架」的紧凑目录图，扫盘生成（非 LLM），像 Project.md 一样 init 时算一次、之后复用。
// 只留 Project Interpreter 确认的复用骨架。Planning Agent 需要先例时通过 Recon tools 自行调查。

const path = require('path');
const { experienceRoot, atomicWrite, safeRead } = require('./project-context');

const STRUCTURE_DOC_FILE = 'Structure.md';

function projectPaths(project) {
  return (project?.files || []).map(file => file.path).filter(Boolean);
}

// dir 的直属子项：{ dirs:[], files:[] }（dir='' 表示仓库根）。
function immediateChildren(paths, dir) {
  const prefix = dir ? `${dir}/` : '';
  const dirs = new Set();
  const files = [];
  for (const full of paths) {
    if (dir && !full.startsWith(prefix)) continue;
    const rest = full.slice(prefix.length);
    if (!rest) continue;
    const slash = rest.indexOf('/');
    if (slash === -1) files.push(rest);
    else dirs.add(rest.slice(0, slash));
  }
  return { dirs: Array.from(dirs).sort(), files: files.sort() };
}

function isDir(paths, dirPath) {
  const prefix = `${dirPath}/`;
  return paths.some(full => full.startsWith(prefix));
}

// 渲染一个子项：文件 → 原名；目录 → name/ 或 name/{直属子项…}（子项数 ≤ cap 才展开，否则 name/(N)）。
function renderChild(paths, parentDir, name, cap) {
  const childPath = `${parentDir}/${name}`;
  if (!isDir(paths, childPath)) return name;
  const { dirs, files } = immediateChildren(paths, childPath);
  const items = [...files, ...dirs.map(sub => `${sub}/`)];
  if (!items.length) return `${name}/`;
  if (items.length > cap) return `${name}/(${items.length})`;
  return `${name}/{${items.join(',')}}`;
}

// 一段目录的紧凑行：`dir/  <file> <file> <subdir/{...}> ...`
function renderDirLine(paths, dir, childCap) {
  const { dirs, files } = immediateChildren(paths, dir);
  const rendered = [
    ...files,
    ...dirs.map(sub => renderChild(paths, dir, sub, childCap)),
  ];
  if (!rendered.length) return '';
  return `${dir.replace(/^src\//, '')}/  ${rendered.join('  ')}`;
}

// businessDirs：由 init 时 LLM 断定的「业务功能目录名」（顶层，相对 src；不写死 views/pages——
// 一个目录是不是业务区，是"里面装的是一个个业务页/功能、而非可复用件"的语义判断，交给模型）。未提供则不排除。
function buildStructureDoc(project, businessDirs = []) {
  const paths = projectPaths(project).filter(p => p.startsWith('src/'));
  const business = new Set((businessDirs || []).map(String).filter(Boolean));
  const { dirs, files } = immediateChildren(paths, 'src');
  const skeletonRoots = dirs.filter(dir => !business.has(dir));
  const lines = ['# Structure.md（复用骨架，扫盘生成，非 LLM；views/pages 业务区按需现场探测）', ''];
  if (files.length) lines.push(`src/  ${files.join('  ')}`);
  for (const root of skeletonRoots) {
    // 骨架根的直属子项全部列名（工具箱清单），其孙级 ≤6 才内联展开。
    const line = renderDirLine(paths, `src/${root}`, 6);
    if (line) lines.push(line);
  }
  return `${lines.join('\n')}\n`;
}

function ensureStructureDoc(project, businessDirs = []) {
  const doc = buildStructureDoc(project, businessDirs);
  try {
    atomicWrite(path.join(experienceRoot(project), STRUCTURE_DOC_FILE), doc);
    return { markdown: doc, writable: true };
  } catch (error) {
    return { markdown: doc, writable: false, error: error.message || String(error) };
  }
}

function loadStructureDoc(project, businessDirs = []) {
  const existing = safeRead(path.join(experienceRoot(project), STRUCTURE_DOC_FILE));
  return existing || buildStructureDoc(project, businessDirs);
}

module.exports = {
  STRUCTURE_DOC_FILE,
  buildStructureDoc,
  ensureStructureDoc,
  loadStructureDoc,
};
