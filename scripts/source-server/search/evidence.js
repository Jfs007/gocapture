const {
  makeSnippet,
  normalizeUrlPath,
  tokenize,
  uniq,
} = require('../utils');

function normalizePhrase(value, minLength = 2) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length >= minLength ? text : '';
}

function numericStyleValue(value) {
  const matched = String(value || '').trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return matched ? matched[1] : '';
}

function tokenizeUrlValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const pieces = [];
  try {
    const url = new URL(raw, 'http://local.invalid');
    if (!/^https?:$/i.test(url.protocol) || url.hostname === 'local.invalid') {
      pieces.push(url.hostname || '');
    }
    pieces.push(...url.pathname.split('/'));
  } catch (error) {
    pieces.push(raw);
  }
  return uniq(
    pieces
      .flatMap(piece => tokenize(piece))
      .filter(token => token.length >= 6)
  ).slice(0, 10);
}

function infoClassTokens(info, limit = 12) {
  return tokenize(info?.className).slice(0, limit);
}

function infoTextPhrases(info, limit = 4) {
  return uniq([
    normalizePhrase(info?.text, 3),
  ].filter(Boolean)).slice(0, limit);
}

function infoTextTokens(info, limit = 18) {
  return uniq(tokenize(info?.text)).slice(0, limit);
}

function infoAttrTokens(info, limit = 16) {
  const attrs = info?.attrs || {};
  const tokens = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (!value) continue;
    if (key === 'src' || key === 'href') {
      tokens.push(...tokenizeUrlValue(value));
      continue;
    }
    if (key === 'width' || key === 'height') {
      continue;
    }
    tokens.push(...tokenize(value));
  }
  return uniq(tokens.filter(token => String(token || '').length >= 3)).slice(0, limit);
}

function infoStyleTokens(info, limit = 16) {
  const style = info?.computedStyle || {};
  const tokens = uniq([
    style.objectFit || '',
    style.borderRadius || '',
    style.width || '',
    style.height || '',
    ...tokenize(String(info?.inlineStyle || '').replace(/[:;]/g, ' ')),
  ].filter(Boolean));
  const widthPx = numericStyleValue(style.width);
  const heightPx = numericStyleValue(style.height);
  if (widthPx) tokens.push(`${widthPx}px`);
  if (heightPx) tokens.push(`${heightPx}px`);
  return uniq(tokens.filter(token => String(token || '').length >= 3)).slice(0, limit);
}

function isLikelyComponentPath(filePath) {
  return /(^|\/)(components?|widgets?|dialog|modal)\//i.test(filePath);
}

function buildSelectionLayers(selection) {
  const element = selection?.element || {};
  const asset = selection?.asset || {};
  const ancestors = Array.isArray(element.ancestors) ? element.ancestors : [];
  const layers = [];

  const classTokens = [];
  const textPhrases = [];
  const textTokens = [];
  const attrTokens = [];
  const styleTokens = [];

  const pushInfo = info => {
    classTokens.push(...infoClassTokens(info));
    textPhrases.push(...infoTextPhrases(info));
    textTokens.push(...infoTextTokens(info));
    attrTokens.push(...infoAttrTokens(info));
    styleTokens.push(...infoStyleTokens(info));
  };

  pushInfo(element);
  layers.push({
    scope: 'self',
    label: '当前选区',
    depth: 0,
    tag: String(element.tag || '').toLowerCase(),
    classTokens: uniq(classTokens).slice(0, 14),
    textPhrases: uniq(textPhrases).slice(0, 6),
    textTokens: uniq(textTokens).slice(0, 14),
    attrTokens: uniq(attrTokens).slice(0, 16),
    styleTokens: uniq(styleTokens).slice(0, 16),
  });

  for (let index = 0; index < ancestors.length; index++) {
    pushInfo(ancestors[index]);
    layers.push({
      scope: 'ancestor',
      label: `向上扩大 ${index + 1} 层`,
      depth: index + 1,
      tag: String(element.tag || '').toLowerCase(),
      classTokens: uniq(classTokens).slice(0, 16),
      textPhrases: uniq(textPhrases).slice(0, 8),
      textTokens: uniq(textTokens).slice(0, 18),
      attrTokens: uniq(attrTokens).slice(0, 18),
      styleTokens: uniq(styleTokens).slice(0, 18),
    });
  }

  if (asset && (asset.selector || asset.className || asset.text)) {
    pushInfo(asset);
    layers.push({
      scope: 'asset',
      label: '截图区域',
      depth: ancestors.length + 1,
      tag: String(element.tag || '').toLowerCase(),
      classTokens: uniq(classTokens).slice(0, 18),
      textPhrases: uniq(textPhrases).slice(0, 10),
      textTokens: uniq(textTokens).slice(0, 22),
      attrTokens: uniq(attrTokens).slice(0, 18),
      styleTokens: uniq(styleTokens).slice(0, 18),
    });
  }

  return layers;
}

