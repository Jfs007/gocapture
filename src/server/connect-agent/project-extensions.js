'use strict';

const fs = require('fs');
const path = require('path');
const { AGENT_TOOL_DEFINITIONS } = require('./core/agent-tool-session');
const { loadMcpServers } = require('./mcp/config');
const { loadSkills } = require('./skills-loader');

const SAFE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function projectRoot(project) {
  return String(project?.path || project?.projectRoot || '').trim();
}

function projectMcpFile(project) {
  return path.join(projectRoot(project), '.mcp.json');
}

function projectSkillFile(project, name) {
  return path.join(projectRoot(project), '.gocapture', 'skills', name, 'SKILL.md');
}

function assertSafeName(name, label) {
  const value = String(name || '').trim();
  if (!SAFE_NAME_RE.test(value)) {
    throw new Error(`${label}名称只能包含字母、数字、点、下划线和连字符`);
  }
  return value;
}

function readJson(file, fallback = {}) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' ? value : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function projectMcpNames(project) {
  const config = readJson(projectMcpFile(project));
  return new Set(Object.keys(config?.mcpServers || {}));
}

function redactRecord(value) {
  if (Array.isArray(value)) return value.map(item => redactRecord(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (/key|token|secret|authorization/i.test(key)) return [key, child ? '已配置' : ''];
    if (child && typeof child === 'object') return [key, redactRecord(child)];
    return [key, child];
  }));
}

// 从规范化后的 server 还原「.mcp.json 里那一段原始条目」，供前端 JSON 编辑器直接展示/编辑。
function mcpRawEntry(server) {
  if (server.transport === 'stdio') {
    const entry = { command: server.command };
    if (Array.isArray(server.args) && server.args.length) entry.args = server.args;
    if (server.env && Object.keys(server.env).length) entry.env = server.env;
    if (server.cwd) entry.cwd = server.cwd;
    return entry;
  }
  const entry = { url: server.url };
  if (server.transport && server.transport !== 'http') entry.transport = server.transport;
  if (server.headers && Object.keys(server.headers).length) entry.headers = server.headers;
  return entry;
}

function listProjectExtensions(project, provider = null) {
  const root = projectRoot(project);
  const projectServers = projectMcpNames(project);
  const mcpServers = loadMcpServers(root).map(server => ({
    name: server.name,
    kind: 'mcp',
    source: projectServers.has(server.name) ? 'project' : 'user',
    transport: server.transport,
    summary: server.transport === 'stdio'
      ? `${server.command} ${(server.args || []).join(' ')}`.trim()
      : `${server.transport || 'http'} ${server.url || ''}`.trim(),
    // config = 该 server 在 .mcp.json 里的原始条目（密钥脱敏），前端直接当 JSON 编辑。
    config: redactRecord(mcpRawEntry(server)),
  }));
  const skills = loadSkills(root).map(skill => ({
    name: skill.name,
    kind: 'skill',
    source: skill.source,
    description: skill.description,
    allowedTools: skill.allowedTools,
    instructions: skill.body,
    path: skill.dir,
  }));
  const nativeCapabilities = [
    { name: '源码读写与命令执行', kind: 'native', description: '由开发 Agent 自身提供。' },
    { name: 'HITL / 权限确认', kind: 'native', description: '由开发 Agent 与 GoCapture 交互层共同提供。' },
  ];
  return {
    provider: provider
      ? {
          id: provider.id,
          name: provider.name,
          connected: !!provider.connected,
          capabilities: provider.capabilities || {},
        }
      : null,
    nativeCapabilities,
    tools: AGENT_TOOL_DEFINITIONS.map(tool => ({
      name: tool.name,
      kind: 'tool',
      source: 'gocapture',
      description: tool.description,
    })),
    mcpServers,
    skills,
    installTargets: {
      mcp: '.mcp.json',
      skill: '.gocapture/skills/<name>/SKILL.md',
    },
  };
}

// 前端 JSON 编辑器：直接接收该 server 的 .mcp.json 原始条目（input.config）。
function saveProjectMcp(project, input = {}) {
  const name = assertSafeName(input.name, 'MCP');
  const raw = input.config;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('MCP 配置必须是一个 JSON 对象，例如 {"command":"npx","args":["-y","pkg"]}');
  }
  const command = String(raw.command || '').trim();
  const url = String(raw.url || '').trim();
  if (!command && !url) {
    throw new Error('MCP 配置必须包含 command（本地 stdio）或 url（远程）');
  }
  if (url && !/^https?:\/\//i.test(url)) {
    throw new Error('远程 MCP 的 url 必须是 http/https');
  }
  const file = projectMcpFile(project);
  const config = readJson(file);
  const existing = config?.mcpServers?.[name] && typeof config.mcpServers[name] === 'object'
    ? config.mcpServers[name]
    : {};
  // name/kind/source/summary 只是列表展示字段，不属于 .mcp.json 条目；顺手剔除。
  const { name: _n, kind: _k, source: _s, summary: _m, ...entry } = raw;
  // 恢复被脱敏成「已配置」的密钥（env/headers/token 等），避免保存时把真实值覆盖没。
  const definition = restoreConfiguredValues(entry, existing);
  config.mcpServers = {
    ...(config.mcpServers && typeof config.mcpServers === 'object' ? config.mcpServers : {}),
    [name]: definition,
  };
  writeJson(file, config);
  return { name, file, definition: redactRecord(definition) };
}

function restoreConfiguredValues(value, existing) {
  if (value === '已配置') return existing;
  if (Array.isArray(value)) {
    return value.map((child, index) => restoreConfiguredValues(child, existing?.[index]));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    restoreConfiguredValues(child, existing?.[key]),
  ]));
}

function deleteProjectMcp(project, rawName) {
  const name = assertSafeName(rawName, 'MCP');
  const file = projectMcpFile(project);
  const config = readJson(file);
  const servers = config.mcpServers && typeof config.mcpServers === 'object'
    ? { ...config.mcpServers }
    : {};
  if (!Object.prototype.hasOwnProperty.call(servers, name)) {
    throw new Error('只能移除当前项目安装的 MCP');
  }
  delete servers[name];
  config.mcpServers = servers;
  writeJson(file, config);
  return { name, file };
}

function saveProjectSkill(project, input = {}) {
  const name = assertSafeName(input.name, 'Skill');
  const description = String(input.description || '').trim();
  const instructions = String(input.instructions || '').trim();
  if (!instructions) throw new Error('Skill 必须填写指令内容');
  const allowedTools = toStringList(input.allowedTools);
  const frontmatter = [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    ...(allowedTools.length ? [`allowed-tools: [${allowedTools.join(', ')}]`] : []),
    '---',
    '',
  ].join('\n');
  const file = projectSkillFile(project, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${frontmatter}${instructions}\n`);
  return { name, file };
}

function deleteProjectSkill(project, rawName) {
  const name = assertSafeName(rawName, 'Skill');
  const root = path.dirname(projectSkillFile(project, name));
  if (!fs.existsSync(path.join(root, 'SKILL.md'))) {
    throw new Error('只能移除当前项目安装的 Skill');
  }
  fs.rmSync(root, { recursive: true, force: true });
  return { name, root };
}

function toStringList(value) {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  return String(value || '').split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
}

module.exports = {
  deleteProjectMcp,
  deleteProjectSkill,
  listProjectExtensions,
  projectMcpFile,
  projectSkillFile,
  saveProjectMcp,
  saveProjectSkill,
};
