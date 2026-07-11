const { uniq } = require('../../utils');
const { plannerDomInput } = require('./dom-utils');
const {
  filesRelatedByImport,
  validateOriginRelation,
  routeConfirmedOriginFiles,
  traceCandidateOwners,
  traceRouteCandidateRelations,
} = require('./candidate-ownership');

function hasPlannedGroupMatch(candidate) {
  return (candidate?.matchedGroups || []).some(group => {
    return group?.source === 'planned-group' && (group.keywords || []).length >= 2;
  });
}

// 是否算「主渲染候选」。渲染角色由 candidateSourceRole 在源头判定（见其中对 .vue / 路由配置的处理），
// 这里不再按扩展名去「提升」参考文件——否则像路由配置 workbench.ts 这类命中了菜单文案/路径、
// 但根本不渲染 DOM 的 .ts 文件会被错当成渲染源码返回。referenceOnly 一律不算主渲染，子组件候选也不算。
function isRenderCandidate(candidate) {
  return !!candidate && !candidate.referenceOnly && !candidate.childComponentCandidate;
}

// 判断本地是否已存在明显占优的渲染候选（可据此本地收敛、跳过 Judge）。
// 只有当榜首候选具备「真实 DOM 共现证据」——一个 ≥2 关键词的 planned-group，或 ≥2 个稀有锚点共现——
// 时才允许本地收敛；对靠 import/定义反查合成出来的单锚点候选，仍交给 Judge 做兜底校验。
function dominantRenderCandidate(inspection) {
  const primary = (inspection?.candidates || [])
    .filter(isRenderCandidate)
    .sort((a, b) => b.score - a.score);
  const first = primary[0];
  const second = primary[1];
  if (!first) return null;
  const strongEvidence = hasPlannedGroupMatch(first) || Number(first.rareAnchorCount || 0) >= 2;
  if (!strongEvidence) return null;
  const dominates = !second
    || first.score - second.score >= 120
    || (hasPlannedGroupMatch(first) && !hasPlannedGroupMatch(second));
  return dominates ? first : null;
}

