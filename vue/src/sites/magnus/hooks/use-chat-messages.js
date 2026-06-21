import { computed } from 'vue';

export function useChatMessages({
  project,
  selectedItems,
  selectionConfirmed,
  evidenceMessages,
  candidateLoading,
  searchRunning,
  includeApiEvidence,
  candidateHits,
  needsMoreEvidence,
  filesConfirmed,
  promptText,
  sourceServiceStatus,
  sourceServiceMessage,
  modelAssistLoading,
  modelAssistError,
  modelAssistLogs,
  modelAssistResult,
  searchStartedAt,
  searchFinishedAt,
  modelAssistStartedAt,
  modelAssistFinishedAt,
  selectionChatSummary,
  searchLogLines
}) {
  const sourceServiceText = computed(() => {
    if (sourceServiceStatus.value === 'loading') return sourceServiceMessage.value || '正在连接本地源码服务...';
    if (sourceServiceStatus.value === 'connected') return '已连接本地源码服务，可读取真实源码路径';
    if (sourceServiceStatus.value === 'fallback') return '本地源码服务不可用，已退回浏览器目录选择';
    return '本地源码服务用于选择源码路径和扫描文件';
  });

  const chatMessages = computed(() => {
    const messages = [];
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
      return messages;
    }

    messages.push({
      id: 'project-ready',
      role: 'system',
      title: '项目已连接',
      text: [
        `${project.value.name} · ${project.value.fileCount} 个文件 · ${project.value.stackText || '未识别技术栈'}`,
        project.value.path ? `源码目录：${project.value.path}` : ''
      ].filter(Boolean).join('\n')
    });

    if (!selectedItems.value.length) {
      messages.push({
        id: 'need-selection',
        role: 'system',
        title: '等待页面选区',
        text: '移动鼠标高亮页面区域，按空格键添加选区。选区会保存下来，可在输入框里用 @选区1 引用并描述修改要求。'
      });
      return messages;
    }

    messages.push({
      id: 'selection-context',
      role: 'system',
      title: '已捕获选区',
      text: selectionChatSummary()
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
        role: 'system',
        text: includeApiEvidence.value ? '正在基于选区和接口端点追踪候选文件。' : '正在基于选区文案、className 和页面路径检索候选文件。',
        durationStartedAt: searchStartedAt?.value || 0,
        durationFinishedAt: searchFinishedAt?.value || 0,
        durationActive: true,
        logExpanded: true
      });
    } else if ((searchFinishedAt?.value || 0) > 0) {
      messages.push({
        id: 'search-log',
        role: 'system',
        title: '源码检索',
        text: candidateHits.value.length ? `找到 ${candidateHits.value.length} 个候选文件。` : '未命中候选文件。',
        logs: searchLogLines(),
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
      const result = modelAssistResult.value;
      const targets = (result.modelItems || result.targetFiles || []);
      const targetLogs = targets
        .slice(0, 5)
        .flatMap((item, index) => {
          return [
            `模型返回 ${index + 1}: ${item.path || item.file}${item.confidence ? ` · ${item.confidence}%` : ''}${item.exists === false ? ' · 文件不存在' : ''}`,
            item.codeSnippet ? `code片段: ${item.codeSnippet}` : '',
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

    if (!candidateLoading.value && needsMoreEvidence.value) {
      messages.push({
        id: 'need-more-evidence',
        role: 'system',
        title: '线索不足，需要补充页面证据',
        text: [
          '当前选区命中了多个候选文件，但没有任何文件同时命中文案和当前页面上下文。',
          '这通常说明页面里有复制粘贴的相似组件，或者当前选区过小，只命中了通用子组件里的重复字段。',
          '请继续选择更外层、更独特的页面区域，或在输入框补充业务位置/交互目标后重新检索。'
        ].join('\n')
      });
    } else if (!candidateLoading.value && candidateHits.value.length > 1 && !filesConfirmed.value) {
      messages.push({
        id: 'multi-candidates',
        role: 'system',
        title: '存在多个命中文件，请确认',
        text: `默认选择最高命中：${candidateHits.value[0].file}`
      });
    } else if (!candidateLoading.value && candidateHits.value.length === 1 && !filesConfirmed.value) {
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

    return messages;
  });

  return {
    sourceServiceText,
    chatMessages
  };
}
