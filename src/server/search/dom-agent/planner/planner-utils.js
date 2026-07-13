const { uniq } = require('../../../utils');
const { buildLocatorUserInput } = require('../../locator-protocol');
const {
  MAX_INHERITED_KEYWORDS,
  selectionList,
  plannerDomInput,
  selectionContextMarkupValues,
  domScopedTextStructures,
  domDirectTextStructures,
  domClassTokenSet,
  domAttributePairs,
} = require('../anchor/dom-utils');

const MAX_PLAN_SEARCHES = 8;
const MAX_PLAN_KEYWORDS = 8;

function buildPlannerPrompt(project, body, routeTrace, domSelections) {
  return JSON.stringify(buildLocatorUserInput({
    project,
    body,
    routeTrace,
    domSelections,
  }), null, 2);
}

function normalizePlan(parsed) {
  const searches = (Array.isArray(parsed?.searches) ? parsed.searches : [])
    .slice(0, MAX_PLAN_SEARCHES)
    .map((search, index) => ({
      keywords: uniq((Array.isArray(search?.keywords) ? search.keywords : [])
        .map(value => String(value || '').trim())
        .filter(value => value.length >= 2)
        .slice(0, MAX_PLAN_KEYWORDS)),
      mode: search?.mode === 'any' ? 'any' : 'all',
      range: search?.range === 'same-structure' ? 'same-structure' : 'same-file',
      priority: Math.max(1, Number(search?.priority || index + 1)),
      reason: String(search?.reason || '').trim(),
    }))
    .filter(search => search.keywords.length);
  return {
    searches,
    needMoreDom: parsed?.needMoreDom === true,
  };
}

function plannerEvidenceCorpus(body, routeTrace) {
  return [
    body?.pagePath || '',
    routeTrace?.bestPageFile || '',
    ...(routeTrace?.hits || []).flatMap(hit => [hit.file, hit.routePath]),
    ...selectionList(body).flatMap(selection => {
      const sourceLocate = selection?.sourceLocate
        || selection?.sourceEvidence
        || selection?.element?.sourceLocate
        || null;
      return (sourceLocate?.componentChain || []).flatMap(component => [
        component?.name,
        component?.file,
      ]);
    }),
    ...plannerDomInput(body).flatMap(item => [
      item.tag,
      item.selector,
      item.className,
      item.text,
      item.markup,
    ]),
  ].filter(Boolean).join('\n').toLowerCase();
}

function keywordExistsInPlannerEvidence(keyword, corpus) {
  const value = String(keyword || '').trim();
  if (!value) return false;
  return corpus.includes(value.toLowerCase());
}

function filterPlanByVisibleEvidence(plan, body, routeTrace) {
  const corpus = [
    plannerEvidenceCorpus(body, routeTrace),
    ...selectionList(body).flatMap(selectionContextMarkupValues),
  ].filter(Boolean).join('\n').toLowerCase();
  const removed = [];
  const searches = (plan.searches || []).map(search => {
    const keywords = (search.keywords || []).filter(keyword => {
      const ok = keywordExistsInPlannerEvidence(keyword, corpus);
      if (!ok) removed.push(keyword);
      return ok;
    });
    return { ...search, keywords };
  }).filter(search => search.keywords.length);
  return {
    plan: {
      ...plan,
      searches,
    },
    removed: uniq(removed),
  };
}

function domPlanSearchLayer(search) {
  if (search?.layer === 'scope' || search?.scopeOnly) return 'scope';
  if (search?.layer === 'child' || search?.childAnchor) return 'child';
  return 'render';
}

