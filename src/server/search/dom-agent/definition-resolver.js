const path = require('path');
const { readProjectText } = require('../../core/fs-utils');
const { uniq } = require('../../utils');
const { buildFileMap } = require('../import-trace');
const {
  MAX_DEFINITION_RESOLVER_SEARCHES,
  plannerDomInput,
} = require('./dom-utils');
const { normalizePlan } = require('./planner-utils');
const {
  keywordIndexes,
  importChainFromParent,
} = require('./search-executor');
const {
  commentMask,
  candidateExcerpt,
  candidateSourceRole,
} = require('./source-role');

function normalizeConfidence(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  if (number > 0 && number <= 1) return Math.round(number * 100);
  return Math.max(0, Math.min(100, Math.round(number)));
}

function unresolvedDefinitionCandidates(inspection) {
  return (inspection?.candidates || []).filter(candidate => {
    return candidate.sourceRole === 'definition-like'
      && !(candidate.definitionLinks || []).length;
  });
}

function createDefinitionOwnerCandidate(project, owner, definition, textCache) {
  const fileMap = buildFileMap(project);
  const file = fileMap.get(owner.file);
  const text = file ? readProjectText(project, file, textCache) : '';
  const roleInfo = candidateSourceRole(owner.file, text);
  if (roleInfo.referenceOnly || roleInfo.role !== 'render-like') return null;
  const basename = path.posix.basename(definition.file).replace(/\.[^.]+$/, '');
  const position = Math.max(0, text.indexOf(basename));
  return {
    file: owner.file,
    score: 340 - Math.max(0, Number(owner.depth || 0)) * 20,
    matchedGroups: [{
      priority: 1,
      keywords: (definition.keywordFacts || []).map(item => item.keyword).filter(Boolean),
      range: 'import-relation',
      reason: `渲染源码通过 import 链引用定义文件：${definition.file}`,
      source: 'definition-import-owner',
    }],
    keywordFacts: [],
    commentOnly: [],
    sourceRole: roleInfo.role,
    referenceOnly: false,
    roleReasons: [
      ...roleInfo.reasons,
      '由定义文件的反向 import 链找到渲染源码',
    ],
    importRelation: null,
    definitionLinks: [{
      type: 'import-relation',
      definitionFile: definition.file,
      chain: owner.chain || [],
    }],
    excerpt: owner.excerpt || candidateExcerpt(text, { positions: [position] }),
  };
}

