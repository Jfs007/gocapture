import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useComposerStore } from '../../stores/composer.store';
import { useModelStore } from '../../stores/model.store';
import { useProjectStore } from '../../stores/project.store';
import { useSearchStore } from '../../stores/search.store';
import { useSelectionStore } from '../../stores/selection.store';
import { useConnectAgentStore } from '../../stores/connect-agent.store';
import { useSearchPrompt } from '../prompt/search-prompt';

export function useChatMessages() {
  const composerStore = useComposerStore();
  const modelStore = useModelStore();
  const projectStore = useProjectStore();
  const searchStore = useSearchStore();
  const selectionStore = useSelectionStore();
  const connectAgentStore = useConnectAgentStore();
  const prompt = useSearchPrompt();
  const { finalPrompt: promptText } = storeToRefs(composerStore);
  const {
    error: modelAssistError,
    logs: modelAssistLogs,
    result: modelAssistResult,
    startedAt: modelAssistStartedAt,
    finishedAt: modelAssistFinishedAt
  } = storeToRefs(modelStore);
  const {
    current: project,
    serviceStatus: sourceServiceStatus,
    serviceMessage: sourceServiceMessage
  } = storeToRefs(projectStore);
  const {
    candidates: candidateHits,
    candidateLoading,
    searchRunning,
    includeApiEvidence,
    needsMoreEvidence,
    startedAt: searchStartedAt,
    finishedAt: searchFinishedAt
  } = storeToRefs(searchStore);
  const {
    processLogs: searchProcessLogs,
    agentUsed: searchAgentUsed
  } = storeToRefs(searchStore);
  const {
    confirmed: selectionConfirmed,
    evidenceMessages,
    filesConfirmed
  } = storeToRefs(selectionStore);
  const selectedItems = computed(() => selectionStore.items.map(item => ({
    uid: item.uid,
    element: null,
    info: item.element || {},
    assetElement: null,
    assetInfo: item.asset || item.element || {},
    thumbnailUrl: item.thumbnailUrl || ''
  })));
  const modelAssistLoading = computed(() => modelStore.status === 'running');
  const { selectionChatSummary, searchLogLines } = prompt;
  const sourceServiceText = computed(() => {
    if (sourceServiceStatus.value === 'loading') return sourceServiceMessage.value || '正在连接本地源码服务...';
    if (sourceServiceStatus.value === 'connected') return '已连接本地源码服务，可读取真实源码路径';
    if (sourceServiceStatus.value === 'fallback') return '本地源码服务不可用，已退回浏览器目录选择';
    return '本地源码服务用于选择源码路径和扫描文件';
  });

  const chatMessages = computed(() => {
    const messages: any[] = [];
    const finish = () => chronologicalMessages(messages, {
      selectionCreatedAt: latestSelectionTimestamp(selectionStore.items),
      searchStartedAt: Number(searchStartedAt?.value || 0),
      searchFinishedAt: Number(searchFinishedAt?.value || 0),
      modelStartedAt: Number(modelAssistStartedAt?.value || 0),
      modelFinishedAt: Number(modelAssistFinishedAt?.value || 0)
    });
    if (!project.value) {
      messages.push({
        id: 'need-project',
        role: 'system',
        title: '请选择项目源码',
        text: '项目源码是必须信息。选择后才能把页面选区映射到候选文件。',
        action: 'choose-project'
      });
      if (sourceServiceText.value) {
        messages.push({
          id: 'source-status',
          role: 'system',
          text: sourceServiceText.value
        });
      }
      return finish();
    }

    const activeAgent = connectAgentStore.activeProvider;
    const currentTask = connectAgentStore.task;
    const projectThreadId = currentTask?.threadId || activeAgent?.projectThreadId || '';
    const agentBound = !!activeAgent?.connected && (
      !activeAgent.requiresThreadBinding || !!activeAgent.projectThreadId
    );
    const projectMessage: any = {
      id: 'project-ready',
      role: 'system',
      title: '项目已连接',
      text: [
        `${project.value.name} · ${project.value.fileCount} 个文件 · ${project.value.stackText || '未识别技术栈'}`,
        project.value.path ? `源码目录：${project.value.path}` : '',
        activeAgent
          ? agentBound
            ? `开发 Agent：${activeAgent.name}${activeAgent.version ? ` · ${activeAgent.version}` : ''}`
            : !activeAgent.connected
              ? `开发 Agent：${activeAgent.name} 需要重新连接`
              : `开发 Agent：${activeAgent.name} 已连接，尚未绑定任务`
          : connectAgentStore.loading
            ? '开发 Agent：正在检查'
            : '开发 Agent：未关联',
        agentBound
          ? `项目 Thread：${projectThreadId || '首次任务时建立'}`
          : '',
        agentBound
          ? modelStore.selectedModel
            ? `Locator：${modelStore.selectedModel.name}`
            : 'Locator：由开发 Agent 处理'
          : ''
      ].filter(Boolean).join('\n'),
      action: agentBound ? 'agent-settings' : 'connect-agent'
    };
    messages.push(projectMessage);
    messages.push(...connectAgentTimelineMessages({
      records: connectAgentStore.timeline,
      currentTask,
      taskStatus: connectAgentStore.taskStatus,
      currentLogs: connectAgentStore.taskLogs,
      taskStartedAt: connectAgentStore.taskStartedAt,
      taskFinishedAt: connectAgentStore.taskFinishedAt,
      pendingInteraction: connectAgentStore.pendingInteraction,
      agentName: activeAgent?.name || '开发 Agent'
    }));

    if (connectAgentStore.loading && !connectAgentStore.activeProvider) {
      return finish();
    }

    if (!connectAgentStore.activeProvider?.connected
      || (connectAgentStore.activeProvider.requiresThreadBinding
        && !connectAgentStore.activeProvider.projectThreadId)) {
      return finish();
    }

    if (!selectedItems.value.length) {
      messages.push({
        id: 'need-selection',
        role: 'system',
        title: '等待页面选区',
        text: '移动鼠标高亮页面区域，按空格键添加选区。选区会保存下来，可在输入框里用 @选区1 引用并描述修改要求。'
      });
      return finish();
    }

    messages.push({
      id: 'selection-context',
      role: 'system',
      title: '已捕获选区',
      text: [
        selectionChatSummary(),
        ...selectionStore.items
          .map((item, index) => {
            const meaning = item.sourceBinding?.agentContext?.meaning;
            return meaning ? `@选区${index + 1}：${meaning}` : '';
          })
          .filter(Boolean)
      ].filter(Boolean).join('\n')
    });

    if (selectionConfirmed.value) {
      messages.push({
        id: 'selection-confirmed',
        role: 'user',
        text: '选区已确认'
      });
    }

    for (const [index, text] of evidenceMessages.value.entries()) {
      messages.push({
        id: `custom-evidence-${index}`,
        role: 'user',
        text
      });
    }

    if (searchRunning?.value) {
      messages.push({
        id: 'searching',
        role: searchAgentUsed.value ? 'agent' : 'system',
        title: searchAgentUsed.value ? 'DOM 源码定位 Agent' : '源码检索',
        text: searchAgentUsed.value
          ? '正在让模型生成检索计划，并由本地执行候选检索和源码事实对照。'
          : includeApiEvidence.value ? '正在基于选区和接口端点追踪候选文件。' : '正在基于选区文案、className 和页面路径检索候选文件。',
        logs: searchProcessLogs.value || [],
        durationStartedAt: searchStartedAt?.value || 0,
        durationFinishedAt: searchFinishedAt?.value || 0,
        durationActive: true,
        logExpanded: true
      });
    } else if ((searchFinishedAt?.value || 0) > 0) {
      messages.push({
        id: 'search-log',
        role: searchAgentUsed.value ? 'agent' : 'system',
        title: searchAgentUsed.value ? 'DOM 源码定位 Agent' : '源码检索',
        text: candidateHits.value.length ? `找到 ${candidateHits.value.length} 个候选文件。` : '未命中候选文件。',
        logs: [
          ...(searchProcessLogs.value || []),
          ...searchLogLines()
        ],
        durationStartedAt: searchStartedAt?.value || 0,
        durationFinishedAt: searchFinishedAt?.value || 0,
        durationActive: false,
        logExpanded: false
      });
    }

    if (modelAssistLoading?.value) {
      messages.push({
        id: 'model-locating',
        role: 'agent',
        title: '模型定位',
        text: '正在让模型阅读本地预检索结果和候选文件内容，进一步判断应修改的源码文件。',
        logs: modelAssistLogs?.value || [],
        durationStartedAt: modelAssistStartedAt?.value || 0,
        durationFinishedAt: modelAssistFinishedAt?.value || 0,
        durationActive: true,
        logExpanded: true
      });
    } else if (modelAssistResult?.value) {
      const result: any = modelAssistResult.value;
      const targets = (result.modelItems || result.targetFiles || []);
      const targetLogs = targets
        .slice(0, 5)
        .flatMap((item: any, index: number) => {
          const locateLevel = item.locateLevel || item.modelLocateLevel || 'exact';
          const fileOnly = !!(item.fileOnly || item.modelFileOnly || locateLevel === 'file');
          const selectionFallback = !!(item.selectionFallback || item.modelSelectionFallback || item.snippetSource === 'selection-fallback' || item.modelSnippetSource === 'selection-fallback');
          const snippetVerified = item.snippetVerified !== false && item.modelSnippetVerified !== false;
          return [
            `模型返回 ${index + 1}: ${item.path || item.file}${item.confidence ? ` · ${item.confidence}%` : ''}${item.exists === false ? ' · 文件不存在' : ''}`,
            fileOnly
              ? '定位结果: 文件命中'
              : selectionFallback
                ? '定位层级: direction；源码不足，使用选区兜底'
                : `定位层级: ${locateLevel}${item.downgradedToDirection || item.modelDowngradedToDirection ? '；片段未逐字验证，已降级为源码方向' : ''}`,
            item.codeSnippet ? `${selectionFallback ? '选区兜底' : snippetVerified ? 'code片段' : '源码方向片段'}: ${item.codeSnippet}` : '',
            item.directionGuess ? `推测方向: ${item.directionGuess}` : '',
            item.prompt ? `提示词: ${item.prompt}` : (item.reason || '-')
          ].filter(Boolean);
        });
      messages.push({
        id: 'model-result',
        role: 'agent',
        title: `模型定位 · ${result.adapter?.name || '模型'}`,
        text: result.stopped
          ? '模型定位已手动停止。'
          : targets.length
            ? '模型已定位到修改点，可继续生成最终提示词。'
            : '模型未定位到可用修改点。',
        logs: [
          ...(result.logs || []),
          ...targetLogs,
          !targetLogs.length && result.rawText ? `模型原始返回:\n${result.rawText}` : ''
        ].filter(Boolean),
        durationStartedAt: modelAssistStartedAt?.value || 0,
        durationFinishedAt: modelAssistFinishedAt?.value || 0,
        durationActive: false,
        logExpanded: true
      });
    } else if (modelAssistError?.value) {
      messages.push({
        id: 'model-error',
        role: 'agent',
        title: '模型定位失败',
        text: modelAssistError.value,
        logs: modelAssistLogs?.value || [],
        durationStartedAt: modelAssistStartedAt?.value || 0,
        durationFinishedAt: modelAssistFinishedAt?.value || 0,
        durationActive: false,
        logExpanded: true
      });
    }

    const locatorFeedbackVisible = connectAgentStore.taskStatus === 'idle';
    if (!candidateLoading.value && needsMoreEvidence.value && locatorFeedbackVisible) {
      messages.push({
        id: 'need-more-evidence',
        role: 'system',
        title: '线索不足，需要补充页面证据',
        text: [
          '当前选区检索到了多个候选文件，系统已基于当前选区自动向上扩区并继续检索。',
          '如果自动扩区后仍然失败，说明当前 DOM 链路还不能把候选收敛到唯一源码方向。'
        ].join('\n')
      });
    } else if (
      !candidateLoading.value
      && candidateHits.value.length > 1
      && !filesConfirmed.value
      && locatorFeedbackVisible
    ) {
      messages.push({
        id: 'multi-candidates',
        role: 'system',
        title: '存在多个命中文件，请确认',
        text: `默认选择最高命中：${candidateHits.value[0].file}`
      });
    } else if (
      !candidateLoading.value
      && candidateHits.value.length === 1
      && !filesConfirmed.value
      && locatorFeedbackVisible
    ) {
      messages.push({
        id: 'single-candidate',
        role: 'system',
        text: `本地检索命中 ${candidateHits.value[0].file}，等待模型定位确认。`
      });
    }

    if (filesConfirmed.value) {
      messages.push({
        id: 'files-confirmed',
        role: 'user',
        text: '确认文件'
      });
    }

    if (promptText.value) {
      messages.push({
        id: 'final-prompt',
        role: 'system',
        title: '最终提示词',
        pre: promptText.value,
        action: 'copy-prompt'
      });
    }

    return finish();
  });

  return {
    sourceServiceText,
    chatMessages
  };
}

