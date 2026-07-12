const { runModelTask } = require('../model/model-adapters');
const { uniq } = require('../utils');
const { searchProjectWithMeta } = require('./index');
const { resolvePageRouteTrace } = require('../route-resolvers/registry');
const {
  buildLocatorSystemPrompt,
  normalizeLocatorDecision,
  validateLocatorDecision,
  locatorDecisionToSearchPlan,
  locatorTechnicalStackMarkdown,
} = require('./locator-protocol');

const {
  DEFAULT_DOM_AGENT_THRESHOLD,
  DF_SCOPE_LIMIT,
  parseJsonResult,
  compressDomMarkup,
  resolveChainToProjectFiles,
  buildStage0Composite,
  domAgentTrigger,
  plannerDomInput,
  domContextDebugSummary,
} = require('./dom-agent/dom-utils');
const {
  buildPlannerPrompt,
  normalizePlan,
  filterPlanByVisibleEvidence,
  splitRenderSearchesByDomScopes,
  annotatePlanKeywordTypes,
  planEvidenceKinds,
  inheritedSearchKeywords,
  expansionCombinedSearchPlan,
} = require('./dom-agent/planner-utils');

const {
  candidateSort,
  executeSearchPlan,
  expansionRelatedCandidateHits,
} = require('./dom-agent/search-executor');

const { localPreflightConvergence } = require('./dom-agent/local-preflight');
const { inspectCandidates } = require('./dom-agent/candidate-inspector');

const {
  unresolvedDefinitionCandidates,
  enrichDefinitionOwners,
  buildDefinitionResolverPrompt,
  normalizeDefinitionResolver,
  applyDefinitionResolverRelations,
} = require('./dom-agent/definition-resolver');

const {
  offsetToLineColumn,
  focusAnchorsFromState,
  computeFineLocation,
  computeSourceScope,
  regionByContainerAnchors,
  attachFineLocation,
} = require('./dom-agent/source-location');

const {
  isRenderCandidate,
  dominantRenderCandidate,
  reviewRenderHypotheses,
  validateOriginRelation,
  routeConfirmedOriginFiles,
  analyzeEvidenceSufficiency,
  compactInspectionForModel,
  traceCandidateOwners,
  buildJudgePrompt,
  validateJudgeRouteDecision,
  resolveByRouteRelation,
  normalizeConfidence,
  buildComposite,
} = require('./dom-agent/candidate-relations');

const {
  normalizeJudge,
  agentHits,
} = require('./dom-agent/result-builder');
const {
  buildSourceRelationGraph,
  relationGraphComposite,
  relationGraphHits,
  routeComponentRelations,
} = require('./dom-agent/source-relation-graph');

