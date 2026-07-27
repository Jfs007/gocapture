'use strict';

const { normalizeSelectionLocations } = require('./selection-reference-store');

function applyStructuredTaskResult(task) {
  const source = Array.isArray(task.agentMessages) && task.agentMessages.length
    ? task.agentMessages.join('\n')
    : task.finalResponse;
  const objects = parseJsonObjects(source);
  if (!objects.length) return;
  const summaries = objects
    .map(item => String(item?.summary || '').trim())
    .filter(Boolean);
  const locations = normalizeSelectionLocations(
    objects.flatMap(item => Array.isArray(item?.selectionLocations)
      ? item.selectionLocations
      : []),
  );
  if (summaries.length) task.finalResponse = summaries[summaries.length - 1];
  task.selectionLocations = mergeSelectionLocations(locations);
}

function parseJsonObjects(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? [parsed] : [];
  } catch (error) {
  }

  const objects = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char !== '}' || depth === 0) continue;
    depth -= 1;
    if (depth !== 0 || start < 0) continue;
    try {
      const parsed = JSON.parse(text.slice(start, index + 1));
      if (parsed && typeof parsed === 'object') objects.push(parsed);
    } catch (error) {
    }
    start = -1;
  }
  return objects;
}

function mergeSelectionLocations(references) {
  const merged = new Map();
  for (const reference of references) {
    const current = merged.get(reference.selectionId) || [];
    for (const location of reference.locations) {
      const key = [
        location.file,
        location.startLine,
        location.endLine,
        location.anchor,
      ].join(':');
      if (!current.some(item => item.key === key)) current.push({ key, location });
    }
    merged.set(reference.selectionId, current);
  }
  return [...merged.entries()].map(([selectionId, items]) => ({
    selectionId,
    locations: items.map(item => item.location),
  }));
}

module.exports = {
  applyStructuredTaskResult,
  parseJsonObjects,
};
