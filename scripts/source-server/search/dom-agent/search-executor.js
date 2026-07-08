const { readProjectText } = require('../../core/fs-utils');
const { uniq } = require('../../utils');
const { buildFileMap, importedFiles } = require('../import-trace');
const {
  MAX_INHERITED_KEYWORDS,
  DF_SCOPE_LIMIT,
} = require('./dom-utils');
const { inheritedSearchKeywords } = require('./planner-utils');
const {
  sourceFiles,
  keywordIndexes,
  classTokenIndexes,
  keywordType,
  textEvidenceIndexes,
  keywordIndexesForSearch,
  collectGroupHits,
  searchLayer,
  candidateSort,
  bestKeywordWindow,
} = require('./search-matchers');

// 稀有度加权 + 共现收敛的候选检索。
// 关键改动（相对旧实现）：
//  1. 先做一遍全库文档频率(df)统计，得到每个锚点的稀有度(idf)。
//  2. 通用外壳/框架词(df>DF_SCOPE_LIMIT)不再单独生成候选，只作为已有候选的缩范围加成——
//     彻底消除「一个不可满足的 AND 组退化成成百上千个单词候选」的洪水。
//  3. 判别性锚点(稀有词)在同一文件共现越多，得分越高(共现平方加成)，让真正渲染该区域的文件胜出。
function executeSearchPlan(project, plan, textCache) {
  const files = sourceFiles(project);
  const totalFiles = files.length || 1;

  // Pass 1：收集每个文件的命中并统计文档频率。
  const df = new Map();
  const perFile = [];
  for (const file of files) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const groups = [];
    const seen = new Set();
    for (const search of plan.searches) {
      const hits = collectGroupHits(text, search, file.path);
      if (!hits.size) continue;
      groups.push({ search, hits });
      for (const keyword of hits.keys()) {
        if (seen.has(keyword)) continue;
        seen.add(keyword);
        df.set(keyword, (df.get(keyword) || 0) + 1);
      }
    }
    if (groups.length) perFile.push({ file: file.path, groups });
  }

  const idf = keyword => Math.log((totalFiles + 1) / ((df.get(keyword) || 0) + 1)) + 1;
  const isRare = keyword => (df.get(keyword) || 0) <= DF_SCOPE_LIMIT;

  // 严格共现组(same-structure all，即 render 组)的两阶段准入：
  //  1) 优先取「完整 AND 命中」的文件；
  //  2) 若全库都没有完整命中，则取「所有共现≥2 个稀有锚点」的文件——
  //     不再只取「命中最多的那一个」。因为数据驱动场景里，配置/路由文件常常命中最多的文案/路径锚点，
  //     若只保留最大子集会把「只命中业务 class（如 main-layout-left-menu）」的真实渲染组件挤掉。
  //     这里把它们都保留为候选，再由角色判定(definition-like 参考文件不算渲染)与 Judge 收敛。
  const strictAdmission = new Map();
  for (const search of plan.searches) {
    if (!(search.mode === 'all' && search.range === 'same-structure')) continue;
    const matched = [];
    for (const { file, groups } of perFile) {
      const group = groups.find(item => item.search === search);
      if (!group) continue;
      const window = bestKeywordWindow(group.hits, search.keywords);
      const rareWindow = bestKeywordWindow(
        group.hits,
        search.keywords.filter(isRare)
      );
      matched.push({
        file,
        keywords: window.keywords,
        rareKeywords: rareWindow.keywords,
        positions: window.positions,
        rarePositions: rareWindow.positions,
      });
    }
    const full = matched.filter(item => item.keywords.length === search.keywords.length);
    const admitted = full.length
      ? full
      : matched
        .filter(item => item.rareKeywords.length >= 2)
        .map(item => ({
          ...item,
          keywords: item.rareKeywords,
          positions: item.rarePositions,
        }));
    strictAdmission.set(search, new Map(admitted.map(item => [item.file, item])));
  }

  // Pass 2：打分。先处理 render/child 组建立候选，再用 scope 组给已有候选加成。
  const candidateMap = new Map();
  for (const { file, groups } of perFile) {
    const rareRenderAnchors = new Set();

    for (const { search, hits } of groups) {
      const layer = searchLayer(search);
      if (layer === 'scope') continue;
      const isStrict = search.mode === 'all' && search.range === 'same-structure';

      // ——严格共现组：只有通过两阶段准入的文件才生成 planned-group，绝不做单点回退。
      if (isStrict) {
        const admitted = strictAdmission.get(search)?.get(file);
        if (!admitted) continue;
        const keywords = admitted.keywords;
        const rareKeywords = keywords.filter(isRare);
        upsertCandidate(candidateMap, file, {
          score: Math.round(
            Math.max(40, 220 - (search.priority - 1) * 30)
            + keywords.reduce((sum, keyword) => sum + idf(keyword), 0) * 12
            + rareKeywords.length * rareKeywords.length * 20
            + (layer === 'child' ? -60 : 0)
          ),
          matchedGroup: {
            priority: search.priority,
            keywords,
            range: search.range,
            reason: search.reason,
            source: 'planned-group',
            layer,
          },
          keywords,
          positions: admitted.positions.slice(0, 6),
        });
        if (layer === 'child') markChildCandidate(candidateMap, file);
        if (layer === 'render') for (const keyword of rareKeywords) rareRenderAnchors.add(keyword);
        continue;
      }

      // ——非严格组(any / all-same-file)：完整命中记 planned-group；AND 部分命中时对稀有锚点做单点回退。
      const keywords = [...hits.keys()];
      const positions = keywords.flatMap(keyword => hits.get(keyword).slice(0, 2));
      const allMatched = keywords.length === search.keywords.length;
      const accepted = search.mode === 'any' ? true : allMatched;
      const rareKeywords = keywords.filter(isRare);

      if (accepted && keywords.length) {
        upsertCandidate(candidateMap, file, {
          score: Math.round(
            Math.max(40, 220 - (search.priority - 1) * 30)
            + keywords.reduce((sum, keyword) => sum + idf(keyword), 0) * 12
            + rareKeywords.length * rareKeywords.length * 20
            + (layer === 'child' ? -60 : 0)
          ),
          matchedGroup: {
            priority: search.priority,
            keywords,
            range: search.range,
            reason: search.reason,
            source: 'planned-group',
            layer,
          },
          keywords,
          positions: positions.slice(0, 6),
        });
        if (layer === 'child') markChildCandidate(candidateMap, file);
      }

      if (!accepted) {
        for (const keyword of rareKeywords) {
          upsertCandidate(candidateMap, file, {
            score: Math.round(Math.max(10, 60 - (search.priority - 1) * 8) + idf(keyword) * 10),
            matchedGroup: {
              priority: search.priority,
              keywords: [keyword],
              range: 'same-file',
              reason: `单点稀有证据：${search.reason || keyword}`,
              source: 'keyword-fallback',
              layer,
            },
            keywords: [keyword],
            positions: hits.get(keyword).slice(0, 3),
          });
          if (layer === 'child') markChildCandidate(candidateMap, file);
        }
      }

      if (layer === 'render') for (const keyword of rareKeywords) rareRenderAnchors.add(keyword);
    }

    // ——scope 组：
    //  · 稀有(判别性)范围锚点(df≤DF_SCOPE_LIMIT，如业务 class x-menu)可以独立生成一个弱候选——
    //    它往往正是「渲染该 DOM 的组件」的身份标识；不能因为 LLM 把它放进了 scope 层就永远搜不到它所在的文件。
    //  · 通用外壳词(df>DF_SCOPE_LIMIT，如 dc-fieldset)仍然只做缩范围加成、不造候选，避免噪音。
    //  · 对已是候选的文件，所有 scope 锚点都追加一点加成。
    for (const { search, hits } of groups) {
      if (searchLayer(search) !== 'scope') continue;
      const keywords = [...hits.keys()];
      for (const keyword of keywords) {
        if (!isRare(keyword)) continue;
        upsertCandidate(candidateMap, file, {
          score: Math.round(Math.max(8, 36 - (search.priority - 1) * 4) + idf(keyword) * 8),
          matchedGroup: {
            priority: search.priority,
            keywords: [keyword],
            range: 'same-file',
            reason: `范围锚点(稀有，可能是渲染组件身份)：${keyword}`,
            source: 'scope-anchor',
            layer: 'scope',
          },
          keywords: [keyword],
          positions: hits.get(keyword).slice(0, 3),
        });
      }
      if (candidateMap.has(file)) {
        const candidate = candidateMap.get(file);
        candidate.score += Math.round(keywords.reduce((sum, keyword) => sum + idf(keyword), 0) * 4);
        candidate.scopeAnchors = uniq([...(candidate.scopeAnchors || []), ...keywords]);
      }
    }

    // ——稀有锚点共现加成：真正渲染该区域的文件会同时聚集多个判别性锚点。
    if (rareRenderAnchors.size >= 2 && candidateMap.has(file)) {
      const anchors = [...rareRenderAnchors];
      const candidate = candidateMap.get(file);
      candidate.score += Math.round(
        anchors.length * anchors.length * 18
        + anchors.reduce((sum, keyword) => sum + idf(keyword), 0) * 8
      );
      candidate.rareAnchorCount = anchors.length;
      candidate.rareAnchors = anchors;
    }
  }

  const ranked = Array.from(candidateMap.values())
    .map(candidate => ({
      ...candidate,
      matchedKeywords: uniq(candidate.matchedKeywords),
      positions: uniq(candidate.positions).sort((a, b) => a - b),
    }));
  return ranked.sort(candidateSort);
}