function enrichDefinitionOwners(project, inspection, ownership, textCache) {
  const candidateMap = new Map((inspection?.candidates || []).map(candidate => [candidate.file, candidate]));
  for (const definition of unresolvedDefinitionCandidates(inspection)) {
    const matchingOwners = (ownership || []).filter(owner => {
      return Array.isArray(owner.chain)
        && owner.chain[0] === definition.file
        && owner.file !== definition.file;
    });
    for (const owner of matchingOwners) {
      const renderCandidate = createDefinitionOwnerCandidate(project, owner, definition, textCache);
      if (!renderCandidate) continue;
      const old = candidateMap.get(renderCandidate.file);
      if (old) {
        old.definitionLinks = uniq([
          ...(old.definitionLinks || []),
          ...renderCandidate.definitionLinks,
        ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
        old.roleReasons = uniq([...(old.roleReasons || []), ...renderCandidate.roleReasons]);
      } else {
        candidateMap.set(renderCandidate.file, renderCandidate);
      }
      definition.definitionLinks = uniq([
        ...(definition.definitionLinks || []),
        {
          type: 'import-relation',
          renderFile: renderCandidate.file,
          chain: owner.chain || [],
        },
      ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
      definition.roleReasons = uniq([
        ...(definition.roleReasons || []),
        '反向 import 链已找到真实渲染引用者',
      ]);
    }
  }
  const candidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
  const first = candidates[0];
  const second = candidates[1];
  const unique = !!first && (!second || first.score - second.score >= 90);
  return {
    status: unique ? 'unique' : candidates.length ? 'ambiguous' : 'empty',
    selectedFile: unique ? first.file : '',
    candidates,
  };
}

function buildDefinitionResolverPrompt(body, inspection, ownership) {
  const unresolved = unresolvedDefinitionCandidates(inspection);
  const primary = (inspection?.candidates || []).filter(candidate => !candidate.referenceOnly);
  return [
    '你是 Magnus 的定义来源关系分析器。只分析已给出的真实源码片段之间是否存在“定义 -> 渲染使用”关系。',
    '你的目标不是修改代码，也不是直接按用户需求猜文件。',
    '优先判断 definitionFiles 中的值、key 或访问路径，是否在 renderCandidates 或 owners 中被消费并最终生成当前 DOM。',
    '如果现有片段已经能确认关系，返回 linked。',
    '如果只能从现有片段中提取可继续本地检索的原样关键词，返回 search。',
    '完全无法判断则返回 unresolved。',
    '禁止编造文件、变量、key、路径或检索词。searches 中每个关键词必须逐字存在于本次输入的源码片段中。',
    '最多返回 2 组 searches。',
    '严格返回 JSON，不输出 Markdown：',
    '{"status":"linked|search|unresolved","relations":[{"definitionFile":"","renderFile":"","confidence":0,"reason":""}],"searches":[{"keywords":[""],"mode":"all|any","range":"same-file|same-structure","reason":""}]}',
    `用户需求（只用于理解 DOM 焦点）: ${body.userPrompt || ''}`,
    `选区摘要: ${JSON.stringify(plannerDomInput(body).map(item => ({
      index: item.index,
      tag: item.tag,
      selector: item.selector,
      className: item.className,
      text: item.text,
    })), null, 2)}`,
    `definitionFiles:\n${JSON.stringify(unresolved.map(candidate => ({
      file: candidate.file,
      matchedKeywords: (candidate.keywordFacts || []).map(item => item.keyword),
      excerpt: candidate.excerpt,
    })), null, 2)}`,
    `renderCandidates:\n${JSON.stringify(primary.map(candidate => ({
      file: candidate.file,
      excerpt: candidate.excerpt,
    })), null, 2)}`,
    `owners:\n${JSON.stringify((ownership || []).map(owner => ({
      file: owner.file,
      chain: owner.chain,
      excerpt: owner.excerpt,
    })), null, 2)}`,
  ].join('\n');
}

function definitionResolverCorpus(inspection, ownership) {
  return [
    ...((inspection?.candidates || []).flatMap(candidate => [
      candidate.file,
      candidate.excerpt,
    ])),
    ...((ownership || []).flatMap(owner => [
      owner.file,
      owner.excerpt,
      ...(owner.chain || []),
    ])),
  ].filter(Boolean).join('\n').toLowerCase();
}

function keywordExistsInCorpus(keyword, corpus) {
  const value = String(keyword || '').trim().toLowerCase();
  return !!value && String(corpus || '').includes(value);
}

function normalizeDefinitionResolver(parsed, inspection, ownership) {
  const unresolvedFiles = new Set(unresolvedDefinitionCandidates(inspection).map(item => item.file));
  const renderFiles = new Set([
    ...((inspection?.candidates || []).filter(item => !item.referenceOnly).map(item => item.file)),
    ...((ownership || []).map(item => item.file)),
  ]);
  const relations = (Array.isArray(parsed?.relations) ? parsed.relations : [])
    .map(item => ({
      definitionFile: String(item?.definitionFile || '').replace(/^\/+/, ''),
      renderFile: String(item?.renderFile || '').replace(/^\/+/, ''),
      confidence: normalizeConfidence(item?.confidence),
      reason: String(item?.reason || ''),
    }))
    .filter(item => unresolvedFiles.has(item.definitionFile) && renderFiles.has(item.renderFile));
  const corpus = definitionResolverCorpus(inspection, ownership);
  const removed = [];
  const searches = normalizePlan({ searches: parsed?.searches }).searches
    .slice(0, MAX_DEFINITION_RESOLVER_SEARCHES)
    .map(search => ({
      ...search,
      keywords: (search.keywords || []).filter(keyword => {
        const exists = keywordExistsInCorpus(keyword, corpus);
        if (!exists) removed.push(keyword);
        return exists;
      }),
    }))
    .filter(search => search.keywords.length);
  return {
    status: relations.length
      ? 'linked'
      : searches.length
        ? 'search'
        : 'unresolved',
    relations,
    searches,
    removed: uniq(removed),
  };
}

function applyDefinitionResolverRelations(project, inspection, relations, ownership, textCache) {
  if (!(relations || []).length) return inspection;
  const candidateMap = new Map((inspection?.candidates || []).map(candidate => [candidate.file, candidate]));
  for (const relation of relations) {
    const definition = candidateMap.get(relation.definitionFile);
    if (!definition) continue;
    const owner = (ownership || []).find(item => item.file === relation.renderFile);
    if (!candidateMap.has(relation.renderFile) && owner) {
      const renderCandidate = createDefinitionOwnerCandidate(project, owner, definition, textCache);
      if (renderCandidate) candidateMap.set(renderCandidate.file, renderCandidate);
    }
    const render = candidateMap.get(relation.renderFile);
    if (!render || render.referenceOnly) continue;
    definition.definitionLinks = uniq([
      ...(definition.definitionLinks || []),
      {
        type: 'model-validated-relation',
        renderFile: relation.renderFile,
        confidence: relation.confidence,
        reason: relation.reason,
      },
    ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
    render.definitionLinks = uniq([
      ...(render.definitionLinks || []),
      {
        type: 'model-validated-relation',
        definitionFile: relation.definitionFile,
        confidence: relation.confidence,
        reason: relation.reason,
      },
    ].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
  }
  const candidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
  return {
    status: candidates.length === 1 ? 'unique' : candidates.length ? 'ambiguous' : 'empty',
    selectedFile: candidates.length === 1 ? candidates[0].file : '',
    candidates,
  };
}

module.exports = {
  unresolvedDefinitionCandidates,
  enrichDefinitionOwners,
  buildDefinitionResolverPrompt,
  normalizeDefinitionResolver,
  applyDefinitionResolverRelations,
};
