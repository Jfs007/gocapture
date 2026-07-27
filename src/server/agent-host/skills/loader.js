'use strict';

// Skills 加载：对齐市面 SKILL.md 约定（frontmatter + markdown 正文）。
//   <project>/.gocapture/skills/<name>/SKILL.md   +   ~/.gocapture/skills/<name>/SKILL.md
// frontmatter：name / description / allowed-tools。项目级同名优先于用户级。
// 注意：Skill 与 GoCapture 的 Experience 是两回事，互不混用（见 agent-host/README 边界）。

const fs = require('fs');
const os = require('os');
const path = require('path');

// 极简 frontmatter 解析：--- ... --- 之间的 key: value（value 支持 [a, b] / a, b 列表）。
function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { data: {}, body: String(text || '').trim() };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();
    if (/^\[.*\]$/.test(value)) {
      value = value.slice(1, -1).split(',').map(item => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, '');
    }
    data[key] = value;
  }
  return { data, body: (match[2] || '').trim() };
}

function toList(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function readSkillsFromDir(base, source, seen, out) {
  let entries = [];
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch (error) {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let raw;
    try {
      raw = fs.readFileSync(path.join(base, entry.name, 'SKILL.md'), 'utf8');
    } catch (error) {
      continue;
    }
    const { data, body } = parseFrontmatter(raw);
    const name = String(data.name || entry.name).trim();
    if (!name || seen.has(name)) continue; // 项目级先扫，同名不被用户级覆盖
    seen.add(name);
    out.push({
      name,
      description: String(data.description || '').trim(),
      allowedTools: toList(data['allowed-tools']),
      body,
      source,
      dir: path.join(base, entry.name),
    });
  }
}

function loadSkills(projectPath) {
  const seen = new Set();
  const skills = [];
  if (projectPath) readSkillsFromDir(path.join(projectPath, '.gocapture', 'skills'), 'project', seen, skills);
  readSkillsFromDir(path.join(os.homedir(), '.gocapture', 'skills'), 'user', seen, skills);
  return skills;
}

module.exports = {
  loadSkills,
  parseFrontmatter,
};
