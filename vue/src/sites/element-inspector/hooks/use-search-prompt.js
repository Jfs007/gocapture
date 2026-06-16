import { candidateLogLines, candidateStageLabel } from '../candidate-presenter';
import { compactText, extractSearchTerms } from '../element-context';

export function useSearchPrompt({
  selectedItems,
  selectedCandidatePaths,
  selectedCandidateHits,
  candidateHits,
  routeResolverTrace,
  evidenceMessages,
  customEvidence,
  searchKeywords,
  includeApiEvidence,
  searchApiRequests,
  pageUrlPath,
  project,
  promptText,
  denoiseTextByApi,
  selectionPayloads,
  setToast
}) {
  function selectionChatSummary() {
    const changedCount = selectedItems.value.filter(item => hasChangeNote(item)).length;
    const latest = selectedItems.value[selectedItems.value.length - 1];
    const latestText = latest?.changeNote || latest?.info?.text || '';
    return [
      `${selectedItems.value.length} 个选区，${changedCount} 个已填写改动点。`,
      latestText ? `最近改动：${compactText(latestText, 80)}` : ''
    ].filter(Boolean).join('\n');
  }

  function pageLevelText() {
    const text = document.body?.innerText || document.body?.textContent || '';
    return denoiseTextByApi(text, 260);
  }

  function candidateFilePromptLines(options = {}) {
    const hits = options.includeAll
      ? candidateHits.value.slice(0, 8)
      : selectedCandidateHits.value.length
      ? selectedCandidateHits.value
      : candidateHits.value.slice(0, 6);
    const selected = new Set(selectedCandidatePaths.value);
    return hits.map(hit => {
      const reasons = (hit.reasons || []).slice(0, 3).join('；');
      const meta = [
        candidateStageLabel(hit),
        `score=${hit.score}`,
        hit.from ? `from=${hit.from}` : '',
        reasons ? `reason=${reasons}` : ''
      ].filter(Boolean).join(', ');
      return `- ${selected.has(hit.file) ? '[已选] ' : ''}${hit.file}${meta ? ` (${meta})` : ''}`;
    }).join('\n');
  }

  function reliableSnippetHits() {
    return selectedCandidateHits.value.filter(hit => hit.uniqueSnippet && hit.uniqueMatchCount === 1);
  }

  function reliableSnippetPromptLines() {
    return reliableSnippetHits().map(hit => {
      return [
        `文件: ${hit.file}`,
        `唯一命中来源: ${hit.uniqueMatchLabel || '文案'}`,
        `唯一命中文案: ${hit.uniqueMatchText || '-'}`,
        `源码片段:\n${hit.uniqueSnippet}`
      ].join('\n');
    }).join('\n\n');
  }

  function modelSuggestionPromptLines() {
    return selectedCandidateHits.value
      .filter(hit => hit.stage === 'model-agent' && (hit.modelPrompt || hit.modelCodeSnippet))
      .map(hit => {
        return [
          `文件: ${hit.file}`,
          hit.modelCodeSnippet ? `code片段: ${hit.modelCodeSnippet}` : '',
          hit.modelPrompt ? `提示词: ${hit.modelPrompt}` : ''
        ].filter(Boolean).join('\n');
      })
      .join('\n\n');
  }

  function modelFinalPromptLines() {
    return selectedCandidateHits.value
      .filter(hit => hit.stage === 'model-agent' && hit.modelPrompt)
      .map(hit => {
        return [
          `文件: ${hit.file}`,
          hit.modelCodeSnippet ? `位置: ${hit.modelCodeSnippet}` : '',
          `修改提示词: ${hit.modelPrompt}`
        ].filter(Boolean).join('\n');
      })
      .join('\n\n');
  }

  function manualEvidencePrompt() {
    return evidenceMessages.value.length ? evidenceMessages.value.join('\n') : '';
  }

  function selectionNodeLine(info) {
    return [
      `tag=${info.tag || '-'}`,
      `className=${info.className || '-'}`,
      `box=${info.box.width}x${info.box.height}@${info.box.x},${info.box.y}`
    ].join('；');
  }

  function ancestorPromptLine(info) {
    return (info.ancestors || [])
      .slice(0, 3)
      .map(ancestor => {
        const text = denoiseTextByApi(ancestor.text, 80);
        const parts = [
          ancestor.tag || '-',
          ancestor.className ? `className=${ancestor.className}` : '',
          text ? `文案=${text}` : ''
        ].filter(Boolean);
        return parts.join('；');
      })
      .filter(Boolean)
      .join(' > ');
  }

  function modificationCommand() {
    return selectionPayloads()
      .filter(item => item.changeNote || item.element?.text || item.element?.className)
      .map(item => {
        const info = item.element;
        const denoisedText = denoiseTextByApi(info.text);
        const ancestors = ancestorPromptLine(info);
        return [
          `选区 ${item.index}: ${item.changeNote || '按页面上下文修改'}`,
          `  当前节点: ${selectionNodeLine(info)}`,
          `  节点文案: ${denoisedText || '-'}`,
          ancestors ? `  父级线索: ${ancestors}` : ''
        ].filter(Boolean).join('\n');
      })
      .join('\n');
  }

  function combinedSelectionText() {
    if (searchKeywords.value.trim()) return searchKeywords.value.trim();
    const terms = [];
    for (const message of evidenceMessages.value) {
      terms.push(...extractSearchTerms(message));
    }
    terms.push(...extractSearchTerms(customEvidence.value));
    for (const item of selectedItems.value) {
      terms.push(...extractSearchTerms(item.changeNote));
      terms.push(...extractSearchTerms(denoiseTextByApi(item.info.text)));
      terms.push(...extractSearchTerms(item.info.className));
      for (const ancestor of item.info.ancestors || []) {
        terms.push(...extractSearchTerms(denoiseTextByApi(ancestor.text)));
        terms.push(...extractSearchTerms(ancestor.className));
      }
    }
    return Array.from(new Set(terms)).slice(0, 28).join(' ');
  }

  function searchPayload() {
    const selections = selectionPayloads().map(item => ({
      ...item,
      element: {
        ...item.element,
        text: denoiseTextByApi(item.element?.text),
        ancestors: (item.element?.ancestors || []).map(ancestor => ({
          ...ancestor,
          text: denoiseTextByApi(ancestor.text)
        }))
      }
    }));
    const apiRequests = searchApiRequests.value.map(item => ({
      url: item.url,
      pathname: item.pathname,
      method: item.method,
      requestKeys: item.requestKeys
    }));
    const query = combinedSelectionText();
    return {
      query,
      url: window.location.href,
      className: selectedItems.value.map(item => item.info.className).join(' '),
      text: query,
      manualEvidence: evidenceMessages.value.join('\n'),
      selections,
      apiRequests,
      includeApi: includeApiEvidence.value,
      mode: 'ui-first',
      apiPaths: apiRequests.map(item => item.pathname || item.url),
      apiKeys: apiRequests.flatMap(item => item.requestKeys || []),
      limit: 8
    };
  }

  function searchLogLines() {
    const routeLines = routeResolverLogLines();
    const lines = [
      `1. 收集页面证据: pagePath=${pageUrlPath.value}；选区数=${selectedItems.value.length}；className=${selectedItems.value.map(item => item.info.className).filter(Boolean).join(' ') || '-'}`,
      ...routeLines,
      `3. 组合检索词: ${combinedSelectionText() || '-'}`,
      `4. 用户补充证据: ${evidenceMessages.value.length ? evidenceMessages.value.join('；') : '-'}`,
      '5. 源码检索: 再按文案/className/url path/补充证据搜索开发源码文件，跳过 node_modules/dist/build 等非源码目录',
      '6. 链路推断: 对补充证据命中的文件继续沿 import 链路向下追踪，并对组件候选做引用反查'
    ];
    if (includeApiEvidence.value) {
      const endpoints = searchApiRequests.value
        .map(item => item.pathname || item.url)
        .filter(Boolean)
        .slice(0, 5);
      lines.push(`7. 接口线索: ${endpoints.length ? endpoints.join('；') : '未捕获到接口端点'}`);
    }
    for (const [index, hit] of candidateHits.value.slice(0, 8).entries()) {
      lines.push(...candidateLogLines(hit, index));
    }
    return lines;
  }

  function routeResolverLogLines() {
    const trace = routeResolverTrace?.value;
    if (!trace) {
      return [
        `2. 页面路由适配: 未执行或本地服务未返回结果；projectKind=${project.value?.kind || 'unknown'}；pagePath=${pageUrlPath.value}`
      ];
    }

    const adapters = trace.adapters && trace.adapters.length ? trace.adapters.join(', ') : '-';
    const status = trace.matched ? `命中 ${trace.hits.length} 个文件` : '未命中';
    const lines = [
      `2. 页面路由适配: ${status}；projectKind=${trace.projectKind || project.value?.kind || 'unknown'}；pagePath=${trace.pagePath || pageUrlPath.value}；adapters=${adapters}`
    ];

    if (trace.matched) {
      for (const [index, hit] of (trace.hits || []).slice(0, 5).entries()) {
        lines.push(`   路由命中 ${index + 1}: ${hit.file}；adapter=${hit.adapter || '-'}；routePath=${hit.routePath || '-'}；score=${hit.score}`);
        const reason = (hit.reasons || []).find(item => item && !item.startsWith('路由适配器'));
        if (reason) lines.push(`   路由依据 ${index + 1}: ${reason}`);
      }
    } else {
      lines.push('   路由结果: 当前页面 path 没有通过路由表或文件系统路由定位到页面文件，继续走文案/className/API 检索。');
    }

    if (trace.errors && trace.errors.length) {
      lines.push(`   路由适配异常: ${trace.errors.slice(0, 3).join('；')}`);
    }
    return lines;
  }

  function generatePrompt() {
    const files = candidateFilePromptLines();
    const command = modificationCommand();
    const reliableSnippets = reliableSnippetPromptLines();
    const modelSuggestions = modelSuggestionPromptLines();
    const modelFinalPrompt = modelFinalPromptLines();
    const manualEvidence = manualEvidencePrompt();
    if (modelFinalPrompt) {
      promptText.value = [
        `当前 page: ${window.location.href}`,
        `当前命中文件:\n${selectedCandidateHits.value.map(hit => `- ${hit.file}`).join('\n')}`,
        `修改命令:\n${modelFinalPrompt}`
      ].filter(Boolean).join('\n');
      setToast('模型已生成最终提示词');
      return;
    }
    if (candidateHits.value.length > 1) {
      const relatedFiles = candidateFilePromptLines({ includeAll: true });
      promptText.value = [
        `当前 page: ${window.location.href}`,
        `url path: ${pageUrlPath.value}`,
        `技术栈: ${project.value?.stackText || '未知'}`,
        `页面级线索: ${pageLevelText() || '-'}`,
        manualEvidence ? `用户补充证据:\n${manualEvidence}` : '',
        '以下文件可能与当前页面/组件相关，请结合 url path、页面文案、className、接口端点和文件命中原因，判断当前页面最准确的源码文件；若候选里只有组件文件，请继续向页面入口或调用方推断。',
        relatedFiles || files || '-',
        modelSuggestions ? `模型推断修改点:\n${modelSuggestions}` : '',
        reliableSnippets ? `唯一源码片段:\n${reliableSnippets}` : '',
        `修改命令:\n${command}`
      ].filter(Boolean).join('\n');
      setToast('提示词已生成');
      return;
    }
    promptText.value = [
      `当前 page: ${window.location.href}`,
      `当前命中文件:\n${files || '-'}`,
      manualEvidence ? `用户补充证据:\n${manualEvidence}` : '',
      modelSuggestions ? `模型推断修改点:\n${modelSuggestions}` : '',
      reliableSnippets ? `唯一源码片段:\n${reliableSnippets}` : '',
      `修改命令:\n${command}`
    ].filter(Boolean).join('\n');
    setToast('提示词已生成');
  }

  return {
    selectionChatSummary,
    selectionNodeLine,
    ancestorPromptLine,
    combinedSelectionText,
    searchPayload,
    searchLogLines,
    generatePrompt
  };
}

function hasChangeNote(item) {
  return !!(item && item.changeNote && item.changeNote.trim());
}
