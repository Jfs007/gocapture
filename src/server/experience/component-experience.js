'use strict';

// 项目公共件的「经验档案」——每个公共件一个目录 .magnus/experience/<slug>/，内含三个各司其职的文件：
//   · doc.md        —— 操作文档：真实调用点片段（进 change-plan 上下文）。
//   · meta.json     —— meta 头：role / keywords / componentPath / files（供「清单」查找与路由）。
//   · evidence.json —— 使用案例业务文件路径：证明它确实被复用、也用于下次验证经验是否仍成立。
// 清单 = 扫描各目录的 meta.json 汇总而成；绝不存整文件。

const fs = require('fs');
const path = require('path');
const { experienceRoot, atomicWrite, safeJson, safeRead } = require('./project-context');

const EXPERIENCE_DIR = 'experience';

function experienceRootDir(project) {
  return path.join(experienceRoot(project), EXPERIENCE_DIR);
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// 清单：扫描各 <slug>/ 目录，读 meta + doc + evidence，汇成可查、可插、可验证的记录。
function loadComponentExperiences(project) {
  let entries = [];
  try {
    entries = fs.readdirSync(experienceRootDir(project), { withFileTypes: true });
  } catch (error) {
    return [];
  }
  const records = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(experienceRootDir(project), entry.name);
    const meta = safeJson(path.join(dir, 'meta.json'));
    if (!meta || !meta.componentPath) continue;
    const evidence = safeJson(path.join(dir, 'evidence.json')) || {};
    records.push({
      ...meta,
      doc: safeRead(path.join(dir, 'doc.md')),
      usagePath: evidence.usagePath || '',
      usageFiles: Array.isArray(evidence.usageFiles) ? evidence.usageFiles : [],
    });
  }
  return records;
}

function renderDoc(record) {
  if (/^#\s+/m.test(String(record.doc || '').trim())) {
    return record.doc.endsWith('\n') ? record.doc : `${record.doc}\n`;
  }
  return [
    `# ${record.name}（${record.componentPath}）`,
    '',
    `使用者示例：${record.usagePath || '-'}`,
    '',
    '## 真实调用点',
    '```',
    record.doc || '',
    '```',
    '',
  ].join('\n');
}

// 把新档案写成「一目录三文件」并 upsert；返回 meta 列表（即清单）。
function saveComponentExperiences(project, items) {
  for (const item of items || []) {
    if (!item.componentPath || !item.doc) continue;
    const name = item.name || item.componentPath.split('/').filter(Boolean).pop();
    const dir = path.join(experienceRootDir(project), slug(item.componentPath));
    const meta = {
      slug: slug(item.componentPath),
      name,
      role: item.role || '',
      keywords: item.keywords || [],
      componentPath: item.componentPath,
      files: Number(item.files || 0),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const usageFiles = Array.isArray(item.usageFiles) && item.usageFiles.length
      ? item.usageFiles
      : [item.usagePath].filter(Boolean);
    try {
      atomicWrite(path.join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
      atomicWrite(path.join(dir, 'doc.md'), renderDoc({ ...meta, usagePath: item.usagePath, doc: item.doc }));
      atomicWrite(path.join(dir, 'evidence.json'), `${JSON.stringify({ usagePath: item.usagePath || '', usageFiles }, null, 2)}\n`);
    } catch (error) {
      // 目录不可写则跳过
    }
  }
  return loadComponentExperiences(project);
}

module.exports = {
  loadComponentExperiences,
  saveComponentExperiences,
};
