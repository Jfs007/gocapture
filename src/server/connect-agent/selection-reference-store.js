'use strict';

const fs = require('fs');
const path = require('path');

const SELECTIONS_DIR = 'selections';

function persistLocatedSelectionReferences(project, input = {}) {
  const existingThumbnails = projectThumbnailMap(project);
  const references = locationsFromBindings(
    input.selectionBindings,
    input.selectionThumbnails,
  ).map(reference => ({
    ...reference,
    thumbnail: reference.thumbnail
      || existingThumbnails.get(reference.selectionId)
      || '',
  }));
  writeSelectionLocations(project, references);
  return references.map(reference => reference.selectionId);
}

function updateProjectSelectionLocations(project, references, selectionThumbnails = []) {
  const thumbnails = thumbnailMap(selectionThumbnails);
  const existingThumbnails = projectThumbnailMap(project);
  const normalized = normalizeSelectionLocations(references).map(reference => ({
    ...reference,
    thumbnail: thumbnails.get(reference.selectionId)
      || reference.thumbnail
      || existingThumbnails.get(reference.selectionId)
      || '',
  }));
  writeSelectionLocations(project, normalized);
}

function loadProjectSelectionLocations(project) {
  const directory = path.join(project.path, '.gocapture', SELECTIONS_DIR);
  try {
    return fs.readdirSync(directory)
      .filter(name => name.endsWith('.json'))
      .sort()
      .flatMap(name => {
        try {
          const value = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
          return normalizeSelectionLocations([value]);
        } catch (error) {
          return [];
        }
      });
  } catch (error) {
    return [];
  }
}

function deleteProjectSelectionLocations(project, selectionIds = []) {
  const ids = (Array.isArray(selectionIds) ? selectionIds : [])
    .map(value => String(value || '').trim())
    .filter(Boolean);
  const targets = ids.length
    ? ids.map(selectionId => selectionReferenceFile(project, selectionId))
    : loadProjectSelectionLocations(project)
      .map(reference => selectionReferenceFile(project, reference.selectionId));
  for (const file of targets) {
    try {
      fs.unlinkSync(file);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return targets.length;
}

function locationsFromBindings(selectionBindings, selectionThumbnails = []) {
  const thumbnails = thumbnailMap(selectionThumbnails);
  return (Array.isArray(selectionBindings) ? selectionBindings : [])
    .map(item => {
      const binding = item?.binding || item || {};
      return {
        selectionId: String(item?.uid || binding.selectionId || '').trim(),
        locations: normalizeLocations(binding.targets),
        thumbnail: thumbnails.get(String(item?.uid || binding.selectionId || '').trim()) || '',
      };
    })
    .filter(item => item.selectionId && item.locations.length);
}

function normalizeSelectionLocations(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => ({
      selectionId: String(item?.selectionId || '').trim(),
      locations: normalizeLocations(item?.locations),
      thumbnail: String(item?.thumbnail || item?.thumbnailUrl || ''),
    }))
    .filter(item => item.selectionId && item.locations.length);
}

function normalizeLocations(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => {
      const startLine = positiveNumber(item?.startLine || item?.line);
      return {
        file: String(item?.file || '').trim(),
        startLine,
        endLine: positiveNumber(item?.endLine || startLine),
        anchor: String(item?.anchor || sourceAnchor(item)).trim(),
      };
    })
    .filter(item => item.file && (item.startLine || item.anchor));
}

function sourceAnchor(item) {
  const source = String(item?.targetSnippet || item?.codeSnippet || '');
  return source.split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean)
    ?.slice(0, 240) || '';
}

function writeSelectionLocations(project, references) {
  for (const reference of references) {
    const file = selectionReferenceFile(project, reference.selectionId);
    atomicWrite(file, `${JSON.stringify({
      selectionId: reference.selectionId,
      locations: reference.locations,
      thumbnail: String(reference.thumbnail || ''),
    }, null, 2)}\n`);
  }
}

function thumbnailMap(value) {
  return new Map((Array.isArray(value) ? value : [])
    .map(item => [
      String(item?.selectionId || '').trim(),
      String(item?.thumbnail || item?.thumbnailUrl || ''),
    ])
    .filter(([selectionId, thumbnail]) => selectionId && thumbnail));
}

function projectThumbnailMap(project) {
  return new Map(loadProjectSelectionLocations(project)
    .map(reference => [reference.selectionId, reference.thumbnail])
    .filter(([, thumbnail]) => thumbnail));
}

function selectionReferenceFile(project, selectionId) {
  if (!project?.path) throw new Error('选区引用缺少项目目录');
  const safeId = String(selectionId || '').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(safeId)) throw new Error(`无效选区 ID：${safeId || '-'}`);
  return path.join(project.path, '.gocapture', SELECTIONS_DIR, `${safeId}.json`);
}

function positiveNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
}

module.exports = {
  SELECTIONS_DIR,
  deleteProjectSelectionLocations,
  loadProjectSelectionLocations,
  locationsFromBindings,
  normalizeSelectionLocations,
  persistLocatedSelectionReferences,
  selectionReferenceFile,
  updateProjectSelectionLocations,
};
