'use strict';

const fs = require('fs');
const path = require('path');
const { createTwoFilesPatch, parsePatch } = require('diff');

const MAX_PATCH_CHARS = 50000;

function captureFileBeforeEdit(task, file) {
  if (!(task.changedFiles instanceof Set)) task.changedFiles = new Set();
  if (!(task.fileBaselines instanceof Map)) task.fileBaselines = new Map();
  if (!(task.fileDiffs instanceof Map)) task.fileDiffs = new Map();
  const relative = taskFile(task, file);
  if (!relative) return '';
  task.changedFiles.add(relative);
  if (task.fileBaselines.has(relative)) return relative;
  try {
    task.fileBaselines.set(relative, fs.readFileSync(path.resolve(task.cwd, relative), 'utf8'));
  } catch (error) {
    task.fileBaselines.set(relative, '');
  }
  return relative;
}

function captureProposedFileEdit(task, tool, input = {}) {
  const file = captureFileBeforeEdit(
    task,
    input.file_path || input.path || input.notebook_path,
  );
  if (!file) return null;
  const before = task.fileBaselines.get(file);
  const after = proposedContent(before, tool, input);
  if (typeof after !== 'string' || before === after) return null;
  return setTaskFileDiff(task, {
    file,
    patch: createTwoFilesPatch(
      `${file} · 修改前`,
      `${file} · 修改后`,
      before,
      after,
      '',
      '',
      { context: 3 },
    ),
    before,
    after,
    phase: 'proposed',
    source: 'claude-code-tool',
  });
}

function finalizeTaskFileDiffs(task, source = 'derived') {
  if (!(task.fileBaselines instanceof Map) || !(task.fileDiffs instanceof Map)) return [];
  for (const file of task.changedFiles) {
    if (!task.fileBaselines.has(file)) continue;
    let after = '';
    try {
      after = fs.readFileSync(path.resolve(task.cwd, file), 'utf8');
    } catch (error) {
    }
    const before = task.fileBaselines.get(file);
    if (before === after) {
      task.fileDiffs.delete(file);
      continue;
    }
    setTaskFileDiff(task, {
      file,
      patch: createTwoFilesPatch(
        `${file} · 修改前`,
        `${file} · 修改后`,
        before,
        after,
        '',
        '',
        { context: 3 },
      ),
      before,
      after,
      phase: 'applied',
      source,
    });
  }
  return publicFileDiffs(task);
}

function recordUnifiedDiff(task, patch, source = 'native') {
  ensureTaskDiffCollections(task);
  for (const parsed of parsePatch(String(patch || ''))) {
    const file = patchFile(parsed);
    const normalizedPatch = formatParsedPatch(parsed);
    if (!file || !normalizedPatch) continue;
    setTaskFileDiff(task, {
      file,
      patch: normalizedPatch,
      phase: 'applied',
      source,
    });
  }
}

function setTaskFileDiff(task, input = {}) {
  ensureTaskDiffCollections(task);
  const file = taskFile(task, input.file);
  const patch = String(input.patch || '').slice(0, MAX_PATCH_CHARS);
  if (!file || !patch) return null;
  task.changedFiles.add(file);
  const stats = patchStats(patch);
  const value = {
    file,
    patch,
    additions: stats.additions,
    deletions: stats.deletions,
    phase: String(input.phase || 'applied'),
    source: String(input.source || 'native'),
    before: typeof input.before === 'string' ? input.before : '',
    after: typeof input.after === 'string' ? input.after : '',
  };
  task.fileDiffs.set(file, value);
  return value;
}

function publicFileDiffs(task) {
  if (!(task?.fileDiffs instanceof Map)) return [];
  return [...task.fileDiffs.values()].map(({
    file,
    patch,
    additions,
    deletions,
    phase,
    source,
  }) => ({
    file,
    patch,
    additions,
    deletions,
    phase,
    source,
  }));
}

function ensureTaskDiffCollections(task) {
  if (!(task.changedFiles instanceof Set)) task.changedFiles = new Set();
  if (!(task.fileDiffs instanceof Map)) task.fileDiffs = new Map();
}

function proposedContent(before, tool, input) {
  if (tool === 'Write' || tool === 'create_file') {
    return typeof input.content === 'string' ? input.content : null;
  }
  if (tool === 'Edit') {
    return replaceExact(
      before,
      input.old_string,
      input.new_string,
      input.replace_all,
    );
  }
  if (tool === 'MultiEdit' && Array.isArray(input.edits)) {
    return input.edits.reduce((content, edit) => replaceExact(
      content,
      edit?.old_string,
      edit?.new_string,
      edit?.replace_all,
    ) ?? content, before);
  }
  if (tool === 'str_replace_editor') {
    return replaceExact(before, input.old_str, input.new_str, input.replace_all);
  }
  return null;
}

function replaceExact(content, oldValue, newValue, replaceAll = false) {
  const oldText = typeof oldValue === 'string' ? oldValue : '';
  if (!oldText || !content.includes(oldText)) return null;
  const replacement = typeof newValue === 'string' ? newValue : '';
  return replaceAll
    ? content.split(oldText).join(replacement)
    : content.replace(oldText, replacement);
}

function taskFile(task, file) {
  const cwd = path.resolve(String(task?.cwd || ''));
  const value = String(file || '').trim();
  if (!cwd || !value) return '';
  const absolute = path.isAbsolute(value) ? path.resolve(value) : path.resolve(cwd, value);
  if (absolute !== cwd && !absolute.startsWith(`${cwd}${path.sep}`)) return '';
  return path.relative(cwd, absolute).split(path.sep).join('/');
}

function patchFile(parsed) {
  const value = String(parsed?.newFileName || parsed?.oldFileName || '')
    .replace(/^[ab]\//, '');
  return value === '/dev/null' ? '' : value;
}

function formatParsedPatch(parsed) {
  const lines = [
    `--- ${String(parsed?.oldFileName || '/dev/null')}`,
    `+++ ${String(parsed?.newFileName || '/dev/null')}`,
  ];
  for (const hunk of (Array.isArray(parsed?.hunks) ? parsed.hunks : [])) {
    lines.push(
      `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      ...(Array.isArray(hunk.lines) ? hunk.lines : []),
    );
  }
  return lines.length > 2 ? `${lines.join('\n')}\n` : '';
}

function patchStats(patch) {
  let additions = 0;
  let deletions = 0;
  for (const line of String(patch || '').split(/\r?\n/)) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) additions += 1;
    if (line.startsWith('-')) deletions += 1;
  }
  return { additions, deletions };
}

module.exports = {
  captureFileBeforeEdit,
  captureProposedFileEdit,
  finalizeTaskFileDiffs,
  patchStats,
  publicFileDiffs,
  recordUnifiedDiff,
  setTaskFileDiff,
  taskFile,
};
