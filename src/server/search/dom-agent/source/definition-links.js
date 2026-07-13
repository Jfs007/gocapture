const { readProjectText } = require('../../../core/fs-utils');
const { escapeRegExp, uniq } = require('../../../utils');
const { buildFileMap } = require('../../import-trace');
const {
  sourceFiles,
  keywordIndexes,
  importChainFromParent,
} = require('../candidate/search-executor');
const {
  commentMask,
  candidateExcerpt,
  candidateSourceRole,
} = require('./source-role');

function definitionValueRefs(text, keywordFacts) {
  const source = String(text || '');
  const refs = [];
  const textKeywords = (keywordFacts || [])
    .filter(item => item.codeCount > 0 && item.type !== 'class-token')
    .map(item => String(item.keyword || '').trim())
    .filter(Boolean);
  for (const keyword of uniq(textKeywords)) {
    const escaped = escapeRegExp(keyword);
    const simplePattern = new RegExp(`([A-Za-z_$][\\w$-]*)\\s*:\\s*["'\`][^"'\`]{0,200}${escaped}[^"'\`]{0,200}["'\`]`, 'g');
    const nestedPattern = new RegExp(`([A-Za-z_$][\\w$-]*)\\s*:\\s*\\{[^{}\\n]{0,400}?([A-Za-z_$][\\w$-]*)\\s*:\\s*["'\`][^"'\`]{0,200}${escaped}[^"'\`]{0,200}["'\`]`, 'g');
    let match;
    while ((match = nestedPattern.exec(source)) && refs.length < 20) {
      refs.push({
        keyword,
        key: match[2],
        path: `${match[1]}.${match[2]}`,
      });
    }
    while ((match = simplePattern.exec(source)) && refs.length < 20) {
      const key = match[1];
      refs.push({ keyword, key, path: '' });
    }
  }
  return uniq(refs.map(item => JSON.stringify(item))).map(item => JSON.parse(item));
}

function identifierIndexes(text, identifier) {
  const source = String(text || '');
  const value = String(identifier || '').trim();
  if (!source || !value) return [];
  const pattern = new RegExp(`(?<![\\w$-])${escapeRegExp(value)}(?![\\w$-])`, 'g');
  const indexes = [];
  let match;
  while ((match = pattern.exec(source)) && indexes.length < 20) indexes.push(match.index);
  return indexes;
}

function definitionRefSearchTerms(project, refs, textCache) {
  const terms = [];
  const files = sourceFiles(project);
  const maxStandaloneKeyFiles = Math.min(20, Math.max(4, Math.ceil(files.length * 0.01)));
  for (const ref of refs || []) {
    if (ref.path) terms.push(ref.path);
    const key = String(ref.key || '');
    if (key.length < 4 || ref.path) continue;
    let fileCount = 0;
    for (const file of files) {
      const text = readProjectText(project, file, textCache);
      if (!identifierIndexes(text, key).length) continue;
      fileCount += 1;
      if (fileCount > maxStandaloneKeyFiles) break;
    }
    if (fileCount <= maxStandaloneKeyFiles) terms.push(key);
  }
  return uniq(terms);
}

function createDefinitionLinkedCandidate(project, file, text, terms, definitionFile) {
  const positions = uniq(terms.flatMap(term => keywordIndexes(text, term))).slice(0, 8);
  if (!positions.length) return null;
  return {
    file: file.path,
    score: 260 + positions.length * 18,
    matchedGroups: [{
      priority: 1,
      keywords: terms,
      range: 'same-file',
      reason: `定义值 key/path 在渲染源码中被使用：${definitionFile}`,
      source: 'definition-key-reference',
    }],
    matchedKeywords: terms,
    positions,
    definitionLinks: [{
      type: 'key-reference',
      definitionFile,
      terms,
    }],
  };
}