function analyzeEvidenceSufficiency(plan, inspection, ownership = [], options = {}) {
  const candidates = inspection?.candidates || [];
  const plannedGroupCandidates = candidates.filter(hasPlannedGroupMatch);
  const importRelationCandidates = candidates.filter(candidate => candidate.importRelation);
  // 子组件候选不参与「主渲染候选」竞争；planned-group 命中的候选即便被标 referenceOnly 也算主渲染。
  const primaryCandidates = candidates.filter(isRenderCandidate);
  const ownershipCount = Array.isArray(ownership) ? ownership.length : 0;
  if (plan.needMoreDom && !candidates.length) {
    return {
      insufficient: true,
      reason: 'Planner 请求更多 DOM 且当前没有候选文件',
      candidateCount: candidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (!candidates.length) {
    return {
      insufficient: true,
      reason: '本地检索未命中候选文件，需要扩区补充稳定 DOM 证据',
      candidateCount: 0,
      plannedGroupCandidateCount: 0,
      ownershipCount,
    };
  }
  if (!primaryCandidates.length) {
    return {
      insufficient: true,
      reason: '当前只命中样式/定义参考文件，尚未找到生成 DOM 的渲染源码',
      candidateCount: candidates.length,
      primaryCandidateCount: 0,
      referenceCandidateCount: candidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (importRelationCandidates.length) {
    return {
      insufficient: false,
      reason: '扩区新锚点命中父文件，上一轮候选在父文件引用链内，交给 Judge 裁决父子源码方向',
      candidateCount: candidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      importRelationCandidateCount: importRelationCandidates.length,
      ownershipCount,
    };
  }
  if (plannedGroupCandidates.length === 1) {
    return {
      insufficient: false,
      reason: 'DOM 验证后只有一个渲染候选完整命中同组锚点，其余局部命中仅作为参考',
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (primaryCandidates.length === 1 && candidates.length > 1) {
    return {
      insufficient: false,
      reason: 'DOM 验证后只剩一个可渲染源码候选，参考文件不参与主候选计数',
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (primaryCandidates.length > 1 && dominantRenderCandidate(inspection)) {
    return {
      insufficient: false,
      reason: '存在稀有锚点共现明显占优的渲染候选，本地直接收敛',
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      dominant: true,
      ownershipCount,
    };
  }
  if (primaryCandidates.length > 1 && options.expansionRetry) {
    return {
      insufficient: false,
      reason: '自动扩区后仍有多个通过 DOM 验证的渲染候选，进入 Judge 裁决',
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  if (primaryCandidates.length > 1) {
    return {
      insufficient: true,
      reason: `DOM 验证后仍有 ${primaryCandidates.length} 个候选文件可生成该区域，需要扩区收敛`,
      candidateCount: candidates.length,
      primaryCandidateCount: primaryCandidates.length,
      referenceCandidateCount: candidates.length - primaryCandidates.length,
      plannedGroupCandidateCount: plannedGroupCandidates.length,
      ownershipCount,
    };
  }
  return {
    insufficient: false,
    reason: '',
    candidateCount: candidates.length,
    plannedGroupCandidateCount: plannedGroupCandidates.length,
    ownershipCount,
  };
}

function compactInspectionForModel(inspection) {
  return {
    status: inspection.status,
    inspectedCount: Number(inspection.inspectedCount || 0),
    retainedCount: (inspection.candidates || []).length,
    candidates: inspection.candidates.map(candidate => ({
      file: candidate.file,
      score: candidate.score,
      matchedGroups: candidate.matchedGroups,
      keywordFacts: candidate.keywordFacts,
      commentOnly: candidate.commentOnly,
      structureMismatches: candidate.structureMismatches || [],
      sourceRole: candidate.sourceRole || '',
      referenceOnly: !!candidate.referenceOnly,
      childComponentCandidate: !!candidate.childComponentCandidate,
      roleReasons: candidate.roleReasons || [],
      importRelation: candidate.importRelation || null,
      definitionLinks: candidate.definitionLinks || [],
      domCoverage: candidate.domCoverage || null,
      excerpt: candidate.excerpt,
    })),
  };
}

function buildJudgePrompt(body, inspection, ownership, routeTrace, routeRelations) {
  return [
    '你是源码候选裁决器。候选已经由本地检索并读取局部结构。',
    '比较 DOM 事实与候选源码事实，选择最可能直接生成或控制该选区的文件。',
    '不要重新生成宽泛关键词，不要选择只有注释命中的文件。',
    '必须区分 definition、assembly、render。DOM 内容定义文件不能冒充最终渲染文件。',
    '一个文件可能只命中结构 class，另一个文件只命中文案/路径；这代表 render 与 definition 分离，需要结合用户需求决定返回一个或多个方向，不能只按命中词数量裁决。',
    '页面路由不是最终结论，但候选若能从当前精确路由入口通过真实 import 链到达，这是区分重复组件的重要证据。',
    '多个候选 DOM 结构相似时，必须比较候选路由关系；不得仅凭目录名称猜测哪个文件属于当前页面。',
    '你的目标仍然是定位当前 DOM 对应的源码方向，不是提前设计修改方案；用户需求只能帮助理解焦点，不能驱动你搜索接口名、数据源变量、样式写法等实现细节。',
    '如果候选中存在唯一 source=planned-group 且包含 2 个以上关键词的命中，通常代表 DOM 多锚点已在同一局部结构命中；除非它明显只是注释或无关定义，否则优先返回该候选。',
    '你只能裁决输入中的候选文件，不得生成新检索词；证据不足时返回 ambiguous。',
    '严格返回 JSON：',
    '{"status":"unique|ambiguous","files":[{"file":"","role":"render|definition|assembly","confidence":0,"reason":""}]}',
    `用户需求: ${body.userPrompt || ''}`,
    `选区摘要: ${JSON.stringify(plannerDomInput(body).map(item => ({
      index: item.index,
      tag: item.tag,
      selector: item.selector,
      className: item.className,
      text: item.text,
    })), null, 2)}`,
    `候选事实:\n${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`,
    `候选引用者:\n${JSON.stringify(ownership, null, 2)}`,
    `页面路由证据:\n${JSON.stringify({
      pagePath: body.pagePath || '',
      matched: !!routeTrace?.matched,
      bestPageFile: routeTrace?.bestPageFile || '',
      hits: (routeTrace?.hits || []).slice(0, 4).map(hit => ({
        file: hit.file,
        routePath: hit.routePath,
        reasons: hit.reasons || [],
      })),
    }, null, 2)}`,
    `候选路由关系:\n${JSON.stringify(routeRelations || [], null, 2)}`,
  ].join('\n');
}

function candidateKeywordSet(candidate) {
  return new Set((candidate?.keywordFacts || [])
    .filter(item => item.codeCount > 0 && !item.structureMismatch)
    .map(item => item.keyword));
}

function hasComparableDomEvidence(candidate, selectedCandidate) {
  if (!candidate || !selectedCandidate || candidate.referenceOnly) return false;
  const candidateKeywords = candidateKeywordSet(candidate);
  const selectedKeywords = candidateKeywordSet(selectedCandidate);
  if (!selectedKeywords.size) return false;
  return Array.from(selectedKeywords).every(keyword => candidateKeywords.has(keyword))
    && (candidate.structureMismatches || []).length <= (selectedCandidate.structureMismatches || []).length;
}

function validateJudgeRouteDecision(judge, inspection, routeRelations) {
  if (judge?.status !== 'unique' || judge.files.length !== 1 || !routeRelations?.length) {
    return { judge, rejected: false, reason: '' };
  }
  const selectedFile = judge.files[0].file;
  const relatedFiles = new Set(routeRelations.map(relation => relation.candidateFile));
  if (relatedFiles.has(selectedFile)) return { judge, rejected: false, reason: '' };
  const candidateByFile = new Map((inspection?.candidates || []).map(candidate => [candidate.file, candidate]));
  const selectedCandidate = candidateByFile.get(selectedFile);
  const alternatives = (inspection?.candidates || []).filter(candidate => {
    return relatedFiles.has(candidate.file) && hasComparableDomEvidence(candidate, selectedCandidate);
  });
  if (!alternatives.length) return { judge, rejected: false, reason: '' };
  return {
    judge: {
      ...judge,
      status: 'ambiguous',
      files: uniq([
        selectedFile,
        ...alternatives.map(candidate => candidate.file),
      ]).map(file => {
        const old = judge.files.find(item => item.file === file);
        return old || {
          file,
          role: 'render',
          confidence: 0,
          reason: '该候选具备同等 DOM 命中，并由当前页面路由入口的真实 import 链到达',
        };
      }),
    },
    rejected: true,
    reason: `Judge 选择了路由关系外候选 ${selectedFile}，但当前路由可达候选具备同等 DOM 证据：${alternatives.map(item => item.file).join('、')}`,
  };
}

function normalizedRoutePath(value) {
  const text = String(value || '').trim().split('?')[0].split('#')[0] || '/';
  return text.length > 1 ? text.replace(/\/+$/, '') : text;
}

function hasExactRouteEvidence(body, routeTrace) {
  if (!routeTrace?.matched || !routeTrace.bestPageFile) return false;
  const pagePath = normalizedRoutePath(body?.pagePath);
  return (routeTrace.hits || []).some(hit => {
    if (hit.file !== routeTrace.bestPageFile) return false;
    if (normalizedRoutePath(hit.routePath) === pagePath) return true;
    return (hit.reasons || []).some(reason => String(reason).includes('路径精确匹配'));
  });
}

function resolveByRouteRelation(body, inspection, routeTrace, routeRelations) {
  if (!hasExactRouteEvidence(body, routeTrace)) return null;
  const exactRelations = (routeRelations || []).filter(relation => {
    return relation.routeFile === routeTrace.bestPageFile
      || relation.routeFile === routeTrace?.bestRoute?.sourceFile;
  });
  const candidateByFile = new Map((inspection?.candidates || []).map(candidate => [candidate.file, candidate]));
  const relatedCandidates = uniq(exactRelations.map(relation => relation.candidateFile))
    .map(file => candidateByFile.get(file))
    .filter(candidate => {
      if (!candidate || candidate.referenceOnly) return false;
      const evidenceCount = candidateKeywordSet(candidate).size;
      const classCoverage = candidate.domCoverage?.matchedClassCount;
      const textCoverage = candidate.domTextCoverage?.matchedTextCount || 0;
      const totalTextCoverage = candidate.domTextCoverage?.totalTextCount || 0;
      const hasEnoughStructure = classCoverage == null
        ? evidenceCount > 0
        : classCoverage >= 2 || evidenceCount >= 2 || textCoverage >= 2;
      const hasEnoughLocalTextContext = totalTextCoverage >= 3
        ? textCoverage >= 2
        : true;
      return hasEnoughStructure
        && hasEnoughLocalTextContext
        && !(candidate.structureMismatches || []).length;
    });
  if (relatedCandidates.length !== 1) return null;
  const candidate = relatedCandidates[0];
  const relation = exactRelations.find(item => item.candidateFile === candidate.file);
  return {
    status: 'unique',
    files: [{
      file: candidate.file,
      role: 'render',
      confidence: 100,
      reason: `候选同时命中 DOM 结构，并由当前精确路由入口通过真实 import 链到达：${relation.chain.join(' -> ')}`,
    }],
    source: 'local-route-relation',
  };
}

// 归一化置信度：模型有时返回 0~1 小数（如 0.95），有时返回 0~100。统一到 0~100。
function normalizeConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const scaled = num > 0 && num <= 1 ? num * 100 : num;
  return Math.max(0, Math.min(100, scaled));
}

// 组装结构化组合结果：一段 DOM 通常由 assembly(装配) + render(主渲染) + children(子组件) 协作渲染。
function buildComposite(inspection, ownership, selectedFile) {
  const candidates = inspection?.candidates || [];
  const renderFile = selectedFile
    || (dominantRenderCandidate(inspection) || {}).file
    || (candidates.find(isRenderCandidate) || {}).file
    || '';
  if (!renderFile) return null;
  const renderCandidate = candidates.find(item => item.file === renderFile) || null;
  const owners = (ownership || [])
    .filter(owner => owner.candidateFile === renderFile)
    .sort((a, b) => Number(a.depth || 0) - Number(b.depth || 0));
  const assembly = owners.length
    ? { file: owners[0].file, via: 'import', chain: owners[0].chain || [] }
    : null;
  const childHasRenderRelation = item => {
    const relatedOwners = (ownership || []).filter(owner => owner.candidateFile === item.file);
    if (!relatedOwners.length) return true;
    return relatedOwners.some(owner => {
      const chain = owner.chain || [];
      return chain.includes(renderFile) || (assembly?.file && chain.includes(assembly.file));
    });
  };
  const children = candidates
    .filter(item => item.childComponentCandidate && item.file !== renderFile && childHasRenderRelation(item))
    .map(item => ({
      file: item.file,
      anchor: (item.matchedGroups || []).flatMap(group => group.keywords || [])[0] || '',
    }));
  // 同级并列渲染：一段 DOM 由多个平级组件各渲染一部分时，除主 render 外，
  // 把「同样具备真实共现证据、且与主 render 不是父子关系、分数可比」的其它渲染候选也并列出来。
  const renderScore = renderCandidate ? renderCandidate.score : 0;
  const assemblyFile = assembly ? assembly.file : '';
  const childFiles = new Set(children.map(child => child.file));
  const coRenders = candidates
    .filter(item => isRenderCandidate(item)
      && item.file !== renderFile
      && item.file !== assemblyFile
      && !childFiles.has(item.file)
      && hasPlannedGroupMatch(item)
      && item.score >= renderScore * 0.5)
    .map(item => ({
      file: item.file,
      role: 'render',
      score: item.score,
      anchors: uniq((item.matchedGroups || []).flatMap(group => group.keywords || [])).slice(0, 8),
    }));
  return {
    render: {
      file: renderFile,
      role: 'render',
      score: renderScore,
      anchors: uniq((renderCandidate?.matchedGroups || []).flatMap(group => group.keywords || [])).slice(0, 8),
    },
    assembly,
    children,
    ...(coRenders.length ? { coRenders } : {}),
  };
}

module.exports = {
  hasPlannedGroupMatch,
  isRenderCandidate,
  dominantRenderCandidate,
  filesRelatedByImport,
  validateOriginRelation,
  routeConfirmedOriginFiles,
  analyzeEvidenceSufficiency,
  compactInspectionForModel,
  traceCandidateOwners,
  traceRouteCandidateRelations,
  buildJudgePrompt,
  candidateKeywordSet,
  validateJudgeRouteDecision,
  resolveByRouteRelation,
  normalizeConfidence,
  buildComposite,
};
