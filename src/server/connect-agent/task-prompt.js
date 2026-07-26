'use strict';

const PRIMARY_SOURCE_ROLES = new Set(['main-render', 'render', 'co-render']);

function buildConnectAgentTaskPrompt({
  userInstruction,
  pageUrl,
  selectionBindings,
  locatorEvidence,
  projectSession,
}) {
  const projectThreadId = String(projectSession?.threadId || '');
  const storedSelections = projectSession?.selections || {};
  const bindings = Array.isArray(selectionBindings) ? selectionBindings : [];
  const selectionContexts = bindings.map(item => {
    const binding = item?.binding || item || {};
    const agentContext = binding.agentContext || null;
    const selectionId = String(item?.uid || binding.selectionId || '');
    const stored = storedSelections[selectionId] || null;
    const reusable = !!(
      projectThreadId
      && (
        (stored?.meaning && stored?.threadId === projectThreadId)
        || (agentContext?.meaning && agentContext?.threadId === projectThreadId)
      )
    );
    return {
      selectionId,
      reusable,
      meaning: reusable ? String(stored?.meaning || agentContext?.meaning || '') : '',
      location: reusable
        ? null
        : buildSourceHandoff(binding, stored),
    };
  }).filter(item => item.selectionId || item.location);
  const locatedIds = new Set(selectionContexts.map(item => item.selectionId).filter(Boolean));
  const evidenceContexts = (Array.isArray(locatorEvidence?.selections)
    ? locatorEvidence.selections
    : []).map(item => {
    const selectionId = String(item?.selectionId || '');
    const stored = storedSelections[selectionId] || null;
    const reusable = !!(
      selectionId
      && projectThreadId
      && stored?.meaning
      && stored?.threadId === projectThreadId
    );
    return {
      selectionId,
      reusable,
      meaning: reusable ? String(stored.meaning) : '',
      pageEvidence: reusable ? null : {
        index: item.index,
        selector: item.selector,
        tag: item.tag,
        className: item.className,
        text: truncate(item.text, 1200),
        markup: truncate(item.markup, 12000),
      },
    };
  }).filter(item => item.selectionId && !locatedIds.has(item.selectionId));
  selectionContexts.push(...evidenceContexts);

  const reusableSelections = selectionContexts
    .filter(item => item.reusable)
    .map(item => ({ selectionId: item.selectionId, meaning: item.meaning }));
  const newSelections = selectionContexts
    .filter(item => !item.reusable)
    .map(item => {
      if (item.location) {
        return { selectionId: item.selectionId, location: item.location };
      }
      return { selectionId: item.selectionId, pageEvidence: item.pageEvidence };
    });

  const hasSelectionContext = selectionContexts.length > 0;
  const sections = [
    '请直接完成以下开发任务。',
    '',
    '需求：',
    String(userInstruction || '').trim(),
    `运行地址：${String(pageUrl || '').trim() || '-'}`,
  ];

  if (hasSelectionContext) {
    if (reusableSelections.length) {
      sections.push(
        '',
        '当前项目 Thread 已理解的选区：',
        JSON.stringify(reusableSelections, null, 2),
      );
    }
    if (newSelections.length) {
      sections.push(
        '',
        '本次选区已定位的修改位置：',
        formatLocatedSelections(newSelections),
      );
    }
    sections.push(
      '',
      '从上述选区继续完成需求。只有实现当前需求确实缺少事实时才扩大调查范围。',
    );
  } else {
    const evidence = compactUnlocatedEvidence(locatorEvidence);
    sections.push(
      '',
      '运行时事实（尚未裁决源码归属）：',
      JSON.stringify(evidence, null, 2),
      '',
      '请使用你自身的源码能力定位并修改。上下文命中只是范围线索，不代表最终修改文件。',
    );
  }

  sections.push(
    '',
    '使用与改动范围匹配的最小验证；不要搜索互联网，除非需求明确要求。',
    '最终结果中，用一句稳定、与本轮改动无关的业务描述概括每个本次首次提供的选区。',
  );
  return sections.join('\n');
}

