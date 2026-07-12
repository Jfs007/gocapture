const { readProjectText } = require('../../core/fs-utils');
const { escapeRegExp, uniq } = require('../../utils');
const { compactWhitespace } = require('./dom-utils');
const {
  keywordType,
  keywordIndexesForSearch,
} = require('./search-executor');
const {
  commentMask,
  candidateExcerpt,
  candidateSourceRole,
} = require('./source-role');
const { enrichDefinitionCandidates } = require('./definition-links');
const {
  directTextStructureMismatch,
  domTextAnchors,
  sourceDomTextCoverage,
  originalDomClassTokens,
  sourceDomClassCoverage,
} = require('./source-structure');

function hasPlannedGroupMatch(candidate) {
  return (candidate?.matchedGroups || []).some(group => {
    return group?.source === 'planned-group' && (group.keywords || []).length >= 2;
  });
}

function plannedGroupTargetBonus(matchedGroups, body) {
  const prompt = compactWhitespace(body?.userPrompt || '');
  if (!prompt) return 0;
  let bonus = 0;
  for (const group of matchedGroups || []) {
    if (group?.source !== 'planned-group') continue;
    const keywords = group.keywords || [];
    if (keywords.length < 2) continue;
    bonus += keywords.length * 30;
    if (keywords.some(keyword => prompt.includes(String(keyword || '').trim()))) {
      bonus += 180;
    }
  }
  return bonus;
}

function candidateEffectiveKeywordSet(candidate) {
  return new Set((candidate?.keywordFacts || [])
    .filter(item => item.codeCount > 0 && !item.structureMismatch)
    .map(item => item.keyword));
}

function pruneStrictDomCoverageSubsets(inspected) {
  const renderCandidates = inspected.filter(candidate => !candidate.referenceOnly);
  return inspected.filter(candidate => {
    if (candidate.referenceOnly) return true;
    if (candidate.valueProvider) return true;
    if (hasPlannedGroupMatch(candidate)) return true;
    const own = new Set(candidate.domCoverage?.matchedClasses || []);
    if (!own.size) return true;
    const ownTextCount = candidate.domTextCoverage?.matchedTextCount || 0;
    return !renderCandidates.some(other => {
      if (other === candidate) return false;
      const otherClasses = new Set(other.domCoverage?.matchedClasses || []);
      if (otherClasses.size < 2 || otherClasses.size <= own.size) return false;
      const otherTextCount = other.domTextCoverage?.matchedTextCount || 0;
      if (ownTextCount > otherTextCount) return false;
      return Array.from(own).every(className => otherClasses.has(className));
    });
  });
}

function pruneTextOnlyRenderCandidates(inspected, plan) {
  const structuralKeywords = new Set((plan?.searches || []).flatMap(search => {
    return (search.keywords || []).filter(keyword => {
      const kind = search?.evidenceKinds?.[keyword];
      const type = search?.keywordTypes?.[keyword];
      return kind === 'class'
        || type === 'attribute-name'
        || type === 'attribute-value';
    });
  }));
  if (!structuralKeywords.size) return inspected;
  const hasStructuralRender = inspected.some(candidate => {
    if (candidate.referenceOnly) return false;
    const evidence = candidateEffectiveKeywordSet(candidate);
    return Array.from(structuralKeywords).some(keyword => evidence.has(keyword));
  });
  if (!hasStructuralRender) return inspected;
  return inspected.filter(candidate => {
    if (candidate.referenceOnly) return true;
    if (candidate.valueProvider) return true;
    if (hasPlannedGroupMatch(candidate)) return true;
    const evidence = candidateEffectiveKeywordSet(candidate);
    const structuralMatch = Array.from(structuralKeywords).some(keyword => evidence.has(keyword));
    if (structuralMatch) return true;
    candidate.roleReasons = uniq([
      ...(candidate.roleReasons || []),
      '仅命中复合容器后代文案，未命中任何 DOM 结构锚点',
    ]);
    return false;
  });
}

