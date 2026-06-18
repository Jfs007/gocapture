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

function isLikelyComponentPath(filePath) {
  return /(^|\/)(components?|widgets?|dialog|modal)\//i.test(filePath);
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
  addToken(body.url, 22, '页面 URL');
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
    for (const ancestor of selection.element?.ancestors || []) {
      addToken(ancestor.className, 24, '父级 className');
      addPhrase(ancestor.text, 42, '父级文案');
      addToken(ancestor.text, 14, '父级文案');
    }

    const signal = {
      index: Number(selection.index || selectionSignals.length + 1),
      tag: String(selection.element?.tag || '').toLowerCase(),
      text: normalizePhrase(selection.element?.text),
      classTokens: tokenize(selection.element?.className).slice(0, 8),
      ancestorTexts: (selection.element?.ancestors || [])
        .map(item => normalizePhrase(item?.text, 3))
        .filter(Boolean)
        .slice(0, 4),
      ancestorClassTokens: uniq((selection.element?.ancestors || [])
        .flatMap(item => tokenize(item?.className)))
        .slice(0, 10),
      instructionText: normalizePhrase(instruction, 3),
      instructionTokens: tokenize(instruction).slice(0, 8),
    };
    if (
      signal.text ||
      signal.classTokens.length ||
      signal.ancestorTexts.length ||
      signal.ancestorClassTokens.length ||
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

function scoreSelectionContext(text, evidence) {
  const lowerText = String(text || '').toLowerCase();
  let best = {
    selectionIndex: 0,
    contextScore: 0,
    contextReasons: [],
  };

  for (const signal of evidence.selectionSignals || []) {
    let score = 0;
    const reasons = [];
    const classMatches = matchedTokenList(lowerText, signal.classTokens, 3, 3);
    const ancestorClassMatches = matchedTokenList(lowerText, signal.ancestorClassTokens, 3, 2);
    const ancestorTextMatches = matchedPhraseList(lowerText, signal.ancestorTexts, 3, 2);
    const instructionTokenMatches = matchedTokenList(lowerText, signal.instructionTokens, 3, 2);
    const hasInstructionPhrase = signal.instructionText && lowerText.includes(signal.instructionText.toLowerCase());
    const hasTag = signal.tag && lowerText.includes(`<${signal.tag}`);

    if (classMatches.length) {
      score += classMatches.length * 26;
      reasons.push(`选区 className 同文件命中：${classMatches.join('、')}`);
    }
    if (ancestorClassMatches.length) {
      score += ancestorClassMatches.length * 14;
      reasons.push(`父级 className 同文件命中：${ancestorClassMatches.join('、')}`);
    }
    if (ancestorTextMatches.length) {
      score += ancestorTextMatches.length * 18;
      reasons.push(`父级文案同文件命中：${ancestorTextMatches.join('、')}`);
    }
    if (instructionTokenMatches.length) {
      score += instructionTokenMatches.length * 12;
      reasons.push(`修改要求关键词同文件命中：${instructionTokenMatches.join('、')}`);
    }
    if (hasInstructionPhrase) {
      score += 22;
      reasons.push(`修改要求短语同文件命中：${signal.instructionText.slice(0, 80)}`);
    }
    if (hasTag) {
      score += 6;
      reasons.push(`标签结构命中：<${signal.tag}>`);
    }

    if (score > best.contextScore) {
      best = {
        selectionIndex: signal.index,
        contextScore: score,
        contextReasons: reasons.slice(0, 5),
      };
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
  const uniqueExactMatch = {
    uniqueMatchLabel: exactMatchCount === 1 ? exactMatch.exactMatchLabel : '',
    uniqueMatchText: exactMatchCount === 1 ? exactMatch.exactMatchText : '',
    uniqueMatchCount: exactMatchCount === 1 ? 1 : 0,
    uniqueSnippet: exactMatchCount === 1 ? exactMatch.exactSnippet : '',
  };
  const hasContextSupport = contextMatch.contextScore >= 34;
  const preciseEvidence = exactMatchCount > 0 && (
    exactMatch.exactMatchLabel === '用户补充证据'
      ? (exactMatchCount === 1 || contextMatch.contextScore >= 18)
      : ((exactMatchCount === 1 && contextMatch.contextScore >= 18) || (exactMatchCount > 1 && hasContextSupport))
  );

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
    preciseEvidence,
    preciseSnippet: preciseEvidence ? (uniqueExactMatch.uniqueSnippet || exactMatch.exactSnippet || snippet) : '',
    ...uniqueExactMatch,
  };
}

module.exports = {
  buildSearchEvidence,
  scoreFile,
  scoreFileText,
};