async function runAgentSearch(project, body, options = {}) {
  if (!project) throw new Error('No project selected.');
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  const signal = options.signal;
  const invokeModel = options.runModelTask || runModelTask;
  const trigger = domAgentTrigger(body, { ...options, project });
  onLog(`DOM Agent 触发判断：${trigger.enabled ? '启用' : '跳过'}；${trigger.reason || 'ComponentChain 可用且选区未超长'}`);
  const localPreflight = localPreflightConvergence(project, body, onLog);
  if (localPreflight) {
    onLog(`DOM Agent 前置本地收敛：命中文件 ${localPreflight.agent.directFiles.join('、')}；跳过 Planner/Judge`);
    return {
      ...localPreflight,
      agent: {
        ...localPreflight.agent,
        trigger,
      },
    };
  }

  if (!trigger.enabled) {
    onLog('本地调用：searchProjectWithMeta(body)');
    const result = searchProjectWithMeta(project, body);
    onLog(`本地输出：候选 ${result.hits.length} 个`);
    return { ...result, agent: { enabled: false, trigger } };
  }

  // Stage0：运行时组件链已解析到真实源码文件（__file）——这是最确定的信号，
  // 直接产出组合结果并返回，跳过 Planner / 检索 / Judge 全部 LLM 调用。
  const chainProjectFiles = resolveChainToProjectFiles(project, body);
  if (chainProjectFiles.length) {
    onLog(`DOM Agent Stage0：运行时组件链命中源码文件，确定性收敛，跳过 LLM：${chainProjectFiles.join(' -> ')}`);
    const composite = buildStage0Composite(chainProjectFiles);
    const hits = chainProjectFiles.map((file, index) => ({
      file,
      score: 4000 - index * 100,
      stage: 'dom-agent-stage0',
      preciseEvidence: index === 0,
      sourceRole: index === 0 ? 'render' : 'assembly',
      modelConfidence: index === 0 ? 100 : 0,
      reasons: ['DOM Agent Stage0：运行时组件链 __file 直接命中源码，无需模型参与'],
    }));
    return {
      hits,
      composite,
      routeResolver: null,
      apiTrace: null,
      i18nTrace: null,
      definitionTrace: null,
      agent: {
        enabled: true,
        trigger,
        stage0: true,
        componentFiles: chainProjectFiles,
      },
    };
  }

  if (!body.adapter) throw new Error('DOM Agent 需要已配置的定位模型。');

  const textCache = new Map();
  onLog('本地调用：resolvePageRouteTrace(project, body)');
  const routeResult = resolvePageRouteTrace(project, body, textCache);
  onLog(`本地输出：${JSON.stringify({
    matched: !!routeResult.trace?.matched,
    bestPageFile: routeResult.trace?.bestPageFile || '',
    hits: (routeResult.hits || []).slice(0, 4).map(hit => hit.file),
  }, null, 2)}`);
  const domSelections = plannerDomInput(body);
  onLog('本地调用：compressDomMarkup(selection DOM)');
  onLog(`本地输出：${JSON.stringify({
    selections: domSelections.map(item => ({
      index: item.index,
      tag: item.tag,
      rawMarkupLength: item.rawMarkupLength,
      compressedMarkupLength: item.compressedMarkupLength,
      repeatedGroupCount: item.compression.repeatedGroupCount,
    })),
  }, null, 2)}`);
  const plannerPrompt = buildPlannerPrompt(project, body, routeResult.trace, domSelections);
  const plannerSystemPrompt = buildLocatorSystemPrompt(locatorTechnicalStackMarkdown(project));
  onLog(`DOM Agent System Prompt（${plannerSystemPrompt.length} 字符）:\n${plannerSystemPrompt}`);
  onLog(`DOM Agent Planner 输入（${plannerPrompt.length} 字符）:\n${plannerPrompt}`);
  const plannerResult = await invokeModel(body.adapter, plannerPrompt, project.path, {
    signal,
    onLog,
    systemPrompt: plannerSystemPrompt,
    temperature: 0.2,
  });
  onLog(`DOM Agent Planner 输出（${plannerResult.rawText.length} 字符）:\n${plannerResult.rawText || '-'}`);
  const plannerParsed = parseJsonResult(plannerResult.rawText);
  const locatorDecision = normalizeLocatorDecision(plannerParsed || {});
  const locatorValidation = validateLocatorDecision(locatorDecision);
  if (locatorDecision.status) {
    onLog(`DOM Agent LocatorDecision 校验：${locatorValidation.valid ? '通过' : `失败：${locatorValidation.errors.join('；')}`}`);
  }
  let plan = locatorValidation.valid
    ? locatorDecisionToSearchPlan(locatorDecision)
    : { searches: [], needMoreDom: false };
  if (!plan.searches.length && !plan.needMoreDom) {
    plan = normalizePlan(plannerParsed);
  }
  const filteredPlan = filterPlanByVisibleEvidence(plan, body, routeResult.trace);
  if (filteredPlan.removed.length) {
    onLog(`DOM Agent Planner 计划过滤：丢弃未在 DOM/路由证据中出现的词 ${filteredPlan.removed.join('、')}`);
  }
  plan = annotatePlanKeywordTypes(filteredPlan.plan, body);
  const plannedKeywords = uniq((plan.searches || []).flatMap(search => search.keywords || []));
  onLog(`DOM Agent 本地 DOM 上下文来源：${JSON.stringify(domContextDebugSummary(body, plannedKeywords), null, 2)}`);
  const scopedSplitPlan = splitRenderSearchesByDomScopes(plan, body);
  if (scopedSplitPlan.splitCount) {
    onLog(`DOM Agent scoped 渲染块拆分：${scopedSplitPlan.splitCount} 个 render 组被拆分为父组件/子组件检索组`);
    plan = scopedSplitPlan;
  }
  onLog(`DOM Agent 检索词定性：${JSON.stringify(planEvidenceKinds(plan), null, 2)}`);
  const executionPlan = plan;
  const inheritedKeywords = inheritedSearchKeywords(body?.agentState || null);
  if (inheritedKeywords.length) {
    onLog(`DOM Agent 扩区保留上一轮检索锚点用于引用链验证：${inheritedKeywords.join('、')}`);
  }
  const combinedPlan = expansionCombinedSearchPlan(executionPlan, body?.agentState || null);
  if (!executionPlan.searches.length) {
    if (executionPlan.needMoreDom || plan.needMoreDom) {
      const evidence = {
        insufficient: true,
        reason: 'Planner 判断当前选区无法形成稳定检索计划',
        candidateCount: 0,
      };
      onLog(`DOM Agent 证据不足：${evidence.reason}`);
      return {
        hits: [],
        routeResolver: routeResult.trace,
        apiTrace: null,
        i18nTrace: null,
        definitionTrace: null,
        needMoreDom: true,
        needsMoreEvidence: true,
        agent: {
          enabled: true,
          trigger,
          plan: executionPlan,
          modelPlan: plan,
          evidence,
          needMoreDom: true,
        },
      };
    }
    throw new Error('DOM Agent Planner 未返回可执行检索计划。');
  }

  let combinedCandidates = [];
  if (combinedPlan.plan.searches.length) {
    onLog(`本地调用：executeSearchPlan(project, ${JSON.stringify(combinedPlan.plan)})`);
    combinedCandidates = executeSearchPlan(project, combinedPlan.plan, textCache).map(candidate => ({
      ...candidate,
      score: candidate.score + 180,
    }));
    onLog(`本地输出：${JSON.stringify({
      candidateCount: combinedCandidates.length,
      files: combinedCandidates.map(candidate => ({
        file: candidate.file,
        score: candidate.score,
        matchedGroups: candidate.matchedGroups.map(group => group.keywords),
      })),
    }, null, 2)}`);
  }

  onLog(`本地调用：executeSearchPlan(project, ${JSON.stringify(executionPlan)})`);
  const currentCandidates = executeSearchPlan(project, executionPlan, textCache);
  const related = expansionRelatedCandidateHits(project, currentCandidates, body?.agentState || null, textCache);
  if (related.relations.length) {
    onLog(`DOM Agent 扩区引用链命中：${JSON.stringify(related.relations, null, 2)}`);
  }
  const candidateMap = new Map();
  for (const candidate of [...combinedCandidates, ...currentCandidates, ...related.candidates]) {
    const old = candidateMap.get(candidate.file);
    if (!old || Number(candidate.score || 0) > Number(old.score || 0)) {
      candidateMap.set(candidate.file, candidate);
    }
  }
  const candidates = Array.from(candidateMap.values()).sort(candidateSort);
  onLog(`本地输出：${JSON.stringify({
    candidateCount: candidates.length,
    files: candidates.map(candidate => ({
      file: candidate.file,
      score: candidate.score,
      matchedGroups: candidate.matchedGroups.map(group => group.keywords),
    })),
  }, null, 2)}`);

  onLog(`本地调用：inspectCandidates(project, ${JSON.stringify(candidates.map(item => item.file))})`);
  const inspectionPlan = {
    searches: [
      ...combinedPlan.plan.searches,
      ...executionPlan.searches,
    ],
  };
  let inspection = inspectCandidates(project, candidates, inspectionPlan, textCache, body);
  onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);
  onLog(`DOM Agent 渲染假设审查：${JSON.stringify(reviewRenderHypotheses(inspection), null, 2)}`);

  const sourceRelationGraph = buildSourceRelationGraph(project, inspection, textCache);
  onLog(`本地调用：buildSourceRelationGraph(project, inspection)`);
  onLog(`本地输出：${JSON.stringify(sourceRelationGraph, null, 2)}`);
  if (sourceRelationGraph.status === 'unique-complete') {
    const hits = relationGraphHits(sourceRelationGraph, inspection);
    const composite = relationGraphComposite(sourceRelationGraph);
    onLog(`DOM Agent 本地关系图收敛：${sourceRelationGraph.bundles[0].owner} 将定义值传入直接渲染组件，跳过单文件最高分裁决`);
    return attachFineLocation({
      hits,
      composite,
      routeResolver: routeResult.trace,
      apiTrace: null,
      i18nTrace: null,
      definitionTrace: null,
      agent: {
        enabled: true,
        trigger,
        plan: executionPlan,
        modelPlan: plan,
        inspection: compactInspectionForModel(inspection),
        sourceRelationGraph,
        localConverged: true,
      },
    }, project, executionPlan, body?.agentState || null, textCache, body);
  }

  let routeRelations = routeComponentRelations(
    project,
    routeResult.trace,
    inspection.candidates,
    textCache
  );
  onLog(`本地调用：routeComponentRelations(project, route, ${JSON.stringify(inspection.candidates.filter(item => !item.referenceOnly).map(item => item.file))})`);
  onLog(`本地输出：${JSON.stringify(routeRelations, null, 2)}`);
  const localRouteDecision = resolveByRouteRelation(
    body,
    inspection,
    routeResult.trace,
    routeRelations
  );
  if (localRouteDecision) {
    const evidence = {
      insufficient: false,
      reason: '当前精确路由、真实 import 链与 DOM 结构共同形成唯一候选',
      candidateCount: inspection.candidates.length,
      routeRelationCount: routeRelations.length,
    };
    const hits = agentHits(inspection, localRouteDecision, []);
    const composite = buildComposite(inspection, [], localRouteDecision.files[0].file);
    onLog(`DOM Agent 本地关系裁决：${localRouteDecision.files[0].reason}`);
    onLog(`DOM Agent 最终输出：${JSON.stringify({
      status: localRouteDecision.status,
      files: hits.map(hit => ({
        file: hit.file,
        score: hit.score,
        role: hit.sourceRole || '',
      })),
    }, null, 2)}`);
    return attachFineLocation({
      hits,
      composite,
      routeResolver: routeResult.trace,
      apiTrace: null,
      i18nTrace: null,
      definitionTrace: null,
      agent: {
        enabled: true,
        trigger,
        plan,
        inspection: compactInspectionForModel(inspection),
        definitionResolution: null,
        evidence,
        routeRelations,
        judge: localRouteDecision,
      },
    }, project, executionPlan, body?.agentState || null, textCache, body);
  }

  const initialOwnershipFiles = uniq([
    ...inspection.candidates.filter(item => !item.referenceOnly).map(item => item.file),
    ...unresolvedDefinitionCandidates(inspection).map(item => item.file),
  ]);
  let ownership = traceCandidateOwners(
    project,
    initialOwnershipFiles,
    textCache
  );
  onLog(`本地调用：traceCandidateOwners(project, ${JSON.stringify(initialOwnershipFiles)})`);
  onLog(`本地输出：${JSON.stringify(ownership, null, 2)}`);

  const unresolvedBeforeOwners = unresolvedDefinitionCandidates(inspection);
  if (unresolvedBeforeOwners.length) {
    inspection = enrichDefinitionOwners(project, inspection, ownership, textCache);
    onLog(`本地调用：enrichDefinitionOwners(project, ${JSON.stringify(unresolvedBeforeOwners.map(item => item.file))})`);
    onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);
  }

  let definitionResolution = null;
  const unresolvedDefinitions = unresolvedDefinitionCandidates(inspection);
  if (unresolvedDefinitions.length) {
    const resolverPrompt = buildDefinitionResolverPrompt(body, inspection, ownership);
    onLog(`DOM Agent 定义关系分析输入（${resolverPrompt.length} 字符）:\n${resolverPrompt}`);
    try {
      const resolverResult = await invokeModel(body.adapter, resolverPrompt, project.path, {
        signal,
        onLog,
        systemPrompt: '你是 Magnus 定义来源关系分析器。只根据提供的真实源码片段返回 JSON。',
      });
      onLog(`DOM Agent 定义关系分析输出（${resolverResult.rawText.length} 字符）:\n${resolverResult.rawText || '-'}`);
      definitionResolution = normalizeDefinitionResolver(
        parseJsonResult(resolverResult.rawText) || {},
        inspection,
        ownership
      );
      if (definitionResolution.removed.length) {
        onLog(`DOM Agent 定义关系检索词过滤：丢弃未在输入源码片段中出现的词 ${definitionResolution.removed.join('、')}`);
      }
      if (definitionResolution.relations.length) {
        inspection = applyDefinitionResolverRelations(
          project,
          inspection,
          definitionResolution.relations,
          ownership,
          textCache
        );
        onLog(`本地调用：applyDefinitionResolverRelations(${JSON.stringify(definitionResolution.relations)})`);
        onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);
      } else if (definitionResolution.searches.length) {
        const definitionPlan = {
          searches: definitionResolution.searches,
          needMoreDom: false,
        };
        onLog(`本地调用：executeSearchPlan(project, ${JSON.stringify(definitionPlan)})`);
        const definitionCandidates = executeSearchPlan(project, definitionPlan, textCache);
        onLog(`本地输出：${JSON.stringify({
          candidateCount: definitionCandidates.length,
          files: definitionCandidates.map(item => item.file),
        }, null, 2)}`);
        const mergedDefinitionCandidates = Array.from(new Map(
          [...candidates, ...definitionCandidates].map(item => [item.file, item])
        ).values());
        inspection = inspectCandidates(project, mergedDefinitionCandidates, {
          searches: [...inspectionPlan.searches, ...definitionPlan.searches],
        }, textCache, body);
        const definitionOwnershipFiles = uniq([
          ...inspection.candidates.filter(item => !item.referenceOnly).map(item => item.file),
          ...unresolvedDefinitionCandidates(inspection).map(item => item.file),
        ]);
        ownership = traceCandidateOwners(project, definitionOwnershipFiles, textCache);
        inspection = enrichDefinitionOwners(project, inspection, ownership, textCache);
        onLog(`本地调用：inspectCandidates(project, ${JSON.stringify(mergedDefinitionCandidates.map(item => item.file))})`);
        onLog(`本地输出：${JSON.stringify(compactInspectionForModel(inspection), null, 2)}`);
      }
    } catch (error) {
      definitionResolution = {
        status: 'unresolved',
        relations: [],
        searches: [],
        removed: [],
        error: error?.message || String(error),
      };
      onLog(`DOM Agent 定义关系分析失败：${definitionResolution.error}`);
    }
  }

  // 原始选区关系校验：扩区是为了找文件，但最终文件必须与「用户最初选中的那块」有渲染/引用关系。
  // 剔除那些只命中了扩区大区域、却与原始选区锚点毫无关系的渲染候选。
  const originAnchors = focusAnchorsFromState(body?.agentState || null);
  let originVerification = {
    status: originAnchors.length ? 'pending' : 'not-required',
    anchors: originAnchors,
  };
  if (originAnchors.length) {
    const renderCandidates = inspection.candidates.filter(isRenderCandidate);
    const validRenderFiles = new Set(
      renderCandidates
        .filter(candidate => validateOriginRelation(project, candidate.file, originAnchors, textCache).valid)
        .map(candidate => candidate.file)
    );
    if (renderCandidates.length && !validRenderFiles.size) {
      const exactPageFile = routeResult.trace?.bestPageFile || '';
      const routeConfirmedFiles = new Set(routeConfirmedOriginFiles(
        renderCandidates,
        routeResult.trace,
        routeRelations
      ));
      if (exactPageFile && routeConfirmedFiles.size) {
        inspection = {
          ...inspection,
          candidates: inspection.candidates.filter(candidate =>
            !isRenderCandidate(candidate) || routeConfirmedFiles.has(candidate.file)),
        };
        originVerification = {
          status: 'unlocated',
          anchors: originAnchors,
          reason: '原始选区锚点未出现在源码中，但扩区候选已由当前精确路由入口的真实 import 链确认；保留文件定位，源码节点待后链路对齐',
          routeConfirmedFiles: [...routeConfirmedFiles],
        };
        onLog(`DOM Agent 原始选区关系校验：最初选区锚点(${originAnchors.join('、')})无法在源码回验；保留由当前精确路由链确认的候选 ${[...routeConfirmedFiles].join('、')}，精确位置标记为 unlocated`);
      } else {
        onLog(`DOM Agent 原始选区关系校验：全部渲染候选都与最初选区锚点(${originAnchors.join('、')})无渲染/引用关系，且没有当前精确路由链佐证，判定为「扩区命中了别处、并非你选的那块」`);
        return {
          hits: [],
          composite: null,
          routeResolver: routeResult.trace,
          apiTrace: null,
          i18nTrace: null,
          definitionTrace: null,
          needMoreDom: true,
          needsMoreEvidence: true,
          agent: {
            enabled: true,
            trigger,
            plan: executionPlan,
            modelPlan: plan,
            inspection: compactInspectionForModel(inspection),
            definitionResolution,
            originMismatch: true,
            originVerification: {
              status: 'mismatch',
              anchors: originAnchors,
            },
            originAnchors,
            evidence: {
              insufficient: true,
              reason: '扩区命中的文件与原始选区无渲染/引用关系，真正渲染该区域的组件可能在被压缩省略的部分，请直接选中该区域本身重试',
            },
            needMoreDom: true,
          },
        };
      }
    }
    if (validRenderFiles.size && validRenderFiles.size < renderCandidates.length) {
      // 只保留与原始选区相关的渲染候选；参考/子组件/定义候选保留以维持引用链。
      inspection = {
        ...inspection,
        candidates: inspection.candidates.filter(candidate =>
          !isRenderCandidate(candidate) || validRenderFiles.has(candidate.file)),
      };
      originVerification = {
        status: 'verified',
        anchors: originAnchors,
        files: [...validRenderFiles],
      };
      onLog(`DOM Agent 原始选区关系校验：保留与最初选区相关的渲染候选 ${[...validRenderFiles].join('、')}`);
    } else if (validRenderFiles.size) {
      originVerification = {
        status: 'verified',
        anchors: originAnchors,
        files: [...validRenderFiles],
      };
    }
  }

  const finalRenderReview = reviewRenderHypotheses(inspection);
  const evidence = analyzeEvidenceSufficiency(plan, inspection, ownership, {
    expansionRetry: body?.agentState?.expansionRetry === true,
  });
  onLog(`DOM Agent 收敛前复审：${JSON.stringify(finalRenderReview, null, 2)}`);
  onLog(`本地调用：analyzeEvidenceSufficiency(plan, inspection, ownership)`);
  onLog(`本地输出：${JSON.stringify(evidence, null, 2)}`);
  if (evidence.insufficient) {
    onLog(`DOM Agent 证据不足：${evidence.reason}`);
    return {
      hits: [],
      routeResolver: routeResult.trace,
      apiTrace: null,
      i18nTrace: null,
      definitionTrace: null,
      needMoreDom: true,
      needsMoreEvidence: true,
      agent: {
        enabled: true,
        trigger,
        plan,
        inspection: compactInspectionForModel(inspection),
        definitionResolution,
        evidence,
        originVerification,
        needMoreDom: true,
      },
    };
  }

  // 本地已存在明显占优的渲染候选（稀有锚点共现）——直接收敛，不再调用 Judge。
  // Judge 仅在下面「本地无法收敛的真歧义」时才触发。
  const localDominant = dominantRenderCandidate(inspection);
  if (localDominant && !options.forceJudge && !finalRenderReview.requiresModelReview) {
    const decision = {
      status: 'unique',
      files: [{
        file: localDominant.file,
        role: 'render',
        confidence: 95,
        reason: '判别性稀有锚点在同一渲染源码内共现，本地唯一收敛，无需模型裁决',
      }],
      source: 'local-dominant',
    };
    const hits = agentHits(inspection, decision, ownership);
    const composite = buildComposite(inspection, ownership, localDominant.file);
    onLog(`DOM Agent 本地收敛（跳过 Judge）：${localDominant.file}`);
    onLog(`DOM Agent 组合结果：${JSON.stringify(composite, null, 2)}`);
    return attachFineLocation({
      hits,
      composite,
      routeResolver: routeResult.trace,
      apiTrace: null,
      i18nTrace: null,
      definitionTrace: null,
      agent: {
        enabled: true,
        trigger,
        plan: executionPlan,
        modelPlan: plan,
        inspection: compactInspectionForModel(inspection),
        definitionResolution,
        evidence,
        originVerification,
        judge: decision,
        localConverged: true,
      },
    }, project, executionPlan, body?.agentState || null, textCache, body);
  }
  if (localDominant && finalRenderReview.requiresModelReview) {
    onLog(`DOM Agent 语义审查门：禁止本地直接收敛；${finalRenderReview.reviewReasons.join('；')}，进入 LLM Judge`);
  }

  routeRelations = routeComponentRelations(
    project,
    routeResult.trace,
    inspection.candidates,
    textCache
  );
  let judgePrompt = buildJudgePrompt(
    body,
    inspection,
    ownership,
    routeResult.trace,
    routeRelations,
    sourceRelationGraph
  );
  onLog(`DOM Agent Judge 输入（${judgePrompt.length} 字符）:\n${judgePrompt}`);
  let judgeResult = await invokeModel(body.adapter, judgePrompt, project.path, {
    signal,
    onLog,
    systemPrompt: '你是 Magnus 源码候选裁决器。只根据给定候选事实返回 JSON。',
  });
  onLog(`DOM Agent Judge 输出（${judgeResult.rawText.length} 字符）:\n${judgeResult.rawText || '-'}`);
  let judge = normalizeJudge(
    parseJsonResult(judgeResult.rawText),
    project,
    uniq([
      ...inspection.candidates.map(item => item.file),
      ...ownership.map(item => item.file),
    ])
  );
  let routeValidation = validateJudgeRouteDecision(judge, inspection, routeRelations);
  judge = routeValidation.judge;
  if (routeValidation.rejected) {
    onLog(`DOM Agent Judge 路由关系校验：拒绝唯一结论；${routeValidation.reason}`);
  }
  const hits = agentHits(inspection, judge, ownership);
  const composite = buildComposite(
    inspection,
    ownership,
    judge?.status === 'unique' && judge.files[0] ? judge.files[0].file : ''
  );
  onLog(`DOM Agent 最终输出：${JSON.stringify({
    status: judge?.status || inspection.status,
    files: hits.slice(0, 6).map(hit => ({
      file: hit.file,
      score: hit.score,
      role: hit.sourceRole || '',
    })),
  }, null, 2)}`);
  return attachFineLocation({
    hits,
    composite,
    routeResolver: routeResult.trace,
    apiTrace: null,
    i18nTrace: null,
    definitionTrace: null,
    agent: {
      enabled: true,
      trigger,
      plan: executionPlan,
      modelPlan: plan,
      inspection: compactInspectionForModel(inspection),
      definitionResolution,
      evidence,
      originVerification,
      routeRelations,
      sourceRelationGraph,
      judge,
    },
  }, project, executionPlan, body?.agentState || null, textCache, body);
}

module.exports = {
  DEFAULT_DOM_AGENT_THRESHOLD,
  DF_SCOPE_LIMIT,
  compressDomMarkup,
  analyzeEvidenceSufficiency,
  dominantRenderCandidate,
  buildComposite,
  computeFineLocation,
  computeSourceScope,
  regionByContainerAnchors,
  offsetToLineColumn,
  validateOriginRelation,
  routeConfirmedOriginFiles,
  normalizeConfidence,
  domAgentTrigger,
  executeSearchPlan,
  inspectCandidates,
  resolveByRouteRelation,
  runAgentSearch,
  traceCandidateOwners,
  routeComponentRelations,
  validateJudgeRouteDecision,
};