function candidateHasExactQuotedKeyword(candidate) {
  const excerpt = String(candidate?.excerpt || '');
  return (candidate?.keywordFacts || []).some(item => {
    const keyword = String(item?.keyword || '').trim();
    if (!keyword) return false;
    return new RegExp(`["'\`]\\s*${escapeRegExp(keyword)}\\s*["'\`]`).test(excerpt);
  });
}

function candidateSearchKeywords(candidate, search, includeCommentOnly = false) {
  const facts = candidate?.keywordFacts || [];
  return uniq((search?.keywords || []).filter(keyword => {
    const expectedType = keywordType(search, keyword);
    return facts.some(item => {
      if (item.keyword !== keyword || item.type !== expectedType || item.structureMismatch) return false;
      return includeCommentOnly ? item.count > 0 : item.codeCount > 0;
    });
  }));
}

function pruneDominatedDomCandidates(inspected, plan) {
  const searches = (plan?.searches || []).filter(search => {
    return uniq(search.keywords || []).length >= 2;
  });
  const dominantGroups = searches.flatMap(search => {
    const required = uniq(search.keywords || []);
    const complete = inspected.filter(candidate => {
      if (candidate.referenceOnly || candidate.sourceRole !== 'render-like') return false;
      return candidateSearchKeywords(candidate, search).length === required.length;
    });
    return complete.length === 1 ? [{
      search,
      required,
      winner: complete[0],
      matches: (candidate, includeCommentOnly = false) => {
        return candidateSearchKeywords(candidate, search, includeCommentOnly);
      },
    }] : [];
  });

  const plannedKeywords = uniq((plan?.searches || [])
    .flatMap(search => search.keywords || [])
    .map(keyword => String(keyword || '').trim())
    .filter(Boolean));
  if (plannedKeywords.length >= 2) {
    const completeAcrossGroups = inspected.filter(candidate => {
      if (candidate.referenceOnly || candidate.sourceRole !== 'render-like') return false;
      const evidence = candidateEffectiveKeywordSet(candidate);
      return plannedKeywords.every(keyword => evidence.has(keyword));
    });
    if (completeAcrossGroups.length === 1 && !dominantGroups.some(group => {
      return group.winner === completeAcrossGroups[0]
        && group.required.length === plannedKeywords.length;
    })) {
      dominantGroups.push({
        search: null,
        required: plannedKeywords,
        winner: completeAcrossGroups[0],
        matches: (candidate, includeCommentOnly = false) => {
          const facts = candidate?.keywordFacts || [];
          return plannedKeywords.filter(keyword => facts.some(item => {
            if (item.keyword !== keyword || item.structureMismatch) return false;
            return includeCommentOnly ? item.count > 0 : item.codeCount > 0;
          }));
        },
      });
    }
  }
  if (!dominantGroups.length) return inspected;

  for (const group of dominantGroups) {
    group.winner.roleReasons = uniq([
      ...(group.winner.roleReasons || []),
      `唯一完整覆盖检索组（${group.required.join(' + ')}），局部命中候选按组淘汰`,
    ]);
  }

  return inspected.filter(candidate => {
    if (dominantGroups.some(group => candidate === group.winner)) return true;
    if (candidate.importRelation || (candidate.definitionLinks || []).length) return true;
    if (candidate.valueProvider && candidateHasExactQuotedKeyword(candidate)) return true;
    if (candidate.referenceOnly) {
      if (candidate.sourceRole === 'style-reference') return true;
      return candidateHasExactQuotedKeyword(candidate);
    }

    const completesAnotherGroup = searches.some(search => {
      const required = uniq(search.keywords || []);
      return candidateSearchKeywords(candidate, search).length === required.length;
    });
    if (completesAnotherGroup) return true;

    return !dominantGroups.some(group => {
      const effectiveMatches = group.matches(candidate);
      if (effectiveMatches.length > 0 && effectiveMatches.length < group.required.length) return true;
      const rawMatches = group.matches(candidate, true);
      return rawMatches.length > 0 && effectiveMatches.length === 0;
    });
  });
}

