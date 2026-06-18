const fs = require('fs');
const path = require('path');
const {
  MAX_SNIPPET_BYTES,
  SKIP_DIRS,
  TEXT_EXTENSIONS,
} = require('./config');
const { posixPath } = require('../utils');

function isSkipped(relPath) {
  return posixPath(relPath).split('/').some(part => SKIP_DIRS.has(part));
}

function isTextFile(relPath) {
  return TEXT_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}

function safeReadText(filePath, maxBytes = MAX_SNIPPET_BYTES) {
  const stat = fs.statSync(filePath);
  if (stat.size > maxBytes) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function readProjectText(project, file, cache) {
  if (cache && cache.has(file.path)) return cache.get(file.path);
  let text = '';
  try {
    text = safeReadText(path.join(project.path, file.path), MAX_SNIPPET_BYTES);
  } catch (error) {
  }
  if (cache) cache.set(file.path, text);
  return text;
}

module.exports = {
  isSkipped,
  isTextFile,
  readProjectText,
  safeReadText,
};
