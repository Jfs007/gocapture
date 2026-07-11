const path = require('path');
const { readProjectText } = require('../../core/fs-utils');
const { makeSnippet, uniq } = require('../../utils');
const { buildFileMap, importedFiles } = require('../import-trace');
const {
  MAX_OWNER_DEPTH,
  MAX_OWNERS_PER_CANDIDATE,
  MAX_ROUTE_RELATION_DEPTH,
} = require('./dom-utils');
const { keywordIndexes } = require('./search-matchers');

function filesRelatedByImport(project, file, textCache, maxHops = 2) {
  const fileMap = buildFileMap(project);
  const related = new Set([file]);
  let frontier = [file];
  for (let hop = 0; hop < maxHops; hop += 1) {
    const next = [];
    for (const current of frontier) {
      for (const child of importedFiles(project, current, fileMap, textCache)) {
        if (!related.has(child.file)) { related.add(child.file); next.push(child.file); }
      }
    }
    frontier = next;
  }
  const reverse = new Map();
  for (const source of fileMap.keys()) {
    for (const child of importedFiles(project, source, fileMap, textCache)) {
      const parents = reverse.get(child.file) || [];
      parents.push(source);
      reverse.set(child.file, parents);
    }
  }
  frontier = [file];
  for (let hop = 0; hop < maxHops; hop += 1) {
    const next = [];
    for (const current of frontier) {
      for (const parent of reverse.get(current) || []) {
        if (!related.has(parent)) { related.add(parent); next.push(parent); }
      }
    }
    frontier = next;
  }
  return related;
}

function validateOriginRelation(project, renderFile, originAnchors, textCache) {
  const anchors = uniq((originAnchors || []).map(value => String(value || '').trim()).filter(value => value.length >= 2));
  if (!anchors.length) return { valid: true, reason: 'no-origin-anchors' };
  const containsAnchor = filePath => {
    const fileObj = (project.files || []).find(item => item.path === filePath);
    if (!fileObj) return false;
    const text = readProjectText(project, fileObj, textCache);
    return anchors.some(anchor => keywordIndexes(text, anchor).length > 0);
  };
  if (containsAnchor(renderFile)) return { valid: true, reason: 'direct' };
  for (const related of filesRelatedByImport(project, renderFile, textCache, 2)) {
    if (related !== renderFile && containsAnchor(related)) {
      return { valid: true, reason: `reference:${related}` };
    }
  }
  return { valid: false, reason: '与原始选区锚点既无直接包含、也无 import 引用关系' };
}

function routeConfirmedOriginFiles(renderCandidates, routeTrace, routeRelations) {
  const exactPageFile = String(routeTrace?.bestPageFile || '').trim();
  if (!exactPageFile) return [];
  const renderFiles = new Set((renderCandidates || []).map(candidate => candidate?.file).filter(Boolean));
  return uniq((routeRelations || [])
    .filter(relation => relation?.routeFile === exactPageFile && renderFiles.has(relation?.candidateFile))
    .map(relation => relation.candidateFile));
}

function globPatternMatches(fromFile, pattern, targetFile) {
  if (!pattern || !pattern.includes('*')) return false;
  const absolutePattern = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), pattern));
  const regex = new RegExp(`^${absolutePattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*')}$`);
  return regex.test(targetFile);
}

function dynamicGlobTargets(text) {
  const patterns = [];
  const regex = /import\.meta\.glob\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(String(text || ''))) && patterns.length < 20) {
    patterns.push(match[1]);
  }
  return patterns;
}

function traceCandidateOwners(project, selectedFiles, textCache) {
  const fileMap = buildFileMap(project);
  const reverse = new Map();
  for (const file of fileMap.keys()) {
    for (const child of importedFiles(project, file, fileMap, textCache)) {
      const parents = reverse.get(child.file) || [];
      parents.push(file);
      reverse.set(child.file, uniq(parents));
    }
    const source = readProjectText(project, fileMap.get(file), textCache);
    for (const pattern of dynamicGlobTargets(source)) {
      for (const target of fileMap.keys()) {
        if (!globPatternMatches(file, pattern, target)) continue;
        const parents = reverse.get(target) || [];
        parents.push(file);
        reverse.set(target, uniq(parents));
      }
    }
  }
  const result = [];
  for (const selectedFile of selectedFiles) {
    let ownerCount = 0;
    const queue = [{ file: selectedFile, depth: 0, chain: [selectedFile] }];
    const visited = new Set([selectedFile]);
    while (queue.length && ownerCount < MAX_OWNERS_PER_CANDIDATE) {
      const current = queue.shift();
      if (current.depth >= MAX_OWNER_DEPTH) continue;
      for (const parent of reverse.get(current.file) || []) {
        if (visited.has(parent)) continue;
        visited.add(parent);
        const parentFile = fileMap.get(parent);
        const text = parentFile ? readProjectText(project, parentFile, textCache) : '';
        const basename = path.posix.basename(current.file).replace(/\.[^.]+$/, '');
        const position = Math.max(0, text.indexOf(basename));
        const chain = [...current.chain, parent];
        result.push({
          candidateFile: selectedFile,
          file: parent,
          depth: current.depth + 1,
          chain,
          excerpt: makeSnippet(text, position, basename.length).slice(0, 3000),
        });
        ownerCount += 1;
        if (ownerCount >= MAX_OWNERS_PER_CANDIDATE) break;
        queue.push({ file: parent, depth: current.depth + 1, chain });
      }
    }
  }
  return result;
}

function traceRouteCandidateRelations(project, routeTrace, candidates, textCache) {
  const fileMap = buildFileMap(project);
  const candidateFiles = new Set((candidates || [])
    .filter(candidate => !candidate.referenceOnly)
    .map(candidate => candidate.file)
    .filter(file => fileMap.has(file)));
  if (!candidateFiles.size) return [];
  const routeFiles = uniq([
    routeTrace?.bestPageFile || '',
    routeTrace?.bestRoute?.sourceFile || '',
    ...((routeTrace?.hits || []).map(hit => hit?.file || '')),
    ...((routeTrace?.hits || []).map(hit => hit?.from || '')),
  ]).filter(file => fileMap.has(file));
  const relationByCandidate = new Map();
  for (const routeFile of routeFiles) {
    const queue = [{ file: routeFile, depth: 0, chain: [routeFile] }];
    const visited = new Set([routeFile]);
    while (queue.length) {
      const current = queue.shift();
      if (candidateFiles.has(current.file)) {
        const old = relationByCandidate.get(current.file);
        if (!old || current.depth < old.depth) {
          relationByCandidate.set(current.file, {
            candidateFile: current.file,
            routeFile,
            depth: current.depth,
            chain: current.chain,
          });
        }
      }
      if (current.depth >= MAX_ROUTE_RELATION_DEPTH) continue;
      if (current.depth > 0 && /(?:^|\/)(?:store|stores|api|apis|router|routers|init|util|utils|service|services|infrastructure)(?:\/|$)/i.test(current.file)) {
        continue;
      }
      for (const child of importedFiles(project, current.file, fileMap, textCache)) {
        if (visited.has(child.file)) continue;
        visited.add(child.file);
        queue.push({
          file: child.file,
          depth: current.depth + 1,
          chain: [...current.chain, child.file],
        });
      }
    }
  }
  return Array.from(relationByCandidate.values())
    .sort((a, b) => a.depth - b.depth || a.candidateFile.localeCompare(b.candidateFile));
}

module.exports = {
  filesRelatedByImport,
  validateOriginRelation,
  routeConfirmedOriginFiles,
  traceCandidateOwners,
  traceRouteCandidateRelations,
};
