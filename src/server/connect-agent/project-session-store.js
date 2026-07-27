'use strict';

const fs = require('fs');
const path = require('path');

const SESSION_FILE = 'connect-agent-sessions.json';

function sessionFile(project) {
  if (!project?.path) throw new Error('Agent 会话缺少项目目录');
  return path.join(project.path, '.gocapture', SESSION_FILE);
}

function loadProjectAgentSession(project, providerId) {
  const data = readSessions(sessionFile(project));
  const session = data.sessions[String(providerId || '')];
  if (!session || typeof session !== 'object') return null;
  const threadId = String(session.threadId || '').trim();
  if (!threadId) return null;
  return {
    threadId,
    threadName: String(session.threadName || ''),
    source: String(session.source || ''),
    updatedAt: String(session.updatedAt || ''),
  };
}

function saveProjectAgentSession(project, providerId, session) {
  const file = sessionFile(project);
  const data = readSessions(file);
  const providerIdKey = String(providerId || '');
  data.sessions[String(providerId || '')] = {
    threadId: String(session?.threadId || '').trim(),
    threadName: String(session?.threadName || '').trim(),
    source: String(session?.source || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  atomicWrite(file, `${JSON.stringify(data, null, 2)}\n`);
  return data.sessions[providerIdKey];
}

function clearProjectAgentSession(project, providerId) {
  const file = sessionFile(project);
  const data = readSessions(file);
  delete data.sessions[String(providerId || '')];
  atomicWrite(file, `${JSON.stringify(data, null, 2)}\n`);
}

function readSessions(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      version: 1,
      sessions: parsed?.sessions && typeof parsed.sessions === 'object'
        ? { ...parsed.sessions }
        : {},
    };
  } catch (error) {
    return { version: 1, sessions: {} };
  }
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
}

module.exports = {
  SESSION_FILE,
  clearProjectAgentSession,
  loadProjectAgentSession,
  saveProjectAgentSession,
  sessionFile,
};
