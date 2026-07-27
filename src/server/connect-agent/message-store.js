'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MESSAGE_DIRECTORY = 'message';
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

function messageDirectory(project) {
  if (!project?.path) throw new Error('Agent 消息缺少项目目录');
  return path.join(project.path, '.gocapture', MESSAGE_DIRECTORY);
}

function messageFile(project, providerId) {
  const safeProviderId = String(providerId || 'agent')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-');
  return path.join(messageDirectory(project), `${safeProviderId || 'agent'}.jsonl`);
}

function appendProjectMessage(project, providerId, input) {
  const message = normalizeMessage({
    ...input,
    id: input?.id || `message_${crypto.randomUUID().replace(/-/g, '')}`,
    providerId,
    createdAt: input?.createdAt || new Date().toISOString(),
  });
  const file = messageFile(project, providerId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(message)}\n`);
  return message;
}

function loadProjectMessages(project, providerId, options = {}) {
  const limit = Math.min(
    Math.max(Number(options.limit || DEFAULT_LIMIT), 1),
    MAX_LIMIT,
  );
  const messages = readJsonLines(messageFile(project, providerId));
  return messages.slice(-limit);
}

function readJsonLines(file) {
  let content = '';
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (error) {
    return [];
  }
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      try {
        return normalizeMessage(JSON.parse(line));
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeMessage(input) {
  return {
    id: String(input?.id || ''),
    providerId: String(input?.providerId || ''),
    taskId: String(input?.taskId || ''),
    threadId: String(input?.threadId || ''),
    turnId: String(input?.turnId || ''),
    role: normalizeRole(input?.role),
    kind: String(input?.kind || 'event'),
    text: String(input?.text || ''),
    status: String(input?.status || ''),
    createdAt: String(input?.createdAt || ''),
    metadata: input?.metadata && typeof input.metadata === 'object'
      ? input.metadata
      : {},
  };
}

function normalizeRole(value) {
  const role = String(value || '');
  if (role === 'user' || role === 'agent' || role === 'system') return role;
  return 'system';
}

module.exports = {
  MESSAGE_DIRECTORY,
  appendProjectMessage,
  loadProjectMessages,
  messageDirectory,
  messageFile,
};
