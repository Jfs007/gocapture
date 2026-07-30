'use strict';

const fs = require('fs');
const path = require('path');
const { AGENT_TOOL_DEFINITIONS } = require('./core/agent-tool-session');
const { loadMcpServers } = require('../agent-host/mcp/config');
const { loadSkills } = require('../agent-host/skills/loader');

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
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (/key|token|secret|authorization/i.test(key)) return [key, child ? '已配置' : ''];
    if (child && typeof child === 'object') return [key, redactRecord(child)];
    return [key, child];
  }));
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
    config: redactRecord(server),
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

function saveProjectMcp(project, input = {}) {
  const name = assertSafeName(input.name, 'MCP');
  const transport = String(input.transport || '').trim() || (input.command ? 'stdio' : 'http');
  const file = projectMcpFile(project);
  const config = readJson(file);
  const existing = config?.mcpServers?.[name] && typeof config.mcpServers[name] === 'object'
    ? config.mcpServers[name]
    : {};
  let definition;
  if (transport === 'stdio') {
    const command = String(input.command || '').trim();
    if (!command) throw new Error('stdio MCP 必须填写 command');
    definition = {
      command,
      args: toStringList(input.args),
      ...((input.env && typeof input.env === 'object') || existing.env
        ? { env: restoreConfiguredValues(input.env ?? existing.env, existing.env) }
        : {}),
      ...(String(input.cwd || '').trim() ? { cwd: String(input.cwd).trim() } : {}),
    };
  } else {
    const url = String(input.url || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new Error('远程 MCP 必须填写 http/https URL');
    definition = {
      url,
      transport,
      ...((input.headers && typeof input.headers === 'object') || existing.headers
        ? { headers: restoreConfiguredValues(input.headers ?? existing.headers, existing.headers) }
        : {}),
    };
  }
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
