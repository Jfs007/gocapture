const crypto = require('crypto');

const sessions = new Map();
const RECENT_INPUT_LIMIT = 6;
const REQUIREMENT_LIMIT = 12;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function now() {
  return Date.now();
}

function hashText(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 16);
}

function normalizePathname(value) {
  const text = String(value || '').trim();
  if (!text) return '/';
  const withoutQuery = text.split('?')[0].split('#')[0];
  const normalized = `/${withoutQuery}`
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
  return normalized || '/';
}

function normalizedPageKey(input = {}) {
  const rawUrl = input.url || input.pageUrl || '';
  try {
    const url = new URL(rawUrl);
    const hash = String(url.hash || '').replace(/^#/, '');
    if (hash.startsWith('/')) return normalizePathname(hash);
    return normalizePathname(url.pathname);
  } catch (error) {
  }
  const raw = String(input.pagePath || input.path || rawUrl || '/').trim();
  if (raw.includes('#/')) {
    const hashRoute = raw.slice(raw.indexOf('#') + 1);
    return normalizePathname(hashRoute);
  }
  return normalizePathname(raw);
}

function sessionKey(project, task) {
  const projectRoot = String(project?.path || '').replace(/\\/g, '/');
  const pageKey = normalizedPageKey({
    url: task.pageUrl,
    pageUrl: task.pageUrl,
    pagePath: task.pagePath,
  });
  return `${projectRoot}::${pageKey}`;
}

function extractMentionedFiles(text) {
  return Array.from(new Set(
    (String(text || '').match(/\bsrc\/[A-Za-z0-9_./@-]+\.(?:vue|tsx|jsx|ts|js|mjs|cjs)\b/g) || [])
      .map(item => item.replace(/[),.;:，。；：]+$/g, ''))
  ));
}

function targetFiles(task) {
  return Array.from(new Set((task.targets || []).map(item => item.file).filter(Boolean)));
}

function shouldAppendToSession(session, task) {
  if (!session) return false;
  if (now() - session.updatedAt > SESSION_TTL_MS) return false;
  const mentioned = extractMentionedFiles(task.userRequirement);
  const currentTargets = targetFiles(task);
  const knownTargets = new Set(session.targetFiles || []);
  if (mentioned.length && !mentioned.some(file => knownTargets.has(file))) return false;
  if (currentTargets.length && knownTargets.size) {
    return currentTargets.some(file => knownTargets.has(file));
  }
  return true;
}

function mergeUnique(list, values, limit) {
  return Array.from(new Set([...(list || []), ...(values || []).filter(Boolean)])).slice(-limit);
}

function compactTaskSession(session) {
  return {
    id: session.id,
    pageKey: session.pageKey,
    taskBrief: session.taskBrief,
    requirements: session.requirements,
    targetFiles: session.targetFiles,
    confirmedSkillIds: session.confirmedSkillIds,
    confirmedFacts: session.confirmedFacts,
    assumptions: session.assumptions,
    recentInputs: session.recentInputs,
    lastEnhancedPrompt: session.lastEnhancedPrompt,
    updatedAt: session.updatedAt,
  };
}

function beginTaskSession(project, task) {
  const key = sessionKey(project, task);
  const pageKey = key.split('::').pop() || '/';
  const input = String(task.userRequirement || '').trim();
  const session = {
    id: `task_${hashText(`${key}:${now()}`)}`,
    key,
    projectRoot: String(project?.path || ''),
    pageKey,
    taskBrief: input || '按页面选区完成修改',
    requirements: input ? [input] : [],
    targetFiles: targetFiles(task),
    confirmedSkillIds: [],
    confirmedFacts: [],
    assumptions: [],
    recentInputs: input ? [input] : [],
    lastEnhancedPrompt: '',
    createdAt: now(),
    updatedAt: now(),
  };
  sessions.set(key, session);
  return session;
}

function getOrCreateTaskSession(project, task) {
  const key = sessionKey(project, task);
  const current = sessions.get(key);
  if (shouldAppendToSession(current, task)) {
    const input = String(task.userRequirement || '').trim();
    current.targetFiles = mergeUnique(current.targetFiles, targetFiles(task), 12);
    if (input && !current.requirements.includes(input)) {
      current.requirements = mergeUnique(current.requirements, [input], REQUIREMENT_LIMIT);
      current.recentInputs = mergeUnique(current.recentInputs, [input], RECENT_INPUT_LIMIT);
      current.taskBrief = current.requirements.join('；');
    }
    current.updatedAt = now();
    return { session: current, isNew: false, mode: 'append' };
  }
  return { session: beginTaskSession(project, task), isNew: true, mode: current ? 'replace' : 'new' };
}

function updateTaskSession(project, task, patch = {}) {
  const key = sessionKey(project, task);
  const session = sessions.get(key);
  if (!session) return null;
  session.targetFiles = mergeUnique(session.targetFiles, patch.targetFiles || [], 12);
  session.confirmedSkillIds = mergeUnique(session.confirmedSkillIds, patch.confirmedSkillIds || [], 8);
  session.confirmedFacts = mergeUnique(session.confirmedFacts, patch.confirmedFacts || [], 16);
  session.assumptions = mergeUnique(session.assumptions, patch.assumptions || [], 16);
  if (patch.enhancedPrompt) session.lastEnhancedPrompt = String(patch.enhancedPrompt).slice(0, 6000);
  session.updatedAt = now();
  return session;
}

module.exports = {
  compactTaskSession,
  getOrCreateTaskSession,
  normalizedPageKey,
  updateTaskSession,
};