function connectAgentTimelineMessages({
  records,
  currentTask,
  taskStatus,
  currentLogs,
  taskStartedAt,
  taskFinishedAt,
  pendingInteraction,
  agentName
}: {
  records: any[];
  currentTask: any;
  taskStatus: string;
  currentLogs: string[];
  taskStartedAt: number;
  taskFinishedAt: number;
  pendingInteraction: any;
  agentName: string;
}) {
  const groups = new Map<string, {
    taskId: string;
    request: any;
    events: any[];
    result: any;
    firstAt: string;
  }>();
  for (const record of (Array.isArray(records) ? records : [])) {
    const taskId = String(record?.taskId || record?.id || '');
    if (!taskId) continue;
    if (!groups.has(taskId)) {
      groups.set(taskId, {
        taskId,
        request: null,
        events: [],
        result: null,
        firstAt: String(record?.createdAt || '')
      });
    }
    const group = groups.get(taskId)!;
    if (record.kind === 'request') group.request = record;
    else if (record.kind === 'result' || record.kind === 'error') group.result = record;
    else if (record.text) group.events.push(record);
  }

  const messages: any[] = [];
  const entries = [...groups.values()]
    .sort((left, right) => left.firstAt.localeCompare(right.firstAt));
  for (const group of entries) {
    if (group.request) {
      const pageUrl = String(group.request?.metadata?.pageUrl || '');
      messages.push({
        id: `connect-agent-user-${group.request.id}`,
        role: 'user',
        text: [
          String(group.request.text || ''),
          pageUrl ? `页面：${pageUrl}` : ''
        ].filter(Boolean).join('\n'),
        createdAt: timestampOf(group.request.createdAt)
      });
    }

    const isCurrent = currentTask?.taskId === group.taskId;
    const running = isCurrent && (taskStatus === 'running' || taskStatus === 'waiting-input');
    const waitingInput = isCurrent && taskStatus === 'waiting-input';
    const result = group.result;
    const durationStartedAt = timestampOf(group.request?.createdAt)
      || timestampOf(group.firstAt)
      || (isCurrent ? Number(taskStartedAt || currentTask?.startedAt || 0) : 0);
    const durationFinishedAt = result
      ? timestampOf(result.createdAt) || Number(result?.metadata?.finishedAt || 0)
      : isCurrent && taskStatus !== 'running'
        ? Number(taskFinishedAt || currentTask?.finishedAt || 0)
        : 0;
    const changedFiles = Array.isArray(result?.metadata?.changedFiles)
      ? result.metadata.changedFiles
      : isCurrent && Array.isArray(currentTask?.changedFiles)
        ? currentTask.changedFiles
        : [];
    const selectionDiffs = Array.isArray(result?.metadata?.selectionDiffs)
      ? result.metadata.selectionDiffs
      : isCurrent && Array.isArray(currentTask?.selectionDiffs)
        ? currentTask.selectionDiffs
        : [];
    const logs = uniqueLines([
      ...group.events.map(event => String(event.text || '')),
      ...(isCurrent ? currentLogs || [] : []),
      isCurrent && currentTask?.threadId
        ? `threadId: ${currentTask.threadId}`
        : result?.threadId
          ? `threadId: ${result.threadId}`
          : '',
      isCurrent && currentTask?.turnId
        ? `turnId: ${currentTask.turnId}`
        : result?.turnId
          ? `turnId: ${result.turnId}`
          : '',
      ...changedFiles.map((file: string) => `修改文件: ${file}`)
    ]);

    messages.push({
      id: `connect-agent-agent-${group.taskId}`,
      role: 'agent',
      title: `${agentName} 开发任务`,
      text: waitingInput
        ? `${agentName} 需要你补充信息后继续。`
        : running
        ? `${agentName} 正在项目中执行修改和验证。`
        : result?.kind === 'error'
          ? `${agentName} 开发任务失败。`
          : result
            ? `${agentName} 已完成项目修改。`
            : `${agentName} 开发任务未完成。`,
      pre: waitingInput
        ? interactionPrompt(pendingInteraction)
        : result?.text || (!running && isCurrent ? currentTask?.finalResponse || '' : ''),
      diffs: selectionDiffs,
      logs,
      createdAt: running
        ? earliestTimestamp([
          ...group.events.map(event => event.createdAt),
          durationStartedAt
        ]) || durationStartedAt
        : timestampOf(result?.createdAt)
          || durationFinishedAt
          || durationStartedAt,
      durationStartedAt,
      durationFinishedAt,
      durationActive: running,
      logExpanded: running
    });
  }
  return messages;
}

