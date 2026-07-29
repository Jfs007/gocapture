'use strict';

const fs = require('fs');
const path = require('path');
const { createTwoFilesPatch, diffLines } = require('diff');
const {
  loadProjectSelectionLocations,
  updateProjectSelectionLocations,
} = require('./selection-reference-store');

const MAX_PATCH_CHARS = 50000;

function captureSelectionTaskSnapshot(project, selectionIds = []) {
  const ids = new Set((Array.isArray(selectionIds) ? selectionIds : [])
    .map(value => String(value || '').trim())
    .filter(Boolean));
  const references = loadProjectSelectionLocations(project)
    .filter(reference => ids.has(reference.selectionId));
  const files = new Map();

  for (const reference of references) {
    for (const location of reference.locations) {
      if (files.has(location.file)) continue;
      const absolute = resolveProjectFile(project, location.file);
      if (!absolute) continue;
      try {
        files.set(location.file, fs.readFileSync(absolute, 'utf8'));
      } catch (error) {
      }
    }
  }

  return {
    references: references.map(reference => ({
      ...reference,
      locations: reference.locations.map(location => ({
        ...location,
        source: location.source || sourceAtLocation(files.get(location.file), location),
      })),
    })),
    files,
  };
}

function finalizeSelectionTaskDiff(project, snapshot, changedFiles = [], taskId = '') {
  if (!snapshot?.references?.length || !snapshot?.files?.size) return [];
  const changed = normalizedChangedFiles(project, changedFiles);
  if (!changed.size) return [];

  const afterFiles = new Map();
  const updates = [];
  const changes = [];
  const recordedChanges = new Set();
  let locationsChanged = false;

  for (const reference of snapshot.references) {
    const nextLocations = [];
    for (const location of reference.locations) {
      const before = snapshot.files.get(location.file);
      if (typeof before !== 'string' || !changed.has(location.file)) {
        nextLocations.push(location);
        continue;
      }
      let after = afterFiles.get(location.file);
      if (after === undefined) {
        const absolute = resolveProjectFile(project, location.file);
        try {
          after = absolute ? fs.readFileSync(absolute, 'utf8') : null;
        } catch (error) {
          after = null;
        }
        afterFiles.set(location.file, after);
      }
      if (typeof after !== 'string' || before === after) {
        nextLocations.push(location);
        continue;
      }

      const parts = diffLines(before, after);
      const mapped = mapLocationThroughDiff(location, parts);
      if (!mapped) {
        nextLocations.push(location);
        continue;
      }
      const beforeSource = location.source || sourceAtLocation(before, location);
      const afterSource = sourceAtLocation(after, mapped);
      const nextLocation = {
        ...mapped,
        anchor: stableAnchor(afterSource, location.anchor),
        source: afterSource,
      };
      nextLocations.push(nextLocation);
      if (
        nextLocation.startLine !== location.startLine
        || nextLocation.endLine !== location.endLine
        || nextLocation.anchor !== location.anchor
        || nextLocation.source !== location.source
      ) {
        locationsChanged = true;
      }
      const changeKey = `${reference.selectionId}\0${location.file}`;
      if (recordedChanges.has(changeKey)) continue;
      recordedChanges.add(changeKey);
      const patch = createTwoFilesPatch(
        `${location.file} · 修改前`,
        `${location.file} · 修改后`,
        before,
        after,
        '',
        '',
        { context: 3 },
      ).slice(0, MAX_PATCH_CHARS);
      const stats = patchStats(patch);
      changes.push({
        selectionId: reference.selectionId,
        taskId: String(taskId || ''),
        file: location.file,
        before: {
          startLine: location.startLine,
          endLine: location.endLine,
          source: beforeSource,
        },
        after: {
          startLine: nextLocation.startLine,
          endLine: nextLocation.endLine,
          source: afterSource,
        },
        patch,
        additions: stats.additions,
        deletions: stats.deletions,
      });
    }
    updates.push({
      selectionId: reference.selectionId,
      locations: nextLocations,
      thumbnail: reference.thumbnail,
    });
  }

  if (locationsChanged) updateProjectSelectionLocations(project, updates);
  return changes;
}

function mapLocationThroughDiff(location, parts) {
  const start = positiveLine(location.startLine);
  const end = Math.max(start, positiveLine(location.endLine) || start);
  if (!start) return null;
  let oldLine = 1;
  let newLine = 1;
  const spans = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const count = Number(part.count || 0);
    if (part.added) {
      newLine += count;
      continue;
    }
    if (part.removed) {
      const overlapStart = Math.max(start, oldLine);
      const overlapEnd = Math.min(end, oldLine + count - 1);
      if (overlapStart <= overlapEnd) {
        const replacement = parts[index + 1]?.added ? Number(parts[index + 1].count || 0) : 0;
        if (replacement > 0) spans.push([newLine, newLine + replacement - 1]);
      }
      oldLine += count;
      continue;
    }

    const overlapStart = Math.max(start, oldLine);
    const overlapEnd = Math.min(end, oldLine + count - 1);
    if (overlapStart <= overlapEnd) {
      spans.push([
        newLine + overlapStart - oldLine,
        newLine + overlapEnd - oldLine,
      ]);
    }
    oldLine += count;
    newLine += count;
  }

  if (!spans.length) return null;
  return {
    file: location.file,
    startLine: Math.min(...spans.map(span => span[0])),
    endLine: Math.max(...spans.map(span => span[1])),
  };
}

function sourceAtLocation(content, location) {
  if (typeof content !== 'string') return '';
  const lines = content.split(/\r?\n/);
  const start = positiveLine(location?.startLine);
  const end = Math.max(start, positiveLine(location?.endLine) || start);
  if (!start) return '';
  return lines.slice(start - 1, end).join('\n');
}

function stableAnchor(source, fallback = '') {
  return String(source || '').split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean)
    ?.slice(0, 240)
    || String(fallback || '').slice(0, 240);
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

function normalizedChangedFiles(project, changedFiles) {
  return new Set((Array.isArray(changedFiles) ? changedFiles : [])
    .map(file => projectRelativeFile(project, file))
    .filter(Boolean));
}

function projectRelativeFile(project, file) {
  const root = path.resolve(String(project?.path || ''));
  const value = String(file || '').trim();
  if (!root || !value) return '';
  const absolute = path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return '';
  return path.relative(root, absolute).split(path.sep).join('/');
}

function resolveProjectFile(project, file) {
  const relative = projectRelativeFile(project, file);
  return relative ? path.resolve(project.path, relative) : '';
}

function positiveLine(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

module.exports = {
  captureSelectionTaskSnapshot,
  finalizeSelectionTaskDiff,
  mapLocationThroughDiff,
  patchStats,
  sourceAtLocation,
};