function splitRenderSearchesByDomScopes(plan, body) {
  const scopedTexts = domScopedTextStructures(body);
  if (!scopedTexts.some(item => item.scope)) return { ...plan, splitCount: 0 };
  let splitCount = 0;
  const searches = [];
  for (const search of plan.searches || []) {
    const isStrictRender = domPlanSearchLayer(search) === 'render'
      && search.mode === 'all'
      && search.range === 'same-structure'
      && (search.keywords || []).length >= 3;
    if (!isStrictRender) {
      searches.push(search);
      continue;
    }
    const byScope = new Map();
    const unscoped = [];
    for (const keyword of search.keywords || []) {
      const matches = scopedTexts.filter(item => String(item.text || '').includes(keyword));
      const scoped = matches.find(item => item.scope) || null;
      if (!scoped) {
        unscoped.push(keyword);
        continue;
      }
      const old = byScope.get(scoped.scope) || {
        scope: scoped.scope,
        scopes: scoped.scopes || [],
        keywords: [],
      };
      old.keywords.push(keyword);
      byScope.set(scoped.scope, old);
    }
    const groups = Array.from(byScope.values()).filter(group => group.keywords.length);
    if (groups.length <= 1) {
      searches.push(search);
      continue;
    }
    splitCount += 1;
    groups.forEach((group, index) => {
      const keywords = uniq(index === 0 ? [...group.keywords, ...unscoped] : group.keywords);
      if (!keywords.length) return;
      const layer = index === 0 ? 'render' : 'child';
      searches.push({
        ...search,
        keywords,
        priority: Number(search.priority || 1) + index,
        layer,
        ...(layer === 'child' ? { childAnchor: true } : {}),
        reason: `${search.reason || '同一渲染块内共现的判别性锚点'}；按 DOM scoped 渲染块拆分(${group.scope})`,
        evidenceKinds: Object.fromEntries(keywords.map(keyword => [
          keyword,
          search.evidenceKinds?.[keyword] || 'text',
        ])),
        ...(search.keywordTypes
          ? {
              keywordTypes: Object.fromEntries(keywords
                .filter(keyword => search.keywordTypes[keyword])
                .map(keyword => [keyword, search.keywordTypes[keyword]])),
            }
          : {}),
        ...(search.domTextStructures
          ? {
              domTextStructures: Object.fromEntries(keywords
                .filter(keyword => search.domTextStructures[keyword])
                .map(keyword => [keyword, search.domTextStructures[keyword]])),
            }
          : {}),
      });
    });
  }
  return {
    ...plan,
    searches,
    splitCount,
  };
}

function domStyleTokenSet(body) {
  const tokens = new Set();
  for (const selection of selectionList(body)) {
    for (const markup of selectionContextMarkupValues(selection)) {
      const regex = /\bstyle\s*=\s*("([^"]*)"|'([^']*)')/gi;
      let match;
      while ((match = regex.exec(String(markup || '')))) {
        const declarations = String(match[2] ?? match[3] ?? '').split(';');
        for (const declaration of declarations) {
          const separator = declaration.indexOf(':');
          if (separator === -1) continue;
          const key = declaration.slice(0, separator).trim();
          const value = declaration.slice(separator + 1).trim();
          if (!key || !value || key.startsWith('--')) continue;
          tokens.add(key);
          tokens.add(value);
          tokens.add(`${key}: ${value}`);
          tokens.add(`${key}:${value}`);
        }
      }
    }
  }
  return tokens;
}

function serializedAttributeKeyword(keyword) {
  const match = String(keyword || '').trim().match(/^([:@\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))$/);
  if (!match) return null;
  const key = String(match[1] || '').replace(/^:/, '').trim();
  const value = String(match[2] ?? match[3] ?? match[4] ?? '').trim();
  return key && value ? { key, value } : null;
}