function enrichDefinitionCandidates(project, inspected, plan, textCache) {
  const fileMap = buildFileMap(project);
  const byFile = new Map(inspected.map(item => [item.file, item]));
  const renderCandidates = inspected.filter(item => !item.referenceOnly);
  const definitionCandidates = inspected.filter(item => {
    const hasStructuralEvidence = (item.keywordFacts || []).some(fact => {
      return fact.codeCount > 0
        && ['class-token', 'attribute-name', 'attribute-value'].includes(fact.type);
    });
    return item.sourceRole === 'definition-like' || (item.valueProvider && !hasStructuralEvidence);
  });

  for (const definition of definitionCandidates) {
    const links = [];
    for (const render of renderCandidates) {
      const chains = importChainFromParent(project, render.file, [definition.file], textCache, 3);
      const chain = chains.get(definition.file);
      if (chain) {
        links.push({
          type: 'import-relation',
          renderFile: render.file,
          chain,
        });
      }
    }
    if (links.length) {
      definition.definitionLinks = uniq([
        ...(definition.definitionLinks || []),
        ...links,
      ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
      definition.roleReasons = uniq([
        ...(definition.roleReasons || []),
        '定义文件被渲染候选通过 import 链引用，作为参考而非最终 DOM 源码',
      ]);
    }
  }

  for (const definition of definitionCandidates) {
    const file = fileMap.get(definition.file);
    const definitionText = file ? readProjectText(project, file, textCache) : '';
    const refs = definitionValueRefs(definitionText, definition.keywordFacts);
    const terms = definitionRefSearchTerms(project, refs, textCache);
    if (!terms.length) continue;
    const links = [];
    for (const candidate of renderCandidates) {
      const renderFile = fileMap.get(candidate.file);
      const renderText = renderFile ? readProjectText(project, renderFile, textCache) : '';
      const matchedTerms = terms.filter(term => keywordIndexes(renderText, term).length);
      if (!matchedTerms.length) continue;
      links.push({
        type: 'key-reference',
        renderFile: candidate.file,
        terms: matchedTerms,
      });
    }
    if (links.length) {
      definition.definitionLinks = uniq([
        ...(definition.definitionLinks || []),
        ...links,
      ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
      definition.roleReasons = uniq([
        ...(definition.roleReasons || []),
        '定义值可通过 key/path 在渲染候选中找到使用关系',
      ]);
      continue;
    }

    for (const sourceFile of sourceFiles(project)) {
      if (byFile.has(sourceFile.path) || sourceFile.path === definition.file) continue;
      const text = readProjectText(project, sourceFile, textCache);
      if (!text) continue;
      const roleInfo = candidateSourceRole(sourceFile.path, text);
      if (roleInfo.referenceOnly || roleInfo.role !== 'render-like') continue;
      const linked = createDefinitionLinkedCandidate(project, sourceFile, text, terms, definition.file);
      if (!linked) continue;
      const keywordFacts = terms.map(term => ({
        keyword: term,
        type: '',
        count: keywordIndexes(text, term).length,
        codeCount: keywordIndexes(commentMask(text), term).length,
        commentOnly: false,
      })).filter(item => item.count > 0);
      const inspectedCandidate = {
        file: linked.file,
        score: linked.score + keywordFacts.length * 24,
        matchedGroups: linked.matchedGroups,
        keywordFacts,
        commentOnly: [],
        sourceRole: roleInfo.role,
        referenceOnly: roleInfo.referenceOnly,
        roleReasons: [
          ...roleInfo.reasons,
          '由定义文件命中的文案 key/path 反查到渲染源码',
        ],
        importRelation: null,
        definitionLinks: linked.definitionLinks,
        excerpt: candidateExcerpt(text, linked),
      };
      byFile.set(inspectedCandidate.file, inspectedCandidate);
      renderCandidates.push(inspectedCandidate);
      links.push({
        type: 'key-reference',
        renderFile: inspectedCandidate.file,
        terms,
      });
      if (links.length >= 4) break;
    }
    if (links.length) {
      definition.definitionLinks = uniq([
        ...(definition.definitionLinks || []),
        ...links,
      ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
      definition.roleReasons = uniq([
        ...(definition.roleReasons || []),
        '定义值可通过 key/path 反查到渲染源码',
      ]);
    }
  }

  return Array.from(byFile.values());
}

module.exports = {
  enrichDefinitionCandidates,
};