function buildSearchEvidence(body) {
  const selections = Array.isArray(body.selections) ? body.selections : [];
  const selectionInstructions = new Map(
    (Array.isArray(body.selectionInstructions) ? body.selectionInstructions : [])
      .map(item => [Number(item?.index || 0), String(item?.instruction || '')])
      .filter(item => item[0] > 0 && item[1])
  );

  const phrases = [];
  const selectionSignals = [];
  const weightedTokens = [];
  const addToken = (value, weight, label) => {
    for (const token of tokenize(value)) {
      weightedTokens.push({ token, weight, label });
    }
  };
  const addPhrase = (value, weight, label) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length >= 2) phrases.push({ text, weight, label });
  };

  addToken(body.query, 18, 'query');
  addToken(normalizeUrlPath(body.url), 36, '页面路径');
  addToken(body.className, 38, 'className');
  addPhrase(body.text, 80, '选区文案');
  addToken(body.text, 24, '选区文案');
  addPhrase(body.userPrompt, 72, '用户指令');
  addToken(body.userPrompt, 30, '用户指令');
  addPhrase(body.manualEvidence, 70, '用户补充证据');
  addToken(body.manualEvidence, 30, '用户补充证据');

  for (const selection of selections) {
    const instruction = selectionInstructions.get(Number(selection.index || 0)) || '';
    addToken(instruction, 34, '修改要求');
    addPhrase(instruction, 66, '修改要求');
    addToken(selection.element?.className, 46, 'className');
    addPhrase(selection.element?.text, 90, '选区文案');
    addToken(selection.element?.text, 28, '选区文案');
    addToken(selection.asset?.className, 26, '截图区域 className');
    addPhrase(selection.asset?.text, 34, '截图区域文案');
    addToken(selection.asset?.text, 12, '截图区域文案');
    for (const ancestor of selection.element?.ancestors || []) {
      addToken(ancestor.className, 24, '父级 className');
      addPhrase(ancestor.text, 42, '父级文案');
      addToken(ancestor.text, 14, '父级文案');
    }

    const signal = {
      index: Number(selection.index || selectionSignals.length + 1),
      tag: String(selection.element?.tag || '').toLowerCase(),
      instructionText: normalizePhrase(instruction, 3),
      instructionTokens: tokenize(instruction).slice(0, 8),
      layers: buildSelectionLayers(selection),
    };
    if (
      signal.layers.some(layer => layer.textPhrases.length || layer.textTokens.length || layer.classTokens.length || layer.attrTokens.length || layer.styleTokens.length) ||
      signal.instructionText ||
      signal.instructionTokens.length
    ) {
      selectionSignals.push(signal);
    }
  }

  const merged = new Map();
  for (const item of weightedTokens) {
    const key = item.token.toLowerCase();
    const old = merged.get(key);
    if (!old || old.weight < item.weight) {
      merged.set(key, item);
    }
  }

  return {
    tokens: Array.from(merged.values()).slice(0, 180),
    phrases: phrases.slice(0, 80),
    selectionSignals: selectionSignals.slice(0, 24),
  };
}

function scoreFile(file, evidence) {
  let score = 0;
  const lowerPath = file.path.toLowerCase();
  const reasons = [];
  for (const item of evidence.tokens) {
    const lower = item.token.toLowerCase();
    if (lowerPath.includes(lower)) {
      score += lowerPath.endsWith(lower) ? item.weight + 28 : item.weight;
      reasons.push(`路径命中(${item.label})：${item.token}`);
    }
  }
  return { score, reasons };
}