function annotatePlanKeywordTypes(plan, body) {
  const classTokens = domClassTokenSet(body);
  const attributePairs = domAttributePairs(body);
  const directTextStructures = domDirectTextStructures(body);
  const styleTokens = domStyleTokenSet(body);
  const searches = (plan.searches || []).map(search => {
    const expandedKeywords = [];
    const searchAttributePairs = [];
    for (const keyword of search.keywords || []) {
      const serialized = serializedAttributeKeyword(keyword);
      const pair = serialized && attributePairs.find(item => {
        return item.key === serialized.key && item.value === serialized.value;
      });
      if (pair) {
        expandedKeywords.push(pair.key, pair.value);
        searchAttributePairs.push(pair);
      } else {
        expandedKeywords.push(keyword);
      }
    }
    for (const pair of attributePairs) {
      if (expandedKeywords.includes(pair.key) && expandedKeywords.includes(pair.value)) {
        searchAttributePairs.push(pair);
      }
    }
    const keywords = uniq(expandedKeywords);
    const keywordTypes = {};
    const domTextStructures = {};
    const evidenceKinds = {};
    for (const keyword of keywords) {
      if (classTokens.has(String(keyword || '').trim())) {
        keywordTypes[keyword] = 'class-token';
        evidenceKinds[keyword] = 'class';
      }
      if (searchAttributePairs.some(pair => pair.key === keyword)) {
        keywordTypes[keyword] = 'attribute-name';
        evidenceKinds[keyword] = 'other';
      }
      if (searchAttributePairs.some(pair => pair.value === keyword)) {
        keywordTypes[keyword] = 'attribute-value';
        evidenceKinds[keyword] = 'other';
      }
      if (!keywordTypes[keyword] && styleTokens.has(keyword)) {
        keywordTypes[keyword] = 'style-token';
        evidenceKinds[keyword] = 'style';
      }
      if (!keywordTypes[keyword]) {
        const structures = directTextStructures.filter(item => item.text.includes(keyword));
        if (structures.length) {
          domTextStructures[keyword] = structures.slice(0, 8);
          evidenceKinds[keyword] = 'text';
        }
      }
      if (!evidenceKinds[keyword]) evidenceKinds[keyword] = 'other';
    }
    return {
      ...search,
      keywords,
      ...(Object.keys(keywordTypes).length ? { keywordTypes } : {}),
      evidenceKinds,
      ...(Object.keys(domTextStructures).length ? { domTextStructures } : {}),
      ...(searchAttributePairs.length
        ? {
            attributePairs: uniq(searchAttributePairs.map(item => JSON.stringify(item)))
              .map(item => JSON.parse(item)),
          }
        : {}),
    };
  });
  return { ...plan, searches };
}

function planEvidenceKinds(plan) {
  return (plan?.searches || []).flatMap((search, searchIndex) => {
    return (search.keywords || []).map(keyword => ({
      search: searchIndex + 1,
      keyword,
      kind: search?.evidenceKinds?.[keyword] || 'other',
      matcher: search?.keywordTypes?.[keyword] || 'literal',
    }));
  });
}

function inheritedSearchKeywords(agentState) {
  if (!agentState?.expansionRetry) return [];
  const previousSearches = Array.isArray(agentState?.previousPlan?.searches)
    ? agentState.previousPlan.searches
    : [];
  const groupKeywords = [];
  for (const search of previousSearches) {
    const keywords = Array.isArray(search?.keywords) ? search.keywords : [];
    if (!keywords.length) continue;
    groupKeywords.push(...keywords);
    if (groupKeywords.length >= MAX_INHERITED_KEYWORDS) break;
  }
  return uniq(groupKeywords
    .map(value => String(value || '').trim())
    .filter(value => value.length >= 2))
    .slice(0, MAX_INHERITED_KEYWORDS);
}

function expansionCombinedSearchPlan(plan, agentState) {
  const inherited = inheritedSearchKeywords(agentState);
  if (!agentState?.expansionRetry || !inherited.length || !(plan.searches || []).length) {
    return { plan: { searches: [], needMoreDom: false }, inherited: [] };
  }
  const searches = (plan.searches || []).map((search, index) => {
    const keywords = uniq([
      ...inherited,
      ...(Array.isArray(search.keywords) ? search.keywords : []),
    ]).slice(0, MAX_PLAN_KEYWORDS);
    if (keywords.length <= (search.keywords || []).length) return null;
    return {
      keywords,
      mode: 'all',
      range: 'same-file',
      priority: index + 1,
      reason: [
        search.reason || '',
        `扩区联合直搜：上一轮锚点 ${inherited.join('、')}`,
      ].filter(Boolean).join('；'),
    };
  }).filter(Boolean);
  return {
    plan: {
      searches,
      needMoreDom: false,
    },
    inherited,
  };
}

module.exports = {
  buildPlannerPrompt,
  normalizePlan,
  filterPlanByVisibleEvidence,
  splitRenderSearchesByDomScopes,
  annotatePlanKeywordTypes,
  planEvidenceKinds,
  inheritedSearchKeywords,
  expansionCombinedSearchPlan,
};