function buildSourceHandoff(binding, stored) {
  const targets = Array.isArray(binding.targets) && binding.targets.length
    ? binding.targets
    : Array.isArray(stored?.source?.targets)
      ? stored.source.targets
      : [];
  const normalizedTargets = targets
    .map(target => ({
      file: String(target?.file || ''),
      role: String(target?.role || 'related'),
      line: positiveNumber(target?.line),
      anchor: String(target?.anchor || ''),
      targetSnippet: String(target?.targetSnippet || ''),
    }))
    .filter(target => target.file);
  if (!normalizedTargets.length) return null;

  // Locator 已把最能承载选区业务对象的精确目标写进 targetSnippet。
  // 对数据驱动 UI，这可能是 definition/data-source，而通用渲染组件仍保留在关系证据中。
  const snippetTargetIndex = normalizedTargets.findIndex(target => target.targetSnippet);
  const primaryIndex = normalizedTargets.findIndex(target => PRIMARY_SOURCE_ROLES.has(target.role));
  const resolvedPrimaryIndex = snippetTargetIndex >= 0
    ? snippetTargetIndex
    : primaryIndex >= 0
      ? primaryIndex
      : 0;
  const primaryTarget = normalizedTargets[resolvedPrimaryIndex];
  return {
    file: primaryTarget.file,
    ...(primaryTarget.line ? { line: primaryTarget.line } : {}),
    ...(primaryTarget.anchor ? { anchor: primaryTarget.anchor } : {}),
    ...(primaryTarget.targetSnippet ? { targetSnippet: primaryTarget.targetSnippet } : {}),
  };
}

function formatLocatedSelections(selections) {
  return selections.map(item => {
    const location = item.location || {};
    const position = `${location.file || '-'}${location.line ? `:${location.line}` : ''}`;
    return [
      `@${item.selectionId || 'selection'} → ${position}`,
      location.anchor ? `目标锚点：${location.anchor}` : '',
      location.targetSnippet
        ? `目标源码：\n\`\`\`\n${location.targetSnippet}\n\`\`\``
        : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function positiveNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function connectAgentOutputSchema(selectionBindings, locatorEvidence) {
  const bindingIds = (Array.isArray(selectionBindings) ? selectionBindings : [])
    .map(item => String(item?.uid || item?.binding?.selectionId || item?.selectionId || ''))
    .filter(Boolean);
  const evidenceIds = (Array.isArray(locatorEvidence?.selections) ? locatorEvidence.selections : [])
    .map(item => String(item?.selectionId || ''))
    .filter(Boolean);
  const ids = [...new Set([...bindingIds, ...evidenceIds])];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'selectionMeanings'],
    properties: {
      summary: {
        type: 'string',
        description: '面向用户的简洁开发结果，包括改动和验证。',
      },
      selectionMeanings: {
        type: 'array',
        description: '选区稳定业务含义。不得描述本轮具体改动。',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['selectionId', 'meaning'],
          properties: {
            selectionId: ids.length
              ? { type: 'string', enum: ids }
              : { type: 'string' },
            meaning: {
              type: 'string',
              description: '例如“经营数据中的店铺统计表格”，不要写“刚新增了 ROI 列”。',
            },
          },
        },
      },
    },
  };
}

function buildConnectAgentInputLog({
  providerId,
  projectRoot,
  threadId,
  prompt,
  outputSchema,
}) {
  const context = {
    provider: String(providerId || ''),
    projectRoot: String(projectRoot || ''),
    thread: String(threadId || '') || 'new',
    promptChars: String(prompt || '').length,
  };
  return [
    'Agent 模型输入上下文：',
    JSON.stringify(context, null, 2),
    '',
    'Prompt:',
    String(prompt || ''),
    '',
    'Structured output schema:',
    JSON.stringify(outputSchema || {}, null, 2),
  ].join('\n');
}

function compactUnlocatedEvidence(locatorEvidence) {
  if (!locatorEvidence) return null;
  return {
    route: locatorEvidence.route || null,
    selections: (Array.isArray(locatorEvidence.selections) ? locatorEvidence.selections : []).map(item => ({
      selectionId: item.selectionId,
      index: item.index,
      selector: item.selector,
      tag: item.tag,
      className: item.className,
      text: truncate(item.text, 1200),
      markup: truncate(item.markup, 12000),
    })),
    captured: compactCapturedFacts(locatorEvidence.captured),
  };
}

function compactCapturedFacts(captured) {
  if (!captured) return null;
  return {
    componentHints: (Array.isArray(captured.componentHints) ? captured.componentHints : []).slice(0, 8),
    apiRequests: (Array.isArray(captured.apiRequests) ? captured.apiRequests : []).slice(0, 12),
    manualEvidence: truncate(captured.manualEvidence, 2000),
  };
}

function truncate(value, maxLength) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...[truncated ${text.length - maxLength} chars]`;
}

module.exports = {
  buildSourceHandoff,
  buildConnectAgentInputLog,
  buildConnectAgentTaskPrompt,
  connectAgentOutputSchema,
  compactUnlocatedEvidence,
};
