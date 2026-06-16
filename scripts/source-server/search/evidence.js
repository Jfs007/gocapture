const {
  makeSnippet,
  normalizeUrlPath,
  tokenize,
  uniq,
} = require('../utils');

function buildSearchEvidence(body) {
  const selections = Array.isArray(body.selections) ? body.selections : [];

  const phrases = [];
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
  addPhrase(body.manualEvidence, 70, '用户补充证据');
  addToken(body.manualEvidence, 30, '用户补充证据');

  for (const selection of selections) {
    addToken(selection.changeNote, 26, '改动点');
    addPhrase(selection.changeNote, 52, '改动点');
    addToken(selection.element?.className, 46, 'className');
    addPhrase(selection.element?.text, 90, '选区文案');
    addToken(selection.element?.text, 28, '选区文案');
    for (const ancestor of selection.element?.ancestors || []) {
      addToken(ancestor.className, 24, '父级 className');
      addPhrase(ancestor.text, 42, '父级文案');
      addToken(ancestor.text, 14, '父级文案');
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

function findUniqueExactTextMatch(text, evidence) {
  const lowerText = String(text || '').toLowerCase();
  const phrases = evidence.phrases
    .filter(phrase => phrase.label === '选区文案' || phrase.label === '用户补充证据')
    .map(phrase => ({
      label: phrase.label,
      text: String(phrase.text || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter(phrase => phrase.text.length >= 4)
    .sort((a, b) => b.text.length - a.text.length);

  for (const phrase of phrases) {
    const lower = phrase.text.toLowerCase();
    const matchCount = countOccurrences(lowerText, lower, 2);
    if (matchCount !== 1) continue;
    const index = lowerText.indexOf(lower);
    return {
      uniqueMatchLabel: phrase.label,
      uniqueMatchText: phrase.text,
      uniqueMatchCount: 1,
      uniqueSnippet: makeSnippet(text, index, phrase.text.length),
    };
  }

  return {
    uniqueMatchLabel: '',
    uniqueMatchText: '',
    uniqueMatchCount: 0,
    uniqueSnippet: '',
  };
}

function scoreFileText(file, text, evidence) {
  const pathScore = scoreFile(file, evidence);
  let score = pathScore.score;
  const reasons = [...pathScore.reasons];
  let snippet = '';
  const lowerText = String(text || '').toLowerCase();
  const uniqueExactMatch = findUniqueExactTextMatch(text, evidence);
  if (uniqueExactMatch.uniqueMatchCount === 1) {
    const boost = uniqueExactMatch.uniqueMatchLabel === '用户补充证据' ? 180 : 90;
    score += boost;
    reasons.push(`唯一命中(${uniqueExactMatch.uniqueMatchLabel})：${uniqueExactMatch.uniqueMatchText.slice(0, 80)}`);
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
    ...uniqueExactMatch,
  };
}

module.exports = {
  buildSearchEvidence,
  scoreFile,
  scoreFileText,
};
