'use strict';

const fs = require('fs');
const path = require('path');

const SESSION_FILE = 'connect-agent-sessions.json';

function sessionFile(project) {
  if (!project?.path) throw new Error('Agent 会话缺少项目目录');
  return path.join(project.path, '.magnus', SESSION_FILE);
}

function loadProjectAgentSession(project, providerId) {
  const data = readSessions(sessionFile(project));
  const session = data.sessions[String(providerId || '')];
  if (!session || typeof session !== 'object') return null;
  const threadId = String(session.threadId || '').trim();
  if (!threadId) return null;
  return {
    threadId,
    updatedAt: String(session.updatedAt || ''),
    selections: normalizeSelections(session.selections),
  };
}

function saveProjectAgentSession(project, providerId, session) {
  const file = sessionFile(project);
  const data = readSessions(file);
  const providerIdKey = String(providerId || '');
  const previous = data.sessions[providerIdKey] || {};
  data.sessions[String(providerId || '')] = {
    threadId: String(session?.threadId || '').trim(),
    updatedAt: new Date().toISOString(),
    selections: normalizeSelections(previous.selections),
  };
  atomicWrite(file, `${JSON.stringify(data, null, 2)}\n`);
  return data.sessions[providerIdKey];
}

function saveProjectSelectionContexts(project, providerId, input) {
  const file = sessionFile(project);
  const data = readSessions(file);
  const providerIdKey = String(providerId || '');
  const previous = data.sessions[providerIdKey] || {};
  const threadId = String(input?.threadId || previous.threadId || '').trim();
  const selections = normalizeSelections(previous.selections);
  const sources = selectionSources(input);

  for (const item of (Array.isArray(input?.meanings) ? input.meanings : [])) {
    const selectionId = String(item?.selectionId || '').trim();
    const meaning = String(item?.meaning || '').trim();
    if (!selectionId || !meaning) continue;
    selections[selectionId] = {
      meaning,
      threadId,
      source: sources[selectionId] || selections[selectionId]?.source || null,
      updatedAt: new Date().toISOString(),
    };
  }

  data.sessions[providerIdKey] = {
    threadId,
    updatedAt: new Date().toISOString(),
    selections,
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

function normalizeSelections(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .map(([selectionId, item]) => {
      const meaning = String(item?.meaning || '').trim();
      if (!selectionId || !meaning) return null;
      return [selectionId, {
        meaning,
        threadId: String(item?.threadId || '').trim(),
        source: item?.source && typeof item.source === 'object' ? item.source : null,
        updatedAt: String(item?.updatedAt || ''),
      }];
    })
    .filter(Boolean));
}

function selectionSources(input) {
  const sources = {};
  for (const item of (Array.isArray(input?.selectionBindings) ? input.selectionBindings : [])) {
    const binding = item?.binding || item || {};
    const selectionId = String(item?.uid || binding.selectionId || '').trim();
    if (!selectionId) continue;
    const targets = (Array.isArray(binding.targets) ? binding.targets : [])
      .map(target => ({
        file: String(target?.file || '').trim(),
        role: String(target?.role || 'related'),
        line: Number(target?.line || 0),
        anchor: String(target?.anchor || ''),
        targetSnippet: String(target?.targetSnippet || ''),
        reasons: Array.isArray(target?.reasons) ? target.reasons.map(String).slice(0, 8) : [],
        codeSnippet: String(target?.codeSnippet || ''),
      }))
      .filter(target => target.file);
    if (targets.length) {
      const investigation = binding?.investigation && typeof binding.investigation === 'object'
        ? {
            reason: String(binding.investigation.reason || ''),
            relations: (Array.isArray(binding.investigation.relations)
              ? binding.investigation.relations
              : []).map(relation => ({
              from: String(relation?.from || ''),
              to: String(relation?.to || ''),
              type: String(relation?.type || 'related'),
              evidence: String(relation?.evidence || ''),
            })).filter(relation => relation.from && relation.to),
          }
        : null;
      sources[selectionId] = { targets, investigation };
    }
  }
  for (const item of (Array.isArray(input?.locatorEvidence?.selections)
    ? input.locatorEvidence.selections
    : [])) {
    const selectionId = String(item?.selectionId || '').trim();
    if (!selectionId || sources[selectionId]) continue;
    sources[selectionId] = {
      pageEvidence: {
        selector: String(item?.selector || ''),
        tag: String(item?.tag || ''),
        className: String(item?.className || ''),
        text: truncate(String(item?.text || ''), 1200),
        markup: truncate(String(item?.markup || ''), 12000),
      },
      changedFiles: (Array.isArray(input?.changedFiles) ? input.changedFiles : [])
        .map(file => String(file || '').trim())
        .filter(Boolean),
    };
  }
  return sources;
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`;
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
  saveProjectSelectionContexts,
  sessionFile,
};
