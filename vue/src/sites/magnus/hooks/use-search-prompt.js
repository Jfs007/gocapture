import { candidateLogLines, candidateStageLabel } from '../presenters/candidate-presenter';
import { compactText, extractSearchTerms } from '../core/element-context';

export function useSearchPrompt({
  selectedItems,
  selectedCandidatePaths,
  selectedCandidateHits,
  candidateHits,
  routeResolverTrace,
  apiTrace,
  i18nTrace,
  definitionTrace,
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
  function isNoiseClassTerm(term) {
    return /^((n|el|ant|ivu|van|arco|semi|q|v)-|router-link-)/.test(term)
      || /(active|selected|disabled|checked|hover|focus)$/i.test(term);
  }

  function contextTextTerms(info) {
    return extractSearchTerms(denoiseTextByApi(info?.text || ''));
  }

  function contextClassTerms(info) {
    return extractSearchTerms(info?.className || '').filter(term => !isNoiseClassTerm(term));
  }

  function contextAttrTerms(info) {
    const attrs = info?.attrs || {};
    const terms = [];
    for (const [key, value] of Object.entries(attrs)) {
      if (String(value || '').trim() === '[present]') continue;
      terms.push(...extractSearchTerms(key));
      terms.push(...extractSearchTerms(value));
    }
    return Array.from(new Set(terms));
  }

  function contextStyleTerms(info) {
    const style = info?.computedStyle || {};
    const terms = [];
    for (const key of ['width', 'height', 'objectFit', 'fontSize', 'fontWeight', 'backgroundSize', 'backgroundPosition']) {
      terms.push(...extractSearchTerms(style[key] || ''));
    }
    return Array.from(new Set(terms));
  }

  function searchContextTerms(info) {
    return Array.from(new Set([
      ...contextTextTerms(info),
      ...contextClassTerms(info),
      ...contextAttrTerms(info),
      ...contextStyleTerms(info)
    ]));
  }

  function hasUsefulExpandedFallback(selfInfo, expandedInfo) {
    const selfText = String(denoiseTextByApi(selfInfo?.text || '') || '').replace(/\s+/g, ' ').trim();
    const expandedText = String(denoiseTextByApi(expandedInfo?.text || '') || '').replace(/\s+/g, ' ').trim();
    const selfTerms = new Set(searchContextTerms(selfInfo));
    const expandedTerms = searchContextTerms(expandedInfo);
    const addedTerms = expandedTerms.filter(term => !selfTerms.has(term));
    if (addedTerms.length >= 2) return true;
    if (contextTextTerms(expandedInfo).some(term => !selfTerms.has(term))
      && [
        ...contextClassTerms(expandedInfo),
        ...contextAttrTerms(expandedInfo),
        ...contextStyleTerms(expandedInfo)
      ].some(term => !selfTerms.has(term))) return true;
    if (selfText && expandedText && expandedText.length > selfText.length && expandedText.length <= 260) return true;
    if (!selfText && expandedText && expandedText.length <= 220) return true;
    return false;
  }

  function searchContextSpecificityScore(info) {
    const phrase = String(denoiseTextByApi(info?.text || '') || '').trim();
    const phraseScore = phrase.length >= 2 && phrase.length <= 32
      ? 14
      : phrase.length > 32
        ? 8
        : 0;
    return phraseScore
      + contextTextTerms(info).length * 6
      + contextClassTerms(info).length * 6
      + contextAttrTerms(info).length * 8
      + contextStyleTerms(info).length * 4;
  }

  function searchContextBreadthScore(info) {
    const subtree = info?.subtree || {};
    const nodeCount = Number(subtree.nodeCount || 0);
    const textCount = Array.isArray(subtree.texts) ? subtree.texts.length : 0;
    const attrCount = Array.isArray(subtree.attrs) ? subtree.attrs.length : 0;
    const styleCount = Array.isArray(subtree.styles) ? subtree.styles.length : 0;
    const textLength = String(denoiseTextByApi(info?.text || '') || '').length;
    const boxWidth = Number(info?.box?.width || 0);
    const boxHeight = Number(info?.box?.height || 0);
    const area = Math.max(0, boxWidth * boxHeight);
    return nodeCount * 2
      + textCount * 3
      + attrCount
      + styleCount
      + Math.min(30, Math.floor(textLength / 12))
      + Math.min(40, Math.floor(area / 50000));
  }

  function shouldKeepExpandedSearchContext(selfInfo, expandedInfo) {
    if (!selfInfo || !expandedInfo) return false;
    if (hasUsefulExpandedFallback(selfInfo, expandedInfo)) return true;
    const selfSpecificity = searchContextSpecificityScore(selfInfo);
    if (selfSpecificity < 18) return true;

    const selfTerms = new Set(searchContextTerms(selfInfo));
    const expandedTerms = searchContextTerms(expandedInfo);
    const novelTerms = expandedTerms.filter(term => !selfTerms.has(term));
    const breadthGap = searchContextBreadthScore(expandedInfo) - searchContextBreadthScore(selfInfo);

    if (novelTerms.length >= 4 && breadthGap <= 18) return true;
    return breadthGap <= 12;
  }

  function filteredAncestorsForSearch(info) {
    return (info?.ancestors || []).filter(ancestor => shouldKeepExpandedSearchContext(info, ancestor));
  }

  function filteredAssetForSearch(info, asset) {
    return shouldKeepExpandedSearchContext(info, asset) ? asset : null;
  }

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

  function selectionAttrSummary(info) {
    const attrs = Object.entries(info?.attrs || {})
      .filter(([key, value]) => {
        const text = String(value || '').trim();
        if (!text || text === '[present]' || text.length > 40) return false;
        return !/^(class|style|src|href)$/i.test(String(key || ''));
      })
      .slice(0, 3)
      .map(([key, value]) => `${key}=${value}`);
    return attrs.join('；');
  }

  function selectionReferenceSummary(info) {
    const text = compactText(info?.text || '', 40);
    const attrText = selectionAttrSummary(info);
    const nodeParts = [
      info?.tag ? `tag=${info.tag}` : '',
      info?.className ? `className=${compactText(info.className, 30)}` : '',
      attrText ? `attrs=${attrText}` : ''
    ].filter(Boolean);
    const nodeText = nodeParts.join('；');
    if (!text) return compactText(nodeText || '-', 80);
    if (text.length <= 8 || /^[A-Za-z0-9_\u4e00-\u9fa5-]+$/.test(text)) {
      return compactText([text, nodeText].filter(Boolean).join('；'), 80);
    }
    return compactText(text, 80);
  }

  function promptAssetItems() {
    return selectionPayloads().map(item => {
      const info = item.element || {};
      const text = compactText(info.text || '', 120);
      const fallback = compactText([info.tag || '-', info.className || ''].filter(Boolean).join('.').replace(/\.+/g, '.'), 40);
      return {
        token: promptAssetToken(item.index),
        index: item.index,
        tag: info.tag || '-',
        className: info.className || '',
        text,
        attrs: info.attrs || {},
        ancestors: ancestorPromptLine(info),
        summary: compactText(selectionReferenceSummary(info) || text || fallback || `选区${item.index}`, 40)
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
      const modelLocation = normalizeSnippetText(hit.modelCodeSnippet || '');
      const hasReliableUiSource = !!(hit.preciseSnippet || hit.uniqueSnippet)
        && !!(hit.preciseEvidence || hit.exactMatchText || hit.uniqueMatchText || (hit.contextScore || 0) > 0 || (hit.contextReasons || []).length);
      const uiSource = hasReliableUiSource
        ? normalizeSnippetText(hit.preciseSnippet || hit.uniqueSnippet || '')
        : '';
      const fallbackSource = normalizeSnippetText(hit.snippet || '');
      const location = modelLocation || uiSource || fallbackSource;
      const source = modelLocation || uiSource || fallbackSource;
      const requirement = command || '按当前页面上下文完成修改';
      const directionLevel = hit.modelLocateLevel === 'direction';
      const directionGuess = sanitizeModelInstructionText(hit.modelDirectionGuess || '');
      const shouldShowUiSource = directionLevel && uiSource && uiSource !== location;
      return [
        hits.length > 1 ? `任务 ${index + 1}:` : '',
        `文件: ${hit.file}`,
        shouldShowUiSource ? `UI源码:\n${uiSource}` : '',
        location ? `${directionLevel ? '源码方向' : '位置'}:\n${location}` : '',
        source && !directionLevel ? `源码:\n${source}` : '',
        directionGuess ? `推测方向: ${directionGuess}` : '',
        `需求: ${requirement}`
      ].filter(Boolean).join('\n');
    }).join('\n\n');
  }

  function agentSafetyGuardLines() {
    return [
      '执行准则:',
      '- 上面的文件/源码方向来自页面选区定位，只作为优先检查线索，不是最终结论。',
      '- 修改前必须重新阅读相关源码，验证页面选区、文案/class/结构、组件引用链或事件链是否能对应到该文件。',
      '- 如果验证发现该方向不匹配、证据不足，或真正逻辑在父组件/子组件/组合式函数/常量/API 调用处，必须沿引用链重新定位后再修改。',
      '- 不要为了贴合上述方向而臆测不存在的变量、函数、接口、导入路径或状态管理方式；优先复用项目现有实现。'
    ].join('\n');
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
        return `${asset.token}: ${selectionReferenceSummary(asset)}`;
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

  function combinedSelectionText(options = {}) {
    const expandedRetry = options.expandedRetry === true;
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

  function searchReadyInfo(info, options = {}) {
    if (!info) return info;
    const includeAncestors = options.includeAncestors !== false;
    return {
      ...info,
      searchText: denoiseTextByApi(info.text || ''),
      searchSubtree: denoiseSubtree(info.subtree),
      ...(includeAncestors ? {
        ancestors: (info.ancestors || []).map(ancestor => searchReadyInfo(ancestor, { includeAncestors: false }))
      } : {})
    };
  }

  function searchPayload(options = {}) {
    const expandedRetry = options.expandedRetry === true;
    const selections = selectionPayloads().map(item => {
      const filteredAncestors = expandedRetry
        ? (item.element?.ancestors || [])
        : filteredAncestorsForSearch(item.element);
      const filteredAsset = expandedRetry
        ? (item.asset || null)
        : filteredAssetForSearch(item.element, item.asset);
      return {
        ...item,
        element: {
          ...searchReadyInfo(item.element),
          ancestors: filteredAncestors.map(ancestor => searchReadyInfo(ancestor, { includeAncestors: false }))
        },
        asset: filteredAsset
          ? searchReadyInfo(filteredAsset, { includeAncestors: false })
          : null
      };
    });
    const apiRequests = searchApiRequests.value.map(item => ({
      url: item.url,
      pathname: item.pathname,
      method: item.method,
      requestKeys: item.requestKeys
    }));
    const query = combinedSelectionText({ expandedRetry });
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
        searchText: item.element?.searchText || '',
        className: item.element?.className || ''
      })),
      selections,
      apiRequests,
      includeApi: includeApiEvidence.value,
      mode: 'ui-first',
      expansionMode: expandedRetry ? 'expanded-retry' : 'base',
      apiPaths: apiRequests.map(item => item.pathname || item.url),
      apiKeys: apiRequests.flatMap(item => item.requestKeys || []),
      limit: 30
    };
  }

  function searchLogLines() {
    const routeLines = routeResolverLogLines();
    const lines = [
      `1. 收集页面证据: pagePath=${pageUrlPath.value}；选区数=${selectedItems.value.length}；className=${selectedItems.value.map(item => item.info.className).filter(Boolean).join(' ') || '-'}`,
      `   源码项目: ${project.value?.path || project.value?.name || '-'}`,
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
    lines.push(...i18nTraceLogLines());
    lines.push(...definitionTraceLogLines());
    for (const [index, hit] of candidateHits.value.slice(0, 8).entries()) {
      lines.push(...candidateLogLines(hit, index));
    }
    return lines;
  }

  function i18nTraceLogLines() {
    const trace = i18nTrace?.value;
    if (!trace || !trace.active) return [];
    const lines = [];
    const hints = [
      ...(trace.environment?.packageHints || []),
      ...(trace.environment?.codeHints || []).slice(0, 3)
    ].filter(Boolean);
    lines.push(`9. 国际化识别: 已启用；线索=${hints.length ? hints.join('，') : '语言文件/目录命中'}`);
    for (const item of (trace.definitions || []).slice(0, 4)) {
      lines.push(`   国际化文案: ${item.file}；key=${item.keyPath}；text=${item.phrase}`);
    }
    for (const item of (trace.usages || []).slice(0, 4)) {
      lines.push(`   国际化使用: ${item.file}；key=${item.i18nKey || item.keyPath || '-'}；来源=${item.i18nDefinitionFile || item.from || '-'}`);
    }
    return lines;
  }

  function definitionTraceLogLines() {
    const trace = definitionTrace?.value;
    if (!trace || !trace.active) return [];
    const lines = ['10. 字面量定义链: 已启用'];
    for (const item of (trace.definitions || []).slice(0, 4)) {
      lines.push(`   定义文案: ${item.file}；symbol=${item.symbol || '-'}；key=${item.keyPath || '-'}；text=${item.phrase}`);
    }
    for (const item of (trace.usages || []).slice(0, 4)) {
      lines.push(`   定义使用: ${item.file}；symbol=${item.definitionSymbol || '-'}；key=${item.definitionKeyPath || '-'}；来源=${item.definitionFile || item.from || '-'}`);
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
      selectionReference ? `选区文本参考: ${selectionReference}` : '',
      agentSafetyGuardLines()
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