function markChildCandidate(candidateMap, file) {
  const candidate = candidateMap.get(file);
  if (candidate) candidate.childComponentCandidate = true;
}

function previousCandidateKeywords(previousCandidate, fallbackKeywords = []) {
  return uniq([
    ...fallbackKeywords,
    ...((previousCandidate?.matchedGroups || []).flatMap(group => group?.keywords || [])),
  ].map(value => String(value || '').trim()).filter(value => value.length >= 2))
    .slice(0, MAX_INHERITED_KEYWORDS);
}

function importChainFromParent(project, parentFile, targetFiles, textCache, maxDepth = 5) {
  const targets = new Set(targetFiles);
  if (!parentFile || !targets.size) return new Map();
  const fileMap = buildFileMap(project);
  const found = new Map();
  const queue = [{ file: parentFile, depth: 0, chain: [parentFile] }];
  const visited = new Set([parentFile]);
  while (queue.length && found.size < targets.size) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const child of importedFiles(project, current.file, fileMap, textCache)) {
      if (visited.has(child.file)) continue;
      visited.add(child.file);
      const chain = [...current.chain, child.file];
      if (targets.has(child.file)) found.set(child.file, chain);
      queue.push({ file: child.file, depth: current.depth + 1, chain });
    }
  }
  return found;
}