function countOccurrences(lowerText, lowerNeedle, limit = 2) {
  if (!lowerText || !lowerNeedle) return 0;
  let count = 0;
  let index = 0;
  while (count < limit) {
    index = lowerText.indexOf(lowerNeedle, index);
    if (index === -1) break;
    count++;
    index += lowerNeedle.length;
  }
  return count;
}

function findBestExactTextMatch(text, evidence) {
  const lowerText = String(text || '').toLowerCase();
  const phrases = evidence.phrases
    .filter(phrase => phrase.label === '选区文案' || phrase.label === '用户补充证据')
    .map(phrase => ({
      label: phrase.label,
      text: String(phrase.text || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter(phrase => phrase.text.length >= 4)
    .sort((a, b) => b.text.length - a.text.length);

  let best = null;
  for (const phrase of phrases) {
    const lower = phrase.text.toLowerCase();
    const matchCount = countOccurrences(lowerText, lower, 6);
    if (matchCount < 1) continue;
    const index = lowerText.indexOf(lower);
    const current = {
      exactMatchLabel: phrase.label,
      exactMatchText: phrase.text,
      exactMatchCount: matchCount,
      exactSnippet: makeSnippet(text, index, phrase.text.length),
    };
    if (!best) {
      best = current;
      continue;
    }
    const bestPriority = best.exactMatchLabel === '用户补充证据' ? 2 : 1;
    const currentPriority = current.exactMatchLabel === '用户补充证据' ? 2 : 1;
    if (currentPriority > bestPriority) {
      best = current;
      continue;
    }
    if (currentPriority === bestPriority) {
      if (current.exactMatchCount === 1 && best.exactMatchCount !== 1) {
        best = current;
        continue;
      }
      if (current.exactMatchCount === best.exactMatchCount && current.exactMatchText.length > best.exactMatchText.length) {
        best = current;
      }
    }
  }

  if (!best) {
    return {
      exactMatchLabel: '',
      exactMatchText: '',
      exactMatchCount: 0,
      exactSnippet: '',
    };
  }
  return best;
}

function matchedTokenList(lowerText, tokens, minLength = 3, limit = 2) {
  const result = [];
  for (const token of tokens || []) {
    const value = String(token || '').trim();
    if (value.length < minLength) continue;
    if (!lowerText.includes(value.toLowerCase())) continue;
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function matchedPhraseList(lowerText, phrases, minLength = 3, limit = 2) {
  const result = [];
  for (const phrase of phrases || []) {
    const value = normalizePhrase(phrase, minLength);
    if (!value) continue;
    if (!lowerText.includes(value.toLowerCase())) continue;
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function tagPatternIndex(text, tag) {
  const patterns = [
    `<${tag}`,
    `h('${tag}'`,
    `h("${tag}"`,
    `createelement('${tag}'`,
    `createelement("${tag}"`,
  ];
  const lowerText = String(text || '').toLowerCase();
  for (const pattern of patterns) {
    const index = lowerText.indexOf(pattern.toLowerCase());
    if (index !== -1) return { index, pattern };
  }
  return null;
}

function firstMatchedValue(text, values) {
  const lowerText = String(text || '').toLowerCase();
  for (const value of values || []) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    const index = lowerText.indexOf(raw.toLowerCase());
    if (index !== -1) return { index, value: raw };
  }
  return null;
}

function scoreSelectionContext(text, evidence) {
  const lowerText = String(text || '').toLowerCase();
  let best = {
    selectionIndex: 0,
    contextScore: 0,
    contextReasons: [],
    contextScope: '',
    contextLayerDepth: 0,
    strongMatchCount: 0,
    contextSnippet: '',
  };

  for (const signal of evidence.selectionSignals || []) {
    for (const layer of signal.layers || []) {
      let score = 0;
      const reasons = [];
      const classMatches = matchedTokenList(lowerText, layer.classTokens, 3, 4);
      const textMatches = matchedPhraseList(lowerText, layer.textPhrases, 3, 3);
      const textTokenMatches = matchedTokenList(lowerText, layer.textTokens, 3, 4)
        .filter(token => !textMatches.some(phrase => phrase.includes(token)));
      const attrMatches = matchedTokenList(lowerText, layer.attrTokens, 3, 4);
      const styleMatches = matchedTokenList(lowerText, layer.styleTokens, 3, 4);
      const instructionTokenMatches = matchedTokenList(lowerText, signal.instructionTokens, 3, 2);
      const hasInstructionPhrase = signal.instructionText && lowerText.includes(signal.instructionText.toLowerCase());
      const tagMatch = signal.tag ? tagPatternIndex(text, signal.tag) : null;
      const anchorMatchCount = classMatches.length + textMatches.length + textTokenMatches.length + attrMatches.length + (tagMatch ? 1 : 0);
      const strongMatchCount = anchorMatchCount;

      if (classMatches.length) {
        score += classMatches.length * 24;
        reasons.push(`${layer.label} className 同文件命中：${classMatches.join('、')}`);
      }
      if (textMatches.length) {
        score += textMatches.length * (layer.scope === 'self' ? 20 : 24);
        reasons.push(`${layer.label}文案同文件命中：${textMatches.join('、')}`);
      }
      if (textTokenMatches.length) {
        score += textTokenMatches.length * 16;
        reasons.push(`${layer.label}文本片段同文件命中：${textTokenMatches.join('、')}`);
      }
      if (attrMatches.length) {
        score += attrMatches.length * 18;
        reasons.push(`${layer.label}属性同文件命中：${attrMatches.join('、')}`);
      }
      if (styleMatches.length) {
        if (anchorMatchCount > 0) {
          score += styleMatches.length * 10;
          reasons.push(`${layer.label}样式同文件命中：${styleMatches.join('、')}`);
        } else {
          score += Math.min(6, styleMatches.length * 2);
        }
      }
      if (instructionTokenMatches.length) {
        score += instructionTokenMatches.length * 12;
        reasons.push(`修改要求关键词同文件命中：${instructionTokenMatches.join('、')}`);
      }
      if (hasInstructionPhrase) {
        score += 22;
        reasons.push(`修改要求短语同文件命中：${signal.instructionText.slice(0, 80)}`);
      }
      if (tagMatch) {
        score += 8;
        reasons.push(`标签结构命中：${tagMatch.pattern}`);
      }
      if (tagMatch && styleMatches.length) {
        score += 10;
        reasons.push('标签结构与尺寸/样式同时命中');
      }
      if (layer.depth > 0 && anchorMatchCount > 0) {
        score += 12 + Math.min(24, layer.depth * 6);
        reasons.push(`扩大上下文后继续命中：${layer.label}`);
      }
      if (layer.scope === 'asset' && anchorMatchCount >= 2) {
        score += 18;
        reasons.push('截图区域证据命中');
      }

      if (score > best.contextScore) {
        const snippetSource = firstMatchedValue(text, [
          ...textMatches,
          ...textTokenMatches,
          ...classMatches,
          ...attrMatches,
          ...styleMatches,
          ...instructionTokenMatches,
        ]);
        const tagIndex = tagMatch ? tagMatch.index : -1;
        const snippet = snippetSource
          ? makeSnippet(text, snippetSource.index, snippetSource.value.length)
          : tagIndex !== -1
            ? makeSnippet(text, tagIndex, signal.tag.length + 1)
            : '';
        best = {
          selectionIndex: signal.index,
          contextScore: score,
          contextReasons: reasons.slice(0, 6),
          contextScope: layer.scope,
          contextLayerDepth: layer.depth,
          strongMatchCount,
          contextSnippet: snippet,
        };
      }
    }
  }

  return best;
}

function scoreFileText(file, text, evidence) {
  const pathScore = scoreFile(file, evidence);
  let score = pathScore.score;
  const reasons = [...pathScore.reasons];
  let snippet = '';
  const lowerText = String(text || '').toLowerCase();
  const exactMatch = findBestExactTextMatch(text, evidence);
  const contextMatch = scoreSelectionContext(text, evidence);
  const exactMatchCount = exactMatch.exactMatchCount || 0;
  const exactTextLength = String(exactMatch.exactMatchText || '').trim().length;
  const uniqueExactMatch = {
    uniqueMatchLabel: exactMatchCount === 1 ? exactMatch.exactMatchLabel : '',
    uniqueMatchText: exactMatchCount === 1 ? exactMatch.exactMatchText : '',
    uniqueMatchCount: exactMatchCount === 1 ? 1 : 0,
    uniqueSnippet: exactMatchCount === 1 ? exactMatch.exactSnippet : '',
  };
  const hasContextSupport = contextMatch.contextScore >= 34;
  const needsBroaderContext = exactMatch.exactMatchLabel !== '用户补充证据' && exactTextLength > 0 && exactTextLength <= 12;
  const structuralEvidence = exactMatchCount === 0
    && contextMatch.contextScore >= 92
    && contextMatch.contextLayerDepth >= 1
    && contextMatch.strongMatchCount >= 3;
  const preciseEvidence = exactMatchCount > 0
    ? (
      exactMatch.exactMatchLabel === '用户补充证据'
        ? (exactMatchCount === 1 || contextMatch.contextScore >= 18)
        : needsBroaderContext
          ? ((exactMatchCount === 1 && contextMatch.contextScore >= 26 && contextMatch.contextLayerDepth >= 1) || (exactMatchCount > 1 && hasContextSupport))
          : ((exactMatchCount === 1 && contextMatch.contextScore >= 18) || (exactMatchCount > 1 && hasContextSupport))
    )
    : structuralEvidence;

  if (contextMatch.contextScore > 0) {
    score += Math.min(78, contextMatch.contextScore);
    reasons.push(...contextMatch.contextReasons);
  }

  if (exactMatchCount === 1) {
    if (preciseEvidence) {
      const boost = exactMatch.exactMatchLabel === '用户补充证据' ? 180 : 92;
      score += boost;
      reasons.push(`精准命中(${exactMatch.exactMatchLabel})：${exactMatch.exactMatchText.slice(0, 80)}`);
    } else {
      score += exactMatch.exactMatchLabel === '用户补充证据' ? 96 : 18;
      reasons.push(`文件内唯一文案但缺少页面上下文：${exactMatch.exactMatchText.slice(0, 80)}`);
    }
  } else if (exactMatchCount > 1 && preciseEvidence) {
    const boost = exactMatch.exactMatchLabel === '用户补充证据' ? 120 : 68;
    score += boost;
    reasons.push(`上下文精准命中(${exactMatch.exactMatchLabel})：${exactMatch.exactMatchText.slice(0, 80)}；文件内出现 ${exactMatchCount} 次`);
  } else if (structuralEvidence) {
    score += 96;
    reasons.push(`结构化精准命中：扩大到${contextMatch.contextScope === 'asset' ? '截图区域' : '上层上下文'}后仍能稳定命中`);
  }

  if (isLikelyComponentPath(file.path) && exactMatchCount === 1 && !preciseEvidence && contextMatch.contextScore < 18) {
    score -= 42;
    reasons.push('降权：仅子组件内唯一文案，缺少当前选区上下文');
  }

  for (const phrase of evidence.phrases) {
    const lower = phrase.text.toLowerCase();
    const index = lowerText.indexOf(lower);
    if (index === -1) continue;
    score += phrase.weight;
    reasons.push(`内容命中(${phrase.label})：${phrase.text.slice(0, 80)}`);
    if (!snippet) snippet = makeSnippet(text, index, phrase.text.length);
  }

  for (const item of evidence.tokens) {
    const lower = item.token.toLowerCase();
    const index = lowerText.indexOf(lower);
    if (index === -1) continue;
    score += item.token.length >= 6 ? item.weight : Math.max(10, Math.round(item.weight * 0.65));
    reasons.push(`内容命中(${item.label})：${item.token}`);
    if (!snippet) snippet = makeSnippet(text, index, item.token.length);
  }

  if (!snippet && contextMatch.contextSnippet) snippet = contextMatch.contextSnippet;

  return {
    score,
    reasons: uniq(reasons),
    snippet,
    exactMatchLabel: exactMatch.exactMatchLabel,
    exactMatchText: exactMatch.exactMatchText,
    exactMatchCount,
    exactSnippet: exactMatch.exactSnippet,
    contextScore: contextMatch.contextScore,
    contextReasons: contextMatch.contextReasons,
    contextSelectionIndex: contextMatch.selectionIndex,
    contextScope: contextMatch.contextScope,
    contextLayerDepth: contextMatch.contextLayerDepth,
    contextStrongMatchCount: contextMatch.strongMatchCount,
    preciseEvidence,
    preciseSnippet: preciseEvidence ? (uniqueExactMatch.uniqueSnippet || exactMatch.exactSnippet || contextMatch.contextSnippet || snippet) : '',
    ...uniqueExactMatch,
  };
}

module.exports = {
  buildSearchEvidence,
  scoreFile,
  scoreFileText,
};
