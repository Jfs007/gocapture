const path = require('path');
const { isTextFile, readProjectText } = require('../core/fs-utils');
const { posixPath, uniq } = require('../utils');

const SOURCE_EXTENSIONS = ['.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

function importSpecifiers(text) {
  const specs = [];
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) && specs.length < 120) {
      specs.push(match[1]);
    }
  }
  return uniq(specs);
}

function candidatePathsForImport(fromFile, specifier) {
  if (!specifier || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(specifier)) return [];
  let base = '';
  if (specifier.startsWith('.')) {
    base = posixPath(path.posix.join(path.posix.dirname(fromFile), specifier));
  } else if (specifier.startsWith('@/')) {
    const aliasPath = posixPath(specifier.slice(2));
    return importPathCandidates(aliasPath, posixPath(path.posix.join('src', aliasPath)));
  } else if (specifier.startsWith('~/')) {
    const aliasPath = posixPath(specifier.slice(2));
    return importPathCandidates(aliasPath, posixPath(path.posix.join('src', aliasPath)));
  } else if (specifier.startsWith('src/')) {
    base = posixPath(specifier);
  } else {
    return [];
  }

  return importPathCandidates(base);
}

function importPathCandidates(...bases) {
  const result = [];
  for (const base of uniq(bases)) {
    const ext = path.posix.extname(base);
    const paths = ext ? [base] : SOURCE_EXTENSIONS.map(item => `${base}${item}`);
    if (!ext) {
      for (const item of SOURCE_EXTENSIONS) paths.push(`${base}/index${item}`);
    }
    result.push(...paths);
  }
  return uniq(result);
}

function buildFileMap(project) {
  const map = new Map();
  for (const file of project.files || []) {
    if (isTextFile(file.path)) map.set(file.path, file);
  }
  return map;
}

function importedFiles(project, filePath, fileMap, textCache) {
  const file = fileMap.get(filePath);
  if (!file) return [];
  const text = readProjectText(project, file, textCache);
  const result = [];
  for (const specifier of importSpecifiers(text)) {
    for (const candidate of candidatePathsForImport(filePath, specifier)) {
      if (fileMap.has(candidate)) {
        result.push({ file: candidate, specifier });
        break;
      }
    }
  }
  return result;
}

module.exports = {
  buildFileMap,
  importedFiles,
  importSpecifiers,
};