function inspectCandidates(project, candidates, plan, textCache, body = null) {
  const domClasses = originalDomClassTokens(body);
  const textAnchors = domTextAnchors(body);
  let inspected = candidates.map(candidate => {
    const file = (project.files || []).find(item => item.path === candidate.file);
    const text = file ? readProjectText(project, file, textCache) : '';
    const masked = commentMask(text);
    const roleInfo = candidateSourceRole(candidate.file, text);
    const keywordFacts = uniq(plan.searches.flatMap(search => {
      return (search.keywords || []).map(keyword => ({
        keyword,
        type: keywordType(search, keyword),
        search,
      }));
    }).map(item => JSON.stringify({
      keyword: item.keyword,
      type: item.type || '',
    }))).map(value => JSON.parse(value)).map(item => {
      const search = (plan.searches || []).find(searchItem => {
        return (searchItem.keywords || []).includes(item.keyword)
          && keywordType(searchItem, item.keyword) === item.type;
      }) || { keywords: [item.keyword], keywordTypes: item.type ? { [item.keyword]: item.type } : {} };
      const allCount = keywordIndexesForSearch(text, item.keyword, search, candidate.file).length;
      const codeCount = keywordIndexesForSearch(masked, item.keyword, search, candidate.file).length;
      const structureMismatch = item.type
        ? null
        : directTextStructureMismatch(masked, item.keyword, plan);
      return {
        keyword: item.keyword,
        type: item.type || '',
        count: allCount,
        codeCount: structureMismatch ? 0 : codeCount,
        commentOnly: allCount > 0 && codeCount === 0,
        structureMismatch,
      };
    }).filter(item => item.count > 0);
    const codeMatches = keywordFacts.filter(item => item.codeCount > 0).length;
    const commentOnly = keywordFacts.filter(item => item.commentOnly).map(item => item.keyword);
    const structureMismatches = keywordFacts
      .filter(item => item.structureMismatch)
      .map(item => item.structureMismatch);
    const mismatchedKeywords = new Set(structureMismatches.map(item => item.keyword));
    const matchedGroups = (candidate.matchedGroups || []).map(group => ({
      ...group,
      keywords: (group.keywords || []).filter(keyword => !mismatchedKeywords.has(keyword)),
    })).filter(group => group.keywords.length);
    const rolePenalty = roleInfo.referenceOnly ? 80 : 0;
    const domTextCoverage = sourceDomTextCoverage(masked, textAnchors);
    const localScore = candidate.score
      + codeMatches * 24
      + domTextCoverage.matchedTextCount * 50
      + plannedGroupTargetBonus(matchedGroups, body)
      - commentOnly.length * 40
      - structureMismatches.length * 140
      - rolePenalty;
    return {
      file: candidate.file,
      score: localScore,
      matchedGroups,
      keywordFacts,
      commentOnly,
      structureMismatches,
      sourceRole: roleInfo.role,
      referenceOnly: roleInfo.referenceOnly,
      valueProvider: !!roleInfo.valueProvider,
      roleReasons: roleInfo.reasons,
      importRelation: candidate.importRelation || null,
      definitionLinks: candidate.definitionLinks || [],
      domCoverage: sourceDomClassCoverage(masked, candidate.file, domClasses),
      domTextCoverage,
      childComponentCandidate: !!candidate.childComponentCandidate,
      rareAnchorCount: Number(candidate.rareAnchorCount || 0),
      excerpt: candidateExcerpt(text, candidate),
    };
  }).filter(candidate => candidate.matchedGroups.length);
  inspected = pruneTextOnlyRenderCandidates(inspected, plan);
  inspected = pruneStrictDomCoverageSubsets(inspected);
  inspected = pruneDominatedDomCandidates(inspected, plan);
  inspected = enrichDefinitionCandidates(project, inspected, plan, textCache)
    .sort((a, b) => b.score - a.score);
  const first = inspected[0];
  const second = inspected[1];
  const unique = !!first && (
    !second
      || first.score - second.score >= 90
      || (
        first.matchedGroups.length > second.matchedGroups.length
        && first.commentOnly.length === 0
      )
  );
  return {
    status: unique ? 'unique' : inspected.length ? 'ambiguous' : 'empty',
    selectedFile: unique ? first.file : '',
    inspectedCount: candidates.length,
    candidates: inspected,
  };
}

module.exports = {
  inspectCandidates,
};