function expansionRelatedCandidateHits(project, currentCandidates, agentState, textCache) {
  if (!agentState?.expansionRetry) return { candidates: [], relations: [] };
  const previousCandidates = (Array.isArray(agentState.previousCandidates) ? agentState.previousCandidates : [])
    .filter(item => item?.file);
  if (!previousCandidates.length || !currentCandidates.length) return { candidates: [], relations: [] };

  const inherited = inheritedSearchKeywords(agentState);
  const previousByFile = new Map(previousCandidates.map(item => [item.file, item]));
  const previousFiles = Array.from(previousByFile.keys());
  const currentFiles = new Set(currentCandidates.map(item => item.file));
  const candidateMap = new Map();
  const relations = [];

  for (const parent of currentCandidates) {
    const chains = importChainFromParent(project, parent.file, previousFiles, textCache);
    for (const [childFile, chain] of chains.entries()) {
      if (currentFiles.has(childFile)) continue;
      const previous = previousByFile.get(childFile);
      const keywords = previousCandidateKeywords(previous, inherited);
      if (!keywords.length) continue;
      const file = (project.files || []).find(item => item.path === childFile);
      const text = file ? readProjectText(project, file, textCache) : '';
      const positions = uniq(keywords.flatMap(keyword => keywordIndexes(text, keyword))).slice(0, 8);
      if (!positions.length) continue;
      upsertCandidate(candidateMap, childFile, {
        score: Math.max(180, Math.floor((parent.score || 0) * 0.72)) + positions.length * 16,
        matchedGroup: {
          priority: 1,
          keywords,
          range: 'import-relation',
          reason: `扩区引用链验证：${parent.file} 命中新锚点并引用上一轮候选 ${childFile}`,
          source: 'import-relation',
        },
        keywords,
        positions,
      });
      const old = candidateMap.get(childFile);
      old.importRelation = {
        parentFile: parent.file,
        childFile,
        chain,
        inheritedKeywords: keywords,
        parentKeywords: parent.matchedKeywords || [],
      };
      relations.push(old.importRelation);
    }
  }

  return {
    candidates: Array.from(candidateMap.values()),
    relations,
  };
}

function upsertCandidate(candidateMap, filePath, patch) {
  const old = candidateMap.get(filePath) || {
    file: filePath,
    score: 0,
    matchedGroups: [],
    matchedKeywords: [],
    positions: [],
  };
  old.score += Number(patch.score || 0);
  if (patch.matchedGroup) old.matchedGroups.push(patch.matchedGroup);
  old.matchedKeywords.push(...(patch.keywords || []));
  old.positions.push(...(patch.positions || []));
  candidateMap.set(filePath, old);
}

module.exports = {
  sourceFiles,
  keywordIndexes,
  classTokenIndexes,
  keywordType,
  textEvidenceIndexes,
  keywordIndexesForSearch,
  searchLayer,
  candidateSort,
  executeSearchPlan,
  importChainFromParent,
  expansionRelatedCandidateHits,
};