function interactionPrompt(interaction: any) {
  if (!interaction) return '';
  if (interaction.kind === 'permission') {
    return [interaction.title, interaction.description].filter(Boolean).join('\n');
  }
  return (Array.isArray(interaction.questions) ? interaction.questions : [])
    .map((question: any) => {
      const options = (Array.isArray(question.options) ? question.options : [])
        .map((option: any) => option.label)
        .filter(Boolean);
      return [question.question, options.length ? `可选：${options.join(' / ')}` : '']
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function uniqueLines(lines: string[]) {
  return [...new Set(lines.map(line => String(line || '').trim()).filter(Boolean))];
}

function timestampOf(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestSelectionTimestamp(items: any[]) {
  return Math.max(0, ...(Array.isArray(items) ? items : []).map(item => {
    return Number(
      item?.createdAt
      || item?.capturedAt
      || item?.sourceBinding?.resolvedAt
      || 0
    );
  }));
}

function earliestTimestamp(values: unknown[]) {
  const timestamps = values
    .map(timestampOf)
    .filter(timestamp => timestamp > 0);
  return timestamps.length ? Math.min(...timestamps) : 0;
}

function chronologicalMessages(messages: any[], context: {
  selectionCreatedAt: number;
  searchStartedAt: number;
  searchFinishedAt: number;
  modelStartedAt: number;
  modelFinishedAt: number;
}) {
  const explicitTimes = messages
    .map(message => timestampOf(message.createdAt))
    .filter(timestamp => timestamp > 0);
  const firstActivityAt = earliestTimestamp([
    context.selectionCreatedAt,
    context.searchStartedAt,
    context.modelStartedAt,
    ...explicitTimes
  ]) || Date.now();
  const lastLocatorAt = Math.max(
    context.searchFinishedAt,
    context.searchStartedAt,
    context.modelFinishedAt,
    context.modelStartedAt,
    context.selectionCreatedAt,
    firstActivityAt
  );

  return messages
    .map((message, index) => ({
      ...message,
      createdAt: timestampOf(message.createdAt)
        || inferredMessageTimestamp(message.id, index, {
          ...context,
          firstActivityAt,
          lastLocatorAt
        }),
      __sequence: index
    }))
    .sort((left, right) => {
      return left.createdAt - right.createdAt || left.__sequence - right.__sequence;
    })
    .map(({ __sequence, ...message }) => message);
}

function inferredMessageTimestamp(
  id: string,
  index: number,
  context: {
    selectionCreatedAt: number;
    searchStartedAt: number;
    searchFinishedAt: number;
    modelStartedAt: number;
    modelFinishedAt: number;
    firstActivityAt: number;
    lastLocatorAt: number;
  }
) {
  if (id === 'project-ready' || id === 'need-project' || id === 'source-status') {
    return context.firstActivityAt - 2 + index;
  }
  if (id === 'need-selection') return context.firstActivityAt;
  if (id === 'selection-context') {
    return context.selectionCreatedAt || context.firstActivityAt;
  }
  if (id === 'selection-confirmed' || id.startsWith('custom-evidence-')) {
    return context.searchStartedAt > 0
      ? context.searchStartedAt - 1
      : (context.selectionCreatedAt || context.firstActivityAt) + 1;
  }
  if (id === 'searching' || id === 'search-log') {
    return context.searchStartedAt || context.searchFinishedAt || context.firstActivityAt;
  }
  if (id === 'model-locating' || id === 'model-result' || id === 'model-error') {
    return context.modelStartedAt || context.modelFinishedAt || context.lastLocatorAt;
  }
  if (
    id === 'need-more-evidence'
    || id === 'multi-candidates'
    || id === 'single-candidate'
  ) {
    return (context.searchFinishedAt || context.searchStartedAt || context.lastLocatorAt) + 1;
  }
  if (id === 'files-confirmed' || id === 'final-prompt') {
    return context.lastLocatorAt + 1;
  }
  return context.firstActivityAt + index;
}
