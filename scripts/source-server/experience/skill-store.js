const fs = require('fs');
const path = require('path');
const {
  atomicWrite,
  experienceRoot,
  refreshProjectDocument,
  safeJson,
  safeRead,
} = require('./project-context');

function skillsRoot(project) {
  return path.join(experienceRoot(project), 'skills');
}

function skillSlug(value) {
  return String(value || '')
    .replace(/^skill:/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeTriggerTags(tags) {
  return Array.from(new Set((tags || [])
    .map(String)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => item.length <= 32)
    .filter(item => !/\s/.test(item))
    .filter(item => !/[{}()[\];,'"`]/.test(item))
    .filter(item => !/^@/.test(item))
    .filter(item => !/^\/[A-Za-z0-9_./?=&:-]+$/.test(item))
    .filter(item => !/^(?:import|export|from|function|const|let|var)$/i.test(item))
    .filter(item => /[A-Za-z0-9_\-/]|[\u4e00-\u9fa5]/.test(item))))
    .slice(0, 12);
}

function normalizeMeta(meta, directory) {
  const slug = skillSlug(meta?.id || directory);
  if (!slug) return null;
  const normalized = {
    id: `skill:${slug}`,
    name: String(meta?.name || slug),
    triggerTags: normalizeTriggerTags(meta?.triggerTags || []),
    applicableWhen: (meta?.applicableWhen || []).map(String).filter(Boolean).slice(0, 16),
    notApplicableWhen: (meta?.notApplicableWhen || []).map(String).filter(Boolean).slice(0, 16),
    status: ['active', 'needs-verification', 'stale', 'deprecated'].includes(meta?.status)
      ? meta.status
      : 'needs-verification',
    confidence: ['high', 'medium', 'low'].includes(meta?.confidence) ? meta.confidence : 'medium',
    verificationCount: Math.max(0, Number(meta?.verificationCount || 0)),
    lastVerifiedAt: meta?.lastVerifiedAt || '',
    staleAfterDays: Math.max(1, Number(meta?.staleAfterDays || 90)),
  };
  if (normalized.status === 'active' && normalized.lastVerifiedAt) {
    const verifiedAt = Date.parse(normalized.lastVerifiedAt);
    if (Number.isFinite(verifiedAt)
      && Date.now() - verifiedAt > normalized.staleAfterDays * 24 * 60 * 60 * 1000) {
      normalized.status = 'stale';
    }
  }
  return normalized;
}

function loadSkillMetas(project) {
  const root = skillsRoot(project);
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    return [];
  }
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => normalizeMeta(safeJson(path.join(root, entry.name, 'meta.json')), entry.name))
    .filter(Boolean)
    .filter(meta => meta.status !== 'deprecated')
    .sort((a, b) => a.id.localeCompare(b.id));
}

function loadSkillContexts(project, ids) {
  const wanted = new Set((ids || []).map(skillSlug).filter(Boolean));
  const metas = loadSkillMetas(project).filter(meta => wanted.has(skillSlug(meta.id)));
  return metas.map(meta => {
    const directory = path.join(skillsRoot(project), skillSlug(meta.id));
    return {
      meta,
      context: safeRead(path.join(directory, 'context.md')),
      examples: safeJson(path.join(directory, 'examples.json')) || {},
      evidence: safeJson(path.join(directory, 'evidence.json')) || {},
    };
  });
}

function candidateEvidenceCount(candidate) {
  const examples = Array.isArray(candidate?.examples) ? candidate.examples : [];
  const required = Array.isArray(candidate?.requiredEvidence) ? candidate.requiredEvidence : [];
  return new Set([...examples, ...required].map(item => item?.path).filter(Boolean)).size;
}

function validCandidateSkill(candidate) {
  return !!skillSlug(candidate?.id || candidate?.name)
    && String(candidate?.context || '').trim().length >= 80
    && Array.isArray(candidate?.examples)
    && candidate.examples.length >= 2
    && candidateEvidenceCount(candidate) >= 3;
}

function saveCandidateSkill(project, candidate) {
  const projectFiles = new Set((project.files || []).map(file => file.path));
  const normalizedCandidate = {
    ...candidate,
    requiredEvidence: (candidate?.requiredEvidence || []).filter(item => projectFiles.has(item?.path)),
    examples: (candidate?.examples || []).filter(item => projectFiles.has(item?.path)),
  };
  if (!validCandidateSkill(normalizedCandidate)) {
    return { saved: false, reason: '候选经验缺少足够案例、上下文或证据' };
  }
  const slug = skillSlug(normalizedCandidate.id || normalizedCandidate.name);
  const directory = path.join(skillsRoot(project), slug);
  const oldMeta = normalizeMeta(safeJson(path.join(directory, 'meta.json')), slug);
  const meta = normalizeMeta({
    ...oldMeta,
    id: `skill:${slug}`,
    name: normalizedCandidate.name || oldMeta?.name || slug,
    triggerTags: normalizedCandidate.triggerTags || oldMeta?.triggerTags || [],
    applicableWhen: normalizedCandidate.applicableWhen || oldMeta?.applicableWhen || [],
    notApplicableWhen: normalizedCandidate.notApplicableWhen || oldMeta?.notApplicableWhen || [],
    status: oldMeta?.status === 'active' ? 'active' : 'needs-verification',
    confidence: normalizedCandidate.confidence || oldMeta?.confidence || 'medium',
    verificationCount: oldMeta?.verificationCount || 0,
    lastVerifiedAt: oldMeta?.lastVerifiedAt || '',
    staleAfterDays: normalizedCandidate.staleAfterDays || oldMeta?.staleAfterDays || 90,
  }, slug);
  const examples = {
    requiredEvidence: normalizedCandidate.requiredEvidence || [],
    examples: normalizedCandidate.examples || [],
  };
  const evidence = {
    createdAt: new Date().toISOString(),
    evidenceCount: candidateEvidenceCount(normalizedCandidate),
    sourceFiles: Array.from(new Set([
      ...(normalizedCandidate.requiredEvidence || []).map(item => item?.path),
      ...(normalizedCandidate.examples || []).map(item => item?.path),
    ].filter(Boolean))),
    discoverySummary: normalizedCandidate.discoverySummary || '',
  };
  try {
    atomicWrite(path.join(directory, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
    atomicWrite(path.join(directory, 'context.md'), `${String(normalizedCandidate.context || '').trim()}\n`);
    atomicWrite(path.join(directory, 'examples.json'), `${JSON.stringify(examples, null, 2)}\n`);
    atomicWrite(path.join(directory, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    refreshProjectDocument(project, loadSkillMetas(project));
    return { saved: true, meta };
  } catch (error) {
    return { saved: false, reason: error.message || String(error) };
  }
}

function recordSkillVerification(project, ids) {
  const results = [];
  for (const skill of loadSkillContexts(project, ids)) {
    const directory = path.join(skillsRoot(project), skillSlug(skill.meta.id));
    const count = skill.meta.verificationCount + 1;
    const meta = {
      ...skill.meta,
      verificationCount: count,
      status: count >= 2 ? 'active' : skill.meta.status,
      confidence: count >= 2 ? 'high' : skill.meta.confidence,
      lastVerifiedAt: new Date().toISOString().slice(0, 10),
    };
    try {
      atomicWrite(path.join(directory, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
      results.push(meta);
    } catch (error) {
    }
  }
  if (results.length) refreshProjectDocument(project, loadSkillMetas(project));
  return results;
}

module.exports = {
  loadSkillContexts,
  loadSkillMetas,
  recordSkillVerification,
  saveCandidateSkill,
  skillSlug,
  validCandidateSkill,
};
