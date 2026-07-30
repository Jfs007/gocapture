'use strict';

function buildConnectAgentTaskPrompt({
  userInstruction,
  pageUrl,
  selectionBindings,
  locatorEvidence,
  conversationMode,
}) {
  const selectionIds = knownSelectionIds(selectionBindings, locatorEvidence);
  if (conversationMode === 'chat' || !selectionIds.length) {
    return String(userInstruction || '').trim();
  }
  const selectionReferences = selectionReferenceMap(selectionBindings, locatorEvidence);
  const runtimeEvidence = runtimeSelectionEvidence(locatorEvidence);
  const stableInstruction = rewriteSelectionAliases(
    userInstruction,
    selectionIds,
    selectionReferences,
  );
  const sections = [
    '请直接完成以下开发任务。',
    '',
    '需求：',
    stableInstruction,
    `运行地址：${String(pageUrl || '').trim() || '-'}`,
  ];

  const hasStableSelectionReference = selectionIds
    .some(selectionId => stableInstruction.includes(`@${selectionId}`));
  if (selectionIds.length && !hasStableSelectionReference) {
    sections.push(
      '',
      `选区：${selectionIds.map(selectionId => `@${selectionId}`).join('、')}`,
    );
  }

  if (runtimeEvidence.length) {
    sections.push(
      '',
      '以下选区尚未定位。请把这些经过压缩的运行时 DOM 作为首轮定位证据：',
      JSON.stringify(runtimeEvidence, null, 2),
      '',
      'Evidence Gate：在调用任何源码读取、检索或项目扩展前，必须先对每个选区二选一：',
      '- 当前 DOM 足以开始针对性源码验证：调用 accept_selection_evidence。',
      '- 当前 DOM 缺少辨识所需的周围结构：立即调用 expand_selection_context，不要先做宽泛源码调查。',
      '扩区只补充上下文，修改目标始终是原始选区；收到扩区结果后重新执行 Evidence Gate。',
      '完成需求时，同时返回每个选区实际对应的源码文件和精确行区间。不要把 DOM、路由或推理过程写入选区文件。',
    );
  }

  sections.push(
    '',
    '使用与改动范围匹配的最小验证；不要搜索互联网，除非需求明确要求。',
  );
  return sections.join('\n');
}

function selectionReferenceMap(selectionBindings, locatorEvidence) {
  const entries = [
    ...(Array.isArray(selectionBindings) ? selectionBindings : []).map(item => ({
      token: String(item?.token || ''),
      index: Number(item?.index || 0),
      selectionId: String(item?.uid || item?.binding?.selectionId || item?.selectionId || ''),
    })),
    ...(Array.isArray(locatorEvidence?.selections) ? locatorEvidence.selections : []).map(item => ({
      token: String(item?.token || ''),
      index: Number(item?.index || 0),
      selectionId: String(item?.selectionId || ''),
    })),
  ];
  const references = new Map();
  for (const entry of entries) {
    if (!entry.selectionId) continue;
    if (entry.token) references.set(entry.token, entry.selectionId);
    if (entry.index > 0) references.set(`@选区${entry.index}`, entry.selectionId);
  }
  return references;
}

function rewriteSelectionAliases(userInstruction, selectionIds, references = new Map()) {
  const value = String(userInstruction || '').trim();
  if (!value || !selectionIds.length) return value;
  const aliases = Array.from(value.matchAll(/@(?:\[)?选区(?:(\d+))?(?:\])?/g));
  if (!aliases.length) return value;
  const fallbackIds = [...selectionIds];
  const assigned = new Map();
  let fallbackIndex = 0;
  return value.replace(/@(?:\[)?选区(?:(\d+))?(?:\])?/g, match => {
    const direct = references.get(match);
    if (direct) return `@${direct}`;
    if (selectionIds.length === 1) return `@${selectionIds[0]}`;
    if (!assigned.has(match)) {
      assigned.set(match, fallbackIds[fallbackIndex] || fallbackIds[fallbackIds.length - 1]);
      fallbackIndex += 1;
    }
    return `@${assigned.get(match)}`;
  });
}

