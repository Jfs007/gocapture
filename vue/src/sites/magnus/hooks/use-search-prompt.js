import { candidateLogLines, candidateStageLabel } from '../presenters/candidate-presenter';
import { compactText, extractSearchTerms } from '../core/element-context';

export function useSearchPrompt({
  selectedItems,
  selectedCandidatePaths,
  selectedCandidateHits,
  candidateHits,
  routeResolverTrace,
  apiTrace,
  evidenceMessages,
  customEvidence,
  promptIntent,
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
  function promptAssetToken(index) {
    return `@选区${index}`;
  }

  function selectionChatSummary() {
    const latest = selectedItems.value[selectedItems.value.length - 1];
    const latestText = latest?.info?.text || latest?.info?.className || '';
    return [
      `${selectedItems.value.length} 个选区已保存，可在输入框里用 @选区1 引用。`,
      latestText ? `最近选区：${compactText(latestText, 80)}` : ''
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
    return selectedCandidateHits.value.filter(hit => hit.preciseEvidence);
  }

  function reliableSnippetPromptLines() {
    return reliableSnippetHits().map(hit => {
      return [
        `文件: ${hit.file}`,
        `命中来源: ${hit.exactMatchLabel || hit.uniqueMatchLabel || '文案'}`,
        `命中文案: ${hit.exactMatchText || hit.uniqueMatchText || '-'}`,
        hit.exactMatchCount ? `文件内出现次数: ${hit.exactMatchCount}` : '',
        hit.contextScore ? `页面上下文分: ${hit.contextScore}` : '',
        `源码片段:\n${hit.preciseSnippet || hit.uniqueSnippet || hit.snippet || ''}`
      ].join('\n');
    }).join('\n\n');
  }

  function modelSuggestionPromptLines() {
    return selectedPromptHits()
      .filter(hit => hit.stage === 'model-agent' && (hit.modelPrompt || hit.modelCodeSnippet))
      .map(hit => {
        return [
          `文件: ${hit.file}`,
          hit.modelCodeSnippet ? `code片段: ${hit.modelCodeSnippet}` : '',
          hit.modelPrompt ? `提示词: ${sanitizeModelInstructionText(hit.modelPrompt)}` : ''
        ].filter(Boolean).join('\n');
      })
      .join('\n\n');
  }

  function modelFinalPromptLines() {
    return selectedPromptHits()
      .filter(hit => hit.stage === 'model-agent' && hit.modelPrompt)
      .map(hit => {
        return [
          `文件: ${hit.file}`,
          hit.modelCodeSnippet ? `位置: ${hit.modelCodeSnippet}` : '',
          `模型建议: ${sanitizeModelInstructionText(hit.modelPrompt)}`
        ].filter(Boolean).join('\n');
      })
      .join('\n\n');
  }

  function manualEvidencePrompt() {
    return evidenceMessages.value.length ? evidenceMessages.value.join('\n') : '';
  }

  function promptAssetItems() {
    return selectionPayloads().map(item => {
      const info = item.element || {};
      const text = denoiseTextByApi(info.text, 120);
      const fallback = compactText([info.tag || '-', info.className || ''].filter(Boolean).join('.').replace(/\.+/g, '.'), 40);
      return {
        token: promptAssetToken(item.index),
        index: item.index,
        tag: info.tag || '-',
        className: info.className || '',
        text,
        ancestors: ancestorPromptLine(info),
        summary: compactText(text || fallback || `选区${item.index}`, 40)
      };
    });
  }

  function buildPromptIntentDraft() {
    return promptAssetItems()
      .map(asset => asset.token)
      .filter(Boolean)
      .join(' ');
  }

  function normalizeInstructionText(value) {
    return String(value || '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  function sanitizeModelInstructionText(value) {
    let text = normalizeInstructionText(value);
    if (!text) return '';
    text = text.replace(/需要引入[^。\n；]*(?:http|axios|request|fetch)[^。\n；]*/ig, '沿用项目现有 API 调用方式完成接口请求');
    text = text.replace(/[（(]如[^）)]*(?:http|axios|request|fetch|@\/)[^）)]*[）)]/ig, '');
    text = text
      .split('\n')
      .map(line => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
      .join('\n')
      .trim();
    return text;
  }

  function selectedPromptHits() {
    return selectedCandidateHits.value.length
      ? selectedCandidateHits.value
      : candidateHits.value.slice(0, 1);
  }

  function selectedFilePromptLines() {
    const hits = selectedPromptHits();
    return hits.length ? hits.map(hit => `- ${hit.file}`).join('\n') : '-';
  }

  function normalizeSnippetText(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const lines = text.split('\n');
    const cropped = lines.slice(0, 14).join('\n');
    if (cropped.length > 420) return `${cropped.slice(0, 420)}...`;
    return lines.length > 14 ? `${cropped}\n...` : cropped;
  }

  function locationPromptLines() {
    return selectedPromptHits().map(hit => {
      const location = normalizeSnippetText(hit.modelCodeSnippet || hit.preciseSnippet || hit.uniqueSnippet || hit.snippet || '');
      const evidence = hit.exactMatchText || hit.uniqueMatchText || '';
      return [
        `文件: ${hit.file}`,
        location ? `位置:\n${location}` : '',
        evidence ? `命中参考: ${evidence}` : ''
      ].filter(Boolean).join('\n');
    }).join('\n\n');
  }

  function finalPromptTaskLines(command) {
    const hits = selectedPromptHits();
    return hits.map((hit, index) => {
      if (hit.stage === 'model-agent' && hit.modelPrompt) {
        return sanitizeModelInstructionText(hit.modelPrompt);
      }
      const location = normalizeSnippetText(hit.modelCodeSnippet || hit.preciseSnippet || hit.uniqueSnippet || hit.snippet || '');
      const source = normalizeSnippetText(hit.preciseSnippet || hit.uniqueSnippet || hit.snippet || hit.modelCodeSnippet || '');
      const requirement = sanitizeModelInstructionText(hit.modelPrompt) || command || '按当前页面上下文完成修改';
      return [
        hits.length > 1 ? `任务 ${index + 1}:` : '',
        `文件: ${hit.file}`,
        location ? `位置:\n${location}` : '',
        source ? `源码:\n${source}` : '',
        `需求: ${requirement}`
      ].filter(Boolean).join('\n');
    }).join('\n\n');
  }

  function referencedPromptAssets(text) {
    const assets = promptAssetItems();
    if (!assets.length) return [];
    const value = String(text || '');
    const matches = Array.from(value.matchAll(/@(?:\[)?选区(?:(\d+))?(?:\])?/g));
    if (!matches.length) return assets;
    if (matches.some(match => !match[1])) return assets;
    const indexes = new Set();
    matches.forEach(match => indexes.add(Number(match[1])));
    return assets.filter(asset => indexes.has(asset.index));
  }

  function selectionPromptInstructions(text) {
    const assets = promptAssetItems();
    const value = normalizeInstructionText(text);
    if (!assets.length || !value) return [];
    const matches = Array.from(value.matchAll(/@(?:\[)?选区(?:(\d+))?(?:\])?/g));
    if (!matches.length) {
      return assets.map(asset => ({
        index: asset.index,
        token: asset.token,
        instruction: value
      }));
    }
    const grouped = new Map();
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index];
      const start = (match.index || 0) + match[0].length;
      const end = index + 1 < matches.length ? (matches[index + 1].index || value.length) : value.length;
      const instruction = value.slice(start, end).replace(/^[\s，,；;:：-]+/, '').trim() || '按当前页面上下文处理';
      const indexes = match[1]
        ? [Number(match[1])]
        : assets.map(asset => asset.index);
      for (const assetIndex of indexes) {
        const existing = grouped.get(assetIndex) || [];
        existing.push(instruction);
        grouped.set(assetIndex, existing);
      }
    }
    return assets
      .filter(asset => grouped.has(asset.index))
      .map(asset => ({
        index: asset.index,
        token: asset.token,
        instruction: grouped.get(asset.index).join('；')
      }));
  }

  function assetReferencePromptLines(text) {
    const instructions = new Map(selectionPromptInstructions(text).map(item => [item.index, item.instruction]));
    return referencedPromptAssets(text).map(asset => {
      return [
        `- ${asset.token}`,
        `  节点: tag=${asset.tag || '-'}；className=${asset.className || '-'}`,
        instructions.get(asset.index) ? `  修改要求: ${instructions.get(asset.index)}` : '',
        asset.text ? `  选区文本(仅参考): ${asset.text}` : '',
        asset.ancestors ? `  父级线索: ${asset.ancestors}` : ''
      ].filter(Boolean).join('\n');
    }).join('\n');
  }

  function selectionTextReferenceLines(text) {
    return referencedPromptAssets(text)
      .map(asset => {
        const fallback = [asset.tag || '', asset.className || '']
          .filter(Boolean)
          .join('.')
          .replace(/\.+/g, '.')
          .replace(/\.$/, '') || '-';
        return `${asset.token}: ${compactText(asset.text || fallback, 60)}`;
      })
      .join('；');
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
    const instructions = new Map(selectionPromptInstructions(promptIntent.value).map(item => [item.index, item.instruction]));
    return selectionPayloads()
      .filter(item => instructions.has(item.index) || item.element?.text || item.element?.className)
      .map(item => {
        const info = item.element;
        const denoisedText = denoiseTextByApi(info.text);
        const ancestors = ancestorPromptLine(info);
        return [
          `选区 ${item.index}: ${instructions.get(item.index) || '按页面上下文修改'}`,
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
    const promptInstructions = selectionPromptInstructions(promptIntent.value);
    if (promptInstructions.length) {
      for (const item of promptInstructions) {
        terms.push(...extractSearchTerms(item.instruction));
      }
    } else {
      terms.push(...extractSearchTerms(String(promptIntent.value || '').replace(/@(?:\[)?选区(?:(\d+))?(?:\])?/g, ' ')));
    }
    for (const message of evidenceMessages.value) {
      terms.push(...extractSearchTerms(message));
    }
    terms.push(...extractSearchTerms(customEvidence.value));
    for (const item of selectedItems.value) {
      terms.push(...extractSearchTerms(denoiseTextByApi(item.info.text)));
      terms.push(...extractSearchTerms(item.info.className));
      terms.push(...subtreeSearchTerms(item.info.subtree));
      for (const ancestor of item.info.ancestors || []) {
        terms.push(...extractSearchTerms(denoiseTextByApi(ancestor.text)));
        terms.push(...extractSearchTerms(ancestor.className));
        terms.push(...subtreeSearchTerms(ancestor.subtree));
      }
    }
    return Array.from(new Set(terms)).slice(0, 28).join(' ');
  }

  function subtreeSearchTerms(subtree) {
    if (!subtree) return [];
    const terms = [];
    for (const className of subtree.classNames || []) terms.push(...extractSearchTerms(className));
    for (const text of subtree.texts || []) terms.push(...extractSearchTerms(denoiseTextByApi(text)));
    for (const attr of subtree.attrs || []) {
      terms.push(...extractSearchTerms(attr?.key));
      terms.push(...extractSearchTerms(attr?.value));
    }
    for (const item of subtree.styles || []) {
      const style = item?.style || {};
      for (const value of Object.values(style)) terms.push(...extractSearchTerms(value));
    }
    return terms;
  }

  function denoiseSubtree(subtree) {
    if (!subtree) return subtree;
    return {
      ...subtree,
      texts: (subtree.texts || []).map(text => denoiseTextByApi(text)),
    };
  }

  function searchPayload() {
    const selections = selectionPayloads().map(item => ({
      ...item,
      element: {
        ...item.element,
        text: denoiseTextByApi(item.element?.text),
        subtree: denoiseSubtree(item.element?.subtree),
        ancestors: (item.element?.ancestors || []).map(ancestor => ({
          ...ancestor,
          text: denoiseTextByApi(ancestor.text),
          subtree: denoiseSubtree(ancestor.subtree)
        }))
      },
      asset: item.asset
        ? {
          ...item.asset,
          text: denoiseTextByApi(item.asset?.text),
        }
        : null
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
      userPrompt: normalizeInstructionText(promptIntent.value),
      manualEvidence: evidenceMessages.value.join('\n'),
      selectionInstructions: selectionPromptInstructions(promptIntent.value),
      selectionTexts: selections.map(item => ({
        index: item.index,
        text: item.element?.text || '',
        className: item.element?.className || ''
      })),
      selections,
      apiRequests,
      includeApi: includeApiEvidence.value,
      mode: 'ui-first',
      apiPaths: apiRequests.map(item => item.pathname || item.url),
      apiKeys: apiRequests.flatMap(item => item.requestKeys || []),
      limit: 30
    };
  }

  function searchLogLines() {
    const routeLines = routeResolverLogLines();
    const lines = [
      `1. 收集页面证据: pagePath=${pageUrlPath.value}；选区数=${selectedItems.value.length}；className=${selectedItems.value.map(item => item.info.className).filter(Boolean).join(' ') || '-'}`,
      ...routeLines,
      `3. 组合检索词: ${combinedSelectionText() || '-'}`,
      `4. 用户指令: ${normalizeInstructionText(promptIntent.value) || '-'}`,
      '5. 源码检索: 再按文案/className/url path/用户指令搜索开发源码文件，跳过 node_modules/dist/build 等非源码目录',
      '6. 链路推断: 对页面线索或用户指令命中的文件继续沿 import 链路向下追踪，并对组件候选做引用反查'
    ];
    if (includeApiEvidence.value) {
      const endpoints = searchApiRequests.value
        .map(item => item.pathname || item.url)
        .filter(Boolean)
        .slice(0, 5);
      lines.push(`7. 接口线索: ${endpoints.length ? endpoints.join('；') : '未捕获到接口端点'}`);
      lines.push(...apiTraceLogLines());
    }
    for (const [index, hit] of candidateHits.value.slice(0, 8).entries()) {
      lines.push(...candidateLogLines(hit, index));
    }
    return lines;
  }

  function apiTraceLogLines() {
    const trace = apiTrace?.value;
    if (!trace || !Array.isArray(trace.endpoints) || !trace.endpoints.length) return [];
    const lines = [];
    for (const endpoint of trace.endpoints.slice(0, 4)) {
      const endpointLabel = [endpoint.method, endpoint.path].filter(Boolean).join(' ') || endpoint.path || endpoint.url || '-';
      const names = (endpoint.symbols || []).slice(0, 6).join(', ') || '-';
      lines.push(`8. 接口识别: ${endpointLabel}；接口名=${names}`);
      for (const file of endpoint.files || []) {
        lines.push(`   接口文件: ${file.file}${file.symbols?.length ? `；符号=${file.symbols.join(', ')}` : ''}`);
      }
      for (const chain of endpoint.chains || []) {
        lines.push(`   接口引用链: ${chain.chain.join(' -> ')}${chain.symbol ? `；引用=${chain.symbol}` : ''}`);
      }
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

  function generatePrompt(options = {}) {
    const command = normalizeInstructionText(options.userInstruction || buildPromptIntentDraft()) || modificationCommand();
    const tasks = finalPromptTaskLines(command);
    const selectionReference = selectionTextReferenceLines(command);
    promptText.value = [
      `当前 page: ${window.location.href}`,
      `页面路径: ${pageUrlPath.value}`,
      tasks || `需求: ${command}`,
      selectionReference ? `选区文本参考: ${selectionReference}` : ''
    ].filter(Boolean).join('\n\n');
    setToast('提示词已生成');
  }

  return {
    selectionChatSummary,
    selectionNodeLine,
    ancestorPromptLine,
    combinedSelectionText,
    searchPayload,
    searchLogLines,
    generatePrompt,
    promptAssetItems,
    buildPromptIntentDraft
  };
}