function connectAgentInitialInstructions() {
  return [
    '选区引用协议：',
    '1. 用户消息中的 @selection_* 是项目内稳定的选区引用。',
    '2. `.gocapture/selections/<selectionId>.json` 只保存该选区对应的源码文件和精确位置。',
    '3. 只读取本轮实际引用的选区文件；同一 Thread 已理解后，不要重复读取，除非证据失效或用户切换选区。',
    '4. 首轮 Prompt 若附带运行时 DOM，需在完成需求的同时返回原选区对应的精确源码位置。',
  ].join('\n');
}

function knownSelectionIds(selectionBindings, locatorEvidence) {
  const bindingIds = (Array.isArray(selectionBindings) ? selectionBindings : [])
    .map(item => String(item?.uid || item?.binding?.selectionId || item?.selectionId || ''));
  const evidenceIds = (Array.isArray(locatorEvidence?.selections)
    ? locatorEvidence.selections
    : []).map(item => String(item?.selectionId || ''));
  return [...new Set([...bindingIds, ...evidenceIds].filter(Boolean))];
}

function locatedSelectionIds(selectionBindings) {
  return new Set((Array.isArray(selectionBindings) ? selectionBindings : [])
    .filter(item => {
      const binding = item?.binding || item || {};
      return (Array.isArray(binding.targets) ? binding.targets : [])
        .some(target => String(target?.file || '').trim() && (
          Number(target?.startLine || target?.line || 0) > 0
          || String(target?.anchor || target?.targetSnippet || target?.codeSnippet || '').trim()
        ));
    })
    .map(item => String(item?.uid || item?.binding?.selectionId || item?.selectionId || ''))
    .filter(Boolean));
}

function connectAgentOutputSchema(selectionBindings, locatorEvidence) {
  const locatedIds = locatedSelectionIds(selectionBindings);
  const ids = knownSelectionIds(selectionBindings, locatorEvidence)
    .filter(selectionId => !locatedIds.has(selectionId));
  if (!ids.length) return null;
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'selectionLocations'],
    properties: {
      summary: {
        type: 'string',
        description: '面向用户的简洁开发结果，包括改动和验证。',
      },
      selectionLocations: {
        type: 'array',
        description: '仅返回本轮尚未定位选区所对应的真实源码位置；已存在位置文件的选区可以省略。',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['selectionId', 'locations'],
          properties: {
            selectionId: ids.length
              ? { type: 'string', enum: ids }
              : { type: 'string' },
            locations: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['file', 'startLine', 'endLine', 'anchor'],
                properties: {
                  file: {
                    type: 'string',
                    description: '相对项目根目录的源码文件路径。',
                  },
                  startLine: { type: 'integer', minimum: 1 },
                  endLine: { type: 'integer', minimum: 1 },
                  anchor: {
                    type: 'string',
                    description: '该位置附近可稳定复查的源码锚点。',
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function runtimeSelectionEvidence(locatorEvidence) {
  return (Array.isArray(locatorEvidence?.selections) ? locatorEvidence.selections : [])
    .map(item => ({
      selectionId: String(item?.selectionId || '').trim(),
      tag: String(item?.tag || ''),
      selector: String(item?.selector || ''),
      text: String(item?.text || item?.directText || '').slice(0, 1200),
      markup: String(item?.markup || '').slice(0, 8000),
    }))
    .filter(item => item.selectionId);
}

function buildConnectAgentInputLog({
  providerId,
  projectRoot,
  threadId,
  initialInstructions,
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
    ...(String(initialInstructions || '').trim()
      ? ['', 'Thread 初始化指令:', String(initialInstructions).trim()]
      : []),
    '',
    'Prompt:',
    String(prompt || ''),
    ...(outputSchema
      ? ['', 'Structured output schema:', JSON.stringify(outputSchema, null, 2)]
      : []),
  ].join('\n');
}

module.exports = {
  buildConnectAgentInputLog,
  buildConnectAgentTaskPrompt,
  connectAgentInitialInstructions,
  connectAgentOutputSchema,
  knownSelectionIds,
  locatedSelectionIds,
  rewriteSelectionAliases,
  runtimeSelectionEvidence,
  selectionReferenceMap,
};
